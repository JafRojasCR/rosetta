const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const { success, error } = require('../utils/apiResponse');
const { send2FACode } = require('../services/emailService');
const Joi = require('joi');

const generateToken = (payload) => jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/register
const register = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
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
    const token = generateToken({ id: student._id, email: student.email, role: 'student' });

    return success(res, { student, token }, 'Registro exitoso', 201);
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
    let resolvedRole = 'student';
    let user = await Student.findOne({ email: value.email });
    if (!user) {
      user = await Admin.findOne({ email: value.email });
      resolvedRole = 'admin';
    }

    if (!user) return error(res, 'Credenciales incorrectas.', 401, { code: 'INVALID_CREDENTIALS' });

    const isMatch = await user.comparePassword(value.password);
    if (!isMatch) return error(res, 'Credenciales incorrectas.', 401, { code: 'INVALID_CREDENTIALS' });

    const token = generateToken({ id: user._id, email: user.email, role: resolvedRole });

    return success(res, { user, token, role: resolvedRole }, 'Inicio de sesión exitoso');
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/send-2fa
const send2FA = async (req, res) => {
  const { email } = req.body;
  if (!email) return error(res, 'Correo requerido.', 400);

  try {
    const student = await Student.findOne({ email });
    if (!student) return error(res, 'Usuario no encontrado.', 404);

    const code = generateCode();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    student.twoFactorCode = code;
    student.twoFactorExpiry = expiry;
    await student.save();

    await send2FACode(email, code);

    return success(res, null, 'Código enviado al correo.');
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/auth/verify-2fa
const verify2FA = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return error(res, 'Correo y código requeridos.', 400);

  try {
    const student = await Student.findOne({ email });
    if (!student) return error(res, 'Usuario no encontrado.', 404);

    if (!student.twoFactorCode || new Date() > student.twoFactorExpiry) {
      return error(res, 'Código inválido o expirado.', 400);
    }

    // Constant-time comparison to prevent timing attacks
    const storedBuffer = Buffer.from(student.twoFactorCode, 'utf8');
    const inputBuffer = Buffer.from(code, 'utf8');
    const codesMatch =
      storedBuffer.length === inputBuffer.length &&
      crypto.timingSafeEqual(storedBuffer, inputBuffer);

    if (!codesMatch) {
      return error(res, 'Código inválido o expirado.', 400);
    }

    student.twoFactorCode = null;
    student.twoFactorExpiry = null;
    await student.save();

    const token = generateToken({ id: student._id, email: student.email, role: 'student' });

    return success(res, { user: student, token }, 'Verificación exitosa');
  } catch (err) {
    return error(res, err.message);
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

module.exports = { register, login, send2FA, verify2FA, getMe };
