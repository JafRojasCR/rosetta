const express = require('express');
const cors = require('cors');
const path = require('path');
const { uploadDir } = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const fs = require('fs');

const app = express();

// Crear directorio de uploads si no existe
const uploadsPath = path.join(__dirname, '..', uploadDir);
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
