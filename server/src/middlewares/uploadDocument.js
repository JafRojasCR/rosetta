const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { uploadDir, documentUploadMaxFileSizeMb } = require('../config/env');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/mpeg',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan PDF y videos.'), false);
  }
};

const uploadDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: documentUploadMaxFileSizeMb * 1024 * 1024 },
});

module.exports = uploadDocument;
