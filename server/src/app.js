const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { uploadDir } = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const fs = require('fs');

const app = express();

// Crear directorio de uploads si no existe
const uploadsPath = path.join(__dirname, '..', uploadDir);
if (!fs.existsSync(uploadsPath)) {
  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
  } catch (mkdirError) {
    console.error(`No se pudo crear directorio de uploads (${uploadsPath}):`, mkdirError.message);
  }
}

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const url = String(req.originalUrl || '');
    return (
      url.startsWith('/api/classes/recording-upload/') ||
      url.startsWith('/api/documents/upload/')
    );
  },
  message: { success: false, message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
});

// Dedicated limiter for chunked uploads (high threshold to avoid blocking large files)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muchas solicitudes de carga en poco tiempo. Espera un momento y continúa.',
  },
});

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de autenticación. Intenta de nuevo en 1 minuto.' },
});

app.use('/api', limiter);
app.use('/api/auth', authLimiter);
app.use('/api/classes/recording-upload', uploadLimiter);
app.use('/api/documents/upload', uploadLimiter);

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(uploadsPath));

// Rutas de la API
app.use('/api', routes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API Rosetta funcionando correctamente' });
});

// Manejador de errores global
app.use(errorHandler);

module.exports = app;
