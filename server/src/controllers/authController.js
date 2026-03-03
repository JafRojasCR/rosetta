const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const AuthVerificationToken = require('../models/AuthVerificationToken');
const { appBaseUrl, jwtSecret, jwtExpiresIn } = require('../config/env');
const { success, error } = require('../utils/apiResponse');
const { send2FACode, sendPasswordResetLink } = require('../services/emailService');
const Joi = require('joi');

const generateToken = (payload) => jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
const generateResetToken = (payload) => jwt.sign(payload, jwtSecret, { expiresIn: '15m' });
const generateTakeoverToken = (payload) => jwt.sign(payload, jwtSecret, { expiresIn: '5m' });

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const VERIFICATION_EXPIRY_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MS = 30 * 1000;

const normalizeDeviceId = (value = '') => String(value || '').trim().slice(0, 120);

const getClientIp = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded;
  return String(req.ip || req.socket?.remoteAddress || '').trim();
};

const getClientUserAgent = (req) =>
  String(req.headers['user-agent'] || '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 255);

const buildSessionSnapshot = (req, requestedDeviceId = '') => {
  const now = new Date();
  return {
    deviceId: normalizeDeviceId(requestedDeviceId),
    userAgent: getClientUserAgent(req),
    ip: getClientIp(req),
    startedAt: now,
    lastSeenAt: now,
  };
};

const findAccountByEmail = async (email) => {
  const normalizedEmail = String(email || '').toLowerCase();

  let account = await Student.findOne({ email: normalizedEmail });
  if (account) return { account, role: 'student' };

  account = await Admin.findOne({ email: normalizedEmail });
  if (account) return { account, role: 'admin' };

  return { account: null, role: null };
};

const createVerificationRecord = async ({ account, role, purpose }) => {
  const code = generateCode();
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

  await AuthVerificationToken.create({
    tokenHash: hashValue(verificationToken),
    codeHash: hashValue(code),
    email: account.email,
    userId: account._id,
    role,
    purpose,
    expiresAt,
  });

  if (purpose === 'login_2fa') {
    await send2FACode(account.email, code);
  }

  return {
    verificationToken,
    expiresInSeconds: Math.floor(VERIFICATION_EXPIRY_MS / 1000),
  };
};

const isCodeMatch = (record, code) => {
  const inputHash = hashValue(code);
  const storedBuffer = Buffer.from(String(record.codeHash || ''), 'utf8');
  const inputBuffer = Buffer.from(String(inputHash || ''), 'utf8');

  if (storedBuffer.length !== inputBuffer.length) return false;
  return crypto.timingSafeEqual(storedBuffer, inputBuffer);
};

const findRecordByToken = async (verificationToken, purpose) => {
  return AuthVerificationToken.findOne({
    tokenHash: hashValue(verificationToken),
    purpose,
    consumedAt: null,
  });
};

const validateVerificationCode = async (record, code) => {
  if (!record) return { ok: false, message: 'Solicitud de verificación no válida.' };

  if (record.lockedUntil && record.lockedUntil.getTime() > Date.now()) {
    const remainingSeconds = Math.max(
      1,
      Math.ceil((record.lockedUntil.getTime() - Date.now()) / 1000)
    );
    return {
      ok: false,
      message: `Demasiados intentos. Espera ${remainingSeconds}s para volver a intentar.`,
    };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, message: 'Código expirado. Solicita un nuevo código.' };
  }

  const matched = isCodeMatch(record, code);
  if (!matched) {
    const nextAttempts = Number(record.attempts || 0) + 1;
    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + OTP_LOCK_MS);
      await AuthVerificationToken.updateOne(
        { _id: record._id },
        {
          $set: {
            attempts: 0,
            lockedUntil,
          },
        }
      );

      return {
        ok: false,
        message: 'Demasiados intentos. Espera 30s para volver a intentar.',
      };
    }

    await AuthVerificationToken.updateOne(
      { _id: record._id },
      { $set: { attempts: nextAttempts } }
    );
    return { ok: false, message: 'Código inválido o expirado.' };
  }

  await AuthVerificationToken.updateOne(
    { _id: record._id },
    { $set: { consumedAt: new Date(), lockedUntil: null, attempts: 0 } }
  );
  return { ok: true };
};

