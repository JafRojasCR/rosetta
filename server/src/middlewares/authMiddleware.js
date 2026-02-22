const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { error } = require('../utils/apiResponse');

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'No autorizado. Token requerido.', 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
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
