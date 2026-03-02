const Document = require('../models/Document');
const { success, error } = require('../utils/apiResponse');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const path = require('path');
const { jwtSecret, uploadDir } = require('../config/env');
const {
  getDriveClient,
  uploadFileToGoogleDrive,
  deleteFileFromGoogleDrive,
  removeTempFile,
} = require('../services/googleDriveService');

const buildSecureVideoPlayerHtml = (streamUrl) => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reproductor</title>
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #f3f4f6; overflow: hidden; font-family: Poppins, system-ui, sans-serif; }
      .player-shell { width: 100%; height: 100%; position: relative; background: #111827; }
      .video-wrap { position: relative; width: 100%; height: 100%; background: #0f172a; }
      video { width: 100%; height: 100%; object-fit: contain; background: #0f172a; }
      .controls {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 12px;
        z-index: 30;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.58), rgba(30, 41, 59, 0.52));
        border: 1px solid rgba(255, 255, 255, 0.16);
        backdrop-filter: blur(14px) saturate(130%);
        -webkit-backdrop-filter: blur(14px) saturate(130%);
      }
      .btn { border: 0; outline: none; border-radius: 12px; cursor: pointer; background: #2563eb; color: #fff; font-weight: 700; font-size: 12px; width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; }
      .timeline { flex: 1; min-width: 0; appearance: none; height: 6px; border-radius: 999px; background: #374151; outline: none; }
      .timeline::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; border-radius: 999px; background: #3b82f6; cursor: pointer; }
      .time { color: #d1d5db; font-size: 12px; font-weight: 700; min-width: 90px; text-align: center; }
      .volume-wrap { display: flex; align-items: center; gap: 6px; }
      .vol-icon { color: #cbd5e1; font-size: 13px; font-weight: 700; line-height: 1; }
      .volume { flex: 0 0 66px; width: 66px; }
      @media (max-width: 768px) {
        .controls { gap: 8px; padding: 8px 10px; }
        .time, .volume-wrap { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="player-shell">
      <div class="video-wrap">
        <video id="resource-video" controlsList="nodownload noplaybackrate noremoteplayback nofullscreen" disablePictureInPicture playsinline webkit-playsinline x-webkit-airplay="deny" preload="metadata"></video>
      </div>

      <div class="controls">
        <button id="toggle-play" class="btn" type="button">▶</button>
        <input id="timeline" class="timeline" type="range" min="0" max="100" step="0.1" value="0" />
        <span id="time" class="time">00:00 / 00:00</span>
        <div class="volume-wrap">
          <span class="vol-icon">🔊</span>
          <input id="volume" class="timeline volume" type="range" min="0" max="1" step="0.01" value="1" />
        </div>
        <button id="toggle-full" class="btn" type="button">⛶</button>
      </div>
    </div>

    <script>
      const video = document.getElementById('resource-video');
      const playBtn = document.getElementById('toggle-play');
      const fullBtn = document.getElementById('toggle-full');
      const timeline = document.getElementById('timeline');
      const time = document.getElementById('time');
      const volume = document.getElementById('volume');

      video.src = ${JSON.stringify(streamUrl)};
      video.volume = 1;

      const toTime = (seconds) => {
        if (!Number.isFinite(seconds)) return '00:00';
        const value = Math.max(0, Math.floor(seconds));
        const m = String(Math.floor(value / 60)).padStart(2, '0');
        const s = String(value % 60).padStart(2, '0');
        return m + ':' + s;
      };

      const updateTimeUI = () => {
        const current = video.currentTime || 0;
        const total = video.duration || 0;
        const ratio = total > 0 ? (current / total) * 100 : 0;
        timeline.value = String(ratio);
        time.textContent = toTime(current) + ' / ' + toTime(total);
      };

      playBtn.addEventListener('click', () => {
        if (video.paused) video.play();
        else video.pause();
      });

      video.addEventListener('play', () => { playBtn.textContent = '❚❚'; });
      video.addEventListener('pause', () => { playBtn.textContent = '▶'; });
      video.addEventListener('loadedmetadata', updateTimeUI);
      video.addEventListener('timeupdate', updateTimeUI);

      timeline.addEventListener('input', () => {
        const total = video.duration || 0;
        if (total <= 0) return;
        video.currentTime = (Number(timeline.value) / 100) * total;
      });

      volume.addEventListener('input', () => {
        video.volume = Number(volume.value);
      });

      fullBtn.addEventListener('click', async () => {
        if (!document.fullscreenElement) {
          await (document.documentElement.requestFullscreen?.());
        } else {
          await document.exitFullscreen?.();
        }
      });

      document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
      document.addEventListener('keydown', function (event) {
        const key = (event.key || '').toLowerCase();
        const blocked = key === 'f12' || (event.ctrlKey && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) || (event.ctrlKey && (key === 's' || key === 'u')) || key === 'f';
        if (blocked) event.preventDefault();
      });
    </script>
  </body>
</html>`;

const resolveDocumentFromEmbedToken = async (token) => {
  const decoded = jwt.verify(token, jwtSecret);
  if (decoded?.type !== 'document_embed' || !decoded?.docId) {
    throw new Error('Token de documento inválido.');
  }

  const doc = await Document.findOne({ docId: decoded.docId });
  if (!doc) {
    throw new Error('Documento no encontrado.');
  }

  return { doc };
};

const extractGoogleDriveFileId = (url = '') => {
  const idFromQuery = url.match(/[?&]id=([^&]+)/);
  if (idFromQuery?.[1]) return idFromQuery[1];

  const idFromPath = url.match(/\/d\/([^/]+)/);
  if (idFromPath?.[1]) return idFromPath[1];

  return '';
};

// GET /api/documents
const getDocuments = async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = {};
    if (subjectId) filter['subject.subjectId'] = subjectId;

    const documents = await Document.find(filter).sort({ date: -1 });
    return success(res, documents);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/documents/:docId
const getDocumentById = async (req, res) => {
  try {
    const doc = await Document.findOne({ docId: req.params.docId });
    if (!doc) return error(res, 'Documento no encontrado.', 404);
    return success(res, doc);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/documents/:docId/embed-token
const getDocumentEmbedToken = async (req, res) => {
  try {
    const doc = await Document.findOne({ docId: req.params.docId });
    if (!doc) return error(res, 'Documento no encontrado.', 404);

    if (String(doc.type || '').toLowerCase() !== 'video') {
      return error(res, 'El visualizador de video solo aplica a recursos de video.', 400);
    }

    const token = jwt.sign(
      {
        type: 'document_embed',
        docId: doc.docId,
      },
      jwtSecret,
      { expiresIn: '2h' }
    );

    const iframeUrl = `/api/documents/embed/${token}`;
    return success(res, { iframeUrl, token });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/documents/embed/:token
const getDocumentEmbedByToken = async (req, res) => {
  try {
    const { doc } = await resolveDocumentFromEmbedToken(req.params.token);
    if (String(doc.type || '').toLowerCase() !== 'video') {
      return res.status(400).send('Este recurso no es un video.');
    }

    const streamUrl = `/api/documents/embed/${req.params.token}/stream`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(buildSecureVideoPlayerHtml(streamUrl));
  } catch (err) {
    return res.status(403).send(err.message || 'No autorizado para visualizar este recurso.');
  }
};

// GET /api/documents/embed/:token/stream
const getDocumentEmbedStreamByToken = async (req, res) => {
  try {
    const { doc } = await resolveDocumentFromEmbedToken(req.params.token);
    if (String(doc.type || '').toLowerCase() !== 'video') {
      return res.status(400).send('Este recurso no es un video.');
    }

    const fileUrl = String(doc.fileUrl || '');
    const driveFileId = doc.driveFileId || extractGoogleDriveFileId(fileUrl);
    if (driveFileId) {
      const drive = getDriveClient();
      if (!drive) return res.status(503).send('Google Drive deshabilitado.');

      const rangeHeader = req.headers.range;
      const driveResponse = await drive.files.get(
        {
          fileId: driveFileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        {
          responseType: 'stream',
          headers: rangeHeader ? { Range: rangeHeader } : undefined,
        }
      );

      const passthroughHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
      ];

      res.status(driveResponse.status || (rangeHeader ? 206 : 200));
      passthroughHeaders.forEach((headerName) => {
        const headerValue = driveResponse.headers?.[headerName];
        if (headerValue) {
          res.setHeader(headerName, headerValue);
        }
      });

      return driveResponse.data.pipe(res);
    }

    if (fileUrl.startsWith('/uploads/')) {
      const fileName = fileUrl.replace(/^\/uploads\//, '');
      const localPath = path.resolve(__dirname, '..', uploadDir, fileName);
      return res.sendFile(localPath);
    }

    return res.status(404).send('Formato de video no compatible para reproducción segura.');
  } catch (err) {
    return res.status(403).send(err.message || 'No se pudo reproducir el recurso.');
  }
};

// POST /api/documents (admin)
const createDocument = async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().allow('').optional(),
    subject: Joi.object({
      subjectId: Joi.string().required(),
      name: Joi.string().required(),
    }).required(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    if (!req.file) return error(res, 'Archivo requerido.', 400);

    let fileUrl = `/uploads/${req.file.filename}`;
    const type = req.file.mimetype.startsWith('video/') ? 'video' : 'pdf';

    const driveUpload = await uploadFileToGoogleDrive({
      filePath: req.file.path,
      fileName: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype,
    });

    if (driveUpload.uploaded && driveUpload.fileUrl) {
      fileUrl = driveUpload.fileUrl;
      await removeTempFile(req.file.path);
    }

    const docId = `DOC-${Date.now()}`;
    const doc = await Document.create({
      docId,
      ...value,
      type,
      date: new Date(),
      fileUrl,
      driveFileId: driveUpload.fileId || '',
      adminEmail: req.user.email,
    });

    return success(res, doc, 'Documento creado exitosamente', 201);
  } catch (err) {
    if (req.file?.path) {
      await removeTempFile(req.file.path);
    }
    return error(res, err.message);
  }
};

// PUT /api/documents/:docId (admin)
const updateDocument = async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().allow('').optional(),
    subject: Joi.object({
      subjectId: Joi.string().required(),
      name: Joi.string().required(),
    }).optional(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const doc = await Document.findOneAndUpdate(
      { docId: req.params.docId },
      value,
      { new: true, runValidators: true }
    );
    if (!doc) return error(res, 'Documento no encontrado.', 404);
    return success(res, doc, 'Documento actualizado exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/documents/:docId (admin)
const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findOne({ docId: req.params.docId });
    if (!doc) return error(res, 'Documento no encontrado.', 404);

    const driveFileId = doc.driveFileId || extractGoogleDriveFileId(doc.fileUrl || '');
    if (driveFileId) {
      await deleteFileFromGoogleDrive(driveFileId);
    }

    await Document.deleteOne({ _id: doc._id });
    return success(res, null, 'Documento eliminado exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  getDocuments,
  getDocumentById,
  getDocumentEmbedToken,
  getDocumentEmbedByToken,
  getDocumentEmbedStreamByToken,
  createDocument,
  updateDocument,
  deleteDocument,
};