// POST /api/auth/register
const register = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string()
      .pattern(strongPasswordRegex)
      .required()
      .messages({
        'string.pattern.base':
          'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número.',
      }),
    name: Joi.string().required(),
    lastName: Joi.string().required(),
    phone: Joi.string().allow('').optional(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const [existsStudent, existsAdmin] = await Promise.all([
      Student.findOne({ email: value.email }),
      Admin.findOne({ email: value.email }),
    ]);
    if (existsStudent || existsAdmin) return error(res, 'El correo ya está registrado.', 409);

    const student = await Student.create(value);
    const token = generateToken({
      id: student._id,
      email: student.email,
      role: 'student',
      sv: Number(student.sessionVersion || 0),
    });

    return success(res, { user: student, token, role: 'student' }, 'Registro exitoso', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const { account: user, role: resolvedRole } = await findAccountByEmail(value.email);

    if (!user) return error(res, 'Credenciales incorrectas.', 401, { code: 'INVALID_CREDENTIALS' });

    const isMatch = await user.comparePassword(value.password);
    if (!isMatch) return error(res, 'Credenciales incorrectas.', 401, { code: 'INVALID_CREDENTIALS' });

    const { verificationToken, expiresInSeconds } = await createVerificationRecord({
      account: user,
      role: resolvedRole,
      purpose: 'login_2fa',
    });

    return success(
      res,
      {
        requiresTwoFactor: true,
        verificationToken,
        email: user.email,
        role: resolvedRole,
        expiresIn: expiresInSeconds,
      },
      'Código de verificación enviado al correo.'
    );
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/resend-2fa
const resend2FA = async (req, res) => {
  const schema = Joi.object({
    verificationToken: Joi.string().required(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const record = await findRecordByToken(value.verificationToken, 'login_2fa');
    if (!record) return error(res, 'Solicitud de verificación no válida.', 400);

    if (record.expiresAt.getTime() < Date.now()) {
      return error(res, 'La solicitud expiró. Inicia sesión nuevamente.', 400);
    }

    const code = generateCode();
    record.codeHash = hashValue(code);
    record.attempts = 0;
    record.lockedUntil = null;
    record.expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);
    await record.save();

    await send2FACode(record.email, code);

    return success(res, null, 'Código enviado al correo.');
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/verify-2fa
const verify2FA = async (req, res) => {
  const schema = Joi.object({
    verificationToken: Joi.string().optional(),
    code: Joi.string().length(6).optional(),
    deviceId: Joi.string().allow('').optional(),
    forceTakeover: Joi.boolean().optional().default(false),
    takeoverToken: Joi.string().allow('').optional(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const requestedDeviceId = normalizeDeviceId(value.deviceId || req.headers['x-device-id'] || '');

    let user;
    let resolvedRole = null;

    if (value.forceTakeover) {
      if (!value.takeoverToken) {
        return error(res, 'Token de traspaso de sesión requerido.', 400);
      }

      let takeoverPayload;
      try {
        takeoverPayload = jwt.verify(value.takeoverToken, jwtSecret);
      } catch (_takeoverError) {
        return error(res, 'Solicitud de traspaso inválida o expirada.', 400);
      }

      if (takeoverPayload?.type !== 'session_takeover' || !takeoverPayload?.userId || !takeoverPayload?.role) {
        return error(res, 'Solicitud de traspaso inválida o expirada.', 400);
      }

      resolvedRole = takeoverPayload.role;
      if (resolvedRole === 'admin') {
        user = await Admin.findById(takeoverPayload.userId);
      } else {
        user = await Student.findById(takeoverPayload.userId);
      }

      if (!user || String(user.email || '').toLowerCase() !== String(takeoverPayload.email || '').toLowerCase()) {
        return error(res, 'Usuario no encontrado.', 404);
      }
    } else {
      if (!value.verificationToken || !value.code) {
        return error(res, 'Código y token de verificación requeridos.', 400);
      }

      const record = await findRecordByToken(value.verificationToken, 'login_2fa');
      const validation = await validateVerificationCode(record, value.code);
      if (!validation.ok) return error(res, validation.message, 400);

      resolvedRole = record.role;
      if (record.role === 'admin') {
        user = await Admin.findById(record.userId);
      } else {
        user = await Student.findById(record.userId);
      }

      if (!user || String(user.email || '').toLowerCase() !== String(record.email || '').toLowerCase()) {
        return error(res, 'Usuario no encontrado.', 404);
      }

      const currentDeviceId = normalizeDeviceId(user.activeSession?.deviceId || '');
      const hasCurrentActiveSession = Boolean(currentDeviceId && user.activeSession?.startedAt);
      const isSameDevice = Boolean(currentDeviceId && requestedDeviceId && currentDeviceId === requestedDeviceId);

      if (hasCurrentActiveSession && !isSameDevice) {
        const takeoverToken = generateTakeoverToken({
          type: 'session_takeover',
          userId: user._id,
          email: user.email,
          role: resolvedRole,
        });

        return error(
          res,
          'Ya existe una sesión activa en otro dispositivo.',
          409,
          {
            code: 'ACTIVE_SESSION_EXISTS',
            takeoverToken,
            activeSession: {
              userAgent: String(user.activeSession?.userAgent || ''),
              ip: String(user.activeSession?.ip || ''),
              lastSeenAt: user.activeSession?.lastSeenAt || user.activeSession?.startedAt || null,
            },
          }
        );
      }
    }

    const nextSessionVersion = Number(user.sessionVersion || 0) + 1;
    user.sessionVersion = nextSessionVersion;
    user.lastLoginAt = new Date();
    user.activeSession = buildSessionSnapshot(req, requestedDeviceId || `device-${Date.now()}`);
    await user.save();

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: resolvedRole,
      sv: nextSessionVersion,
    });

    return success(res, { user, token, role: resolvedRole }, 'Verificación exitosa');
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/forgot-password
const requestPasswordReset = async (req, res) => {
  const schema = Joi.object({ email: Joi.string().email().required() });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const { account, role } = await findAccountByEmail(value.email);

    if (!account) {
      return success(res, null, 'Si el correo existe, enviamos un enlace de recuperación.');
    }

    const resetToken = generateResetToken({
      type: 'password_reset',
      userId: account._id,
      email: account.email,
      role,
    });

    const resetUrl = `${String(appBaseUrl || 'https://rosetta.jafrojas.com').replace(/\/$/, '')}/recoverPassword?token=${encodeURIComponent(resetToken)}`;
    await sendPasswordResetLink(account.email, resetUrl);

    return success(res, null, 'Si el correo existe, enviamos un enlace de recuperación.');
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/verify-reset-code
const verifyPasswordResetCode = async (req, res) => {
  const schema = Joi.object({
    verificationToken: Joi.string().required(),
    code: Joi.string().length(6).required(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const record = await findRecordByToken(value.verificationToken, 'password_reset');
    const validation = await validateVerificationCode(record, value.code);
    if (!validation.ok) return error(res, validation.message, 400);

    const resetToken = generateResetToken({
      type: 'password_reset',
      userId: record.userId,
      email: record.email,
      role: record.role,
    });

    return success(res, { resetToken }, 'Código verificado correctamente.');
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  const schema = Joi.object({
    resetToken: Joi.string().required(),
    newPassword: Joi.string()
      .pattern(strongPasswordRegex)
      .required()
      .messages({
        'string.pattern.base':
          'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número.',
      }),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const decoded = jwt.verify(value.resetToken, jwtSecret);
    if (decoded?.type !== 'password_reset' || !decoded?.userId || !decoded?.role) {
      return error(res, 'Token de recuperación inválido.', 400);
    }

    let account;
    if (decoded.role === 'admin') {
      account = await Admin.findById(decoded.userId);
    } else {
      account = await Student.findById(decoded.userId);
    }

    if (!account || String(account.email || '').toLowerCase() !== String(decoded.email || '').toLowerCase()) {
      return error(res, 'Usuario no encontrado.', 404);
    }

    account.password = value.newPassword;
    await account.save();

    await AuthVerificationToken.deleteMany({
      email: String(account.email || '').toLowerCase(),
      purpose: 'password_reset',
    });

    return success(res, null, 'Contraseña restablecida correctamente.');
  } catch (err) {
    return error(res, 'Token de recuperación inválido o expirado.', 400);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    let user;
    if (req.user.role === 'admin') {
      user = await Admin.findById(req.user.id);
    } else {
      user = await Student.findById(req.user.id);
    }
    if (!user) return error(res, 'Usuario no encontrado.', 404);
    return success(res, { user, role: req.user.role });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  const schema = Joi.object({
    newPassword: Joi.string()
      .pattern(strongPasswordRegex)
      .required()
      .messages({
        'string.pattern.base':
          'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número.',
      }),
    currentPassword: Joi.string().allow('').optional(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    let account;

    if (req.user.role === 'admin') {
      account = await Admin.findById(req.user.id);
    } else {
      account = await Student.findById(req.user.id);
    }

    if (!account) return error(res, 'Usuario no encontrado.', 404);

    if (value.currentPassword) {
      const isCurrentValid = await account.comparePassword(value.currentPassword);
      if (!isCurrentValid) {
        return error(res, 'La contraseña actual no es correcta.', 400);
      }
    }

    account.password = value.newPassword;
    await account.save();

    return success(res, null, 'Contraseña actualizada');
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    let account;

    if (req.user.role === 'admin') {
      account = await Admin.findById(req.user.id);
    } else {
      account = await Student.findById(req.user.id);
    }

    if (!account) return error(res, 'Usuario no encontrado.', 404);

    account.sessionVersion = Number(account.sessionVersion || 0) + 1;
    account.activeSession = {
      deviceId: '',
      userAgent: '',
      ip: '',
      startedAt: null,
      lastSeenAt: null,
    };
    await account.save();

    return success(res, null, 'Sesión cerrada correctamente.');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  register,
  login,
  resend2FA,
  verify2FA,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPassword,
  getMe,
  changePassword,
  logout,
};
