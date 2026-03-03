const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { error } = require('../utils/apiResponse');
const Student = require('../models/Student');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'No autorizado. Token requerido.', 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);

    let account = null;
    if (decoded?.role === 'admin') {
      account = await Admin.findById(decoded.id).select('sessionVersion');
    } else {
      account = await Student.findById(decoded.id).select('sessionVersion');
    }

    if (!account) {
      return error(res, 'Usuario no encontrado.', 401);
    }

    const tokenSessionVersion = Number(decoded?.sv ?? 0);
    const currentSessionVersion = Number(account.sessionVersion || 0);
    if (tokenSessionVersion !== currentSessionVersion) {
      return error(res, 'La sesión fue cerrada porque se inició en otro dispositivo.', 401, {
        code: 'SESSION_REVOKED',
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return error(res, 'Token inválido o expirado.', 401);
  }
};

// Verifies JWT if present but does not require it
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, jwtSecret);
    } catch (_) {
      // ignore invalid token for optional auth
    }
  }
  next();
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return error(res, 'Acceso restringido a administradores.', 403);
};

const studentOnly = (req, res, next) => {
  if (req.user && req.user.role === 'student') return next();
  return error(res, 'Acceso restringido a estudiantes.', 403);
};

module.exports = { protect, optionalAuth, adminOnly, studentOnly };
