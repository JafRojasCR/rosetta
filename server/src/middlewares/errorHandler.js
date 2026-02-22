const { nodeEnv } = require('../config/env');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    success: false,
    message,
    ...(nodeEnv === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
