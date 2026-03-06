const Document = require('../models/Document');
const { success, error } = require('../utils/apiResponse');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const path = require('path');
const {
  jwtSecret,
  uploadDir,
  documentUploadMaxFileSizeMb,
} = require('../config/env');
const {
  generateObjectKey,
  getSignedUploadUrl,
  getSignedDownloadUrl,
  ensureObjectExists,
  uploadFileToGcs,
  deleteFileFromGcs,
  removeTempFile,
} = require('../services/googleCloudStorageService');
const {
  getDriveClient,
  deleteFileFromGoogleDrive,
} = require('../services/googleDriveService');

const MAX_DOCUMENT_UPLOAD_SIZE_BYTES = documentUploadMaxFileSizeMb * 1024 * 1024;

const documentUploadInitSchema = Joi.object({
  fileName: Joi.string().trim().min(1).required(),
  mimeType: Joi.string().trim().min(1).required(),
  fileSize: Joi.number().integer().positive().required(),
});

const documentUploadCompleteSchema = Joi.object({
  objectKey: Joi.string().trim().min(1).required(),
  mimeType: Joi.string().trim().min(1).required(),
});

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
      @media (max-width: 768px) and (orientation: landscape) {
        .time { display: block; }
        .volume-wrap { display: flex; }
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
        const h = Math.floor(value / 3600);
        const m = String(Math.floor((value % 3600) / 60)).padStart(2, '0');
        const s = String(value % 60).padStart(2, '0');
        if (h > 0) return h + ':' + m + ':' + s;
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

const isGcsDocument = (doc) =>
  String(doc?.storageProvider || '').toLowerCase() === 'gcs' &&
  String(doc?.storageObjectKey || '').trim();

const buildDocumentAccessApiUrl = (docId, mode = 'download') =>
  `/api/documents/${encodeURIComponent(String(docId || ''))}/access-url?mode=${encodeURIComponent(
    mode
  )}`;

// GET /api/documents
const getDocuments = async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = {};
    if (subjectId) filter['subject.subjectId'] = subjectId;

    const documents = await Document.find(filter).sort({ date: -1 }).lean();
    const mapped = documents.map((doc) => ({
      ...doc,
      fileUrl: isGcsDocument(doc) ? buildDocumentAccessApiUrl(doc.docId, 'download') : doc.fileUrl,
    }));

    return success(res, mapped);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/documents/:docId
const getDocumentById = async (req, res) => {
  try {
    const doc = await Document.findOne({ docId: req.params.docId }).lean();
    if (!doc) return error(res, 'Documento no encontrado.', 404);
    const mapped = {
      ...doc,
      fileUrl: isGcsDocument(doc) ? buildDocumentAccessApiUrl(doc.docId, 'download') : doc.fileUrl,
    };

    return success(res, mapped);
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

    if (isGcsDocument(doc)) {
      const signed = await getSignedDownloadUrl({
        objectKey: doc.storageObjectKey,
        inline: true,
      });

      return res.redirect(302, signed.downloadUrl);
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

// GET /api/documents/:docId/access-url
const getDocumentAccessUrl = async (req, res) => {
  try {
    const mode = String(req.query.mode || 'download').toLowerCase();
    const inline = mode === 'inline';

    const doc = await Document.findOne({ docId: req.params.docId });
    if (!doc) return error(res, 'Documento no encontrado.', 404);

    if (isGcsDocument(doc)) {
      const signed = await getSignedDownloadUrl({
        objectKey: doc.storageObjectKey,
        inline,
      });

      return success(res, {
        accessUrl: signed.downloadUrl,
        expiresIn: signed.expiresIn,
      });
    }

    return success(res, {
      accessUrl: doc.fileUrl || '',
      expiresIn: null,
    });
  } catch (err) {
    return error(res, err.message);
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
    fileUrl: Joi.string().uri().allow('').optional(),
    driveFileId: Joi.string().allow('').optional(),
    storageObjectKey: Joi.string().allow('').optional(),
    storageProvider: Joi.string().valid('gcs', 'drive', 'local').optional(),
    mimeType: Joi.string().allow('').optional(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    let fileUrl = '';
    let driveFileId = '';
    let storageObjectKey = '';
    let storageProvider = 'gcs';
    let mimeType = '';

    if (req.file) {
      mimeType = req.file.mimetype;

      const objectKey = generateObjectKey({ type: 'documents', fileName: req.file.originalname });
      await uploadFileToGcs({
        filePath: req.file.path,
        objectKey,
        mimeType,
      });

      storageObjectKey = objectKey;
      storageProvider = 'gcs';
      await removeTempFile(req.file.path);
    } else if (value.storageObjectKey && value.mimeType) {
      storageObjectKey = String(value.storageObjectKey || '').trim();
      storageProvider = 'gcs';
      mimeType = value.mimeType;
    } else if (value.fileUrl && value.driveFileId && value.mimeType) {
      fileUrl = value.fileUrl;
      driveFileId = value.driveFileId;
      storageProvider = 'drive';
      mimeType = value.mimeType;
    } else {
      return error(res, 'Archivo requerido.', 400);
    }

    const type = String(mimeType || '').startsWith('video/') ? 'video' : 'pdf';

    const docId = `DOC-${Date.now()}`;
    const doc = await Document.create({
      docId,
      ...value,
      type,
      date: new Date(),
      fileUrl: fileUrl || buildDocumentAccessApiUrl(docId, 'download'),
      driveFileId,
      storageProvider,
      storageObjectKey,
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

// POST /api/documents/upload/init (admin)
const initDocumentUpload = async (req, res) => {
  const { error: validationError, value } = documentUploadInitSchema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  if (value.fileSize > MAX_DOCUMENT_UPLOAD_SIZE_BYTES) {
    return error(
      res,
      `El archivo supera el limite permitido de ${documentUploadMaxFileSizeMb} MB para recursos.`,
      400
    );
  }

  try {
    const objectKey = generateObjectKey({
      type: 'documents',
      fileName: value.fileName,
    });
    const signed = await getSignedUploadUrl({ objectKey, mimeType: value.mimeType });

    return success(res, {
      uploadUrl: signed.uploadUrl,
      objectKey,
      expiresIn: signed.expiresIn,
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/documents/upload/complete (admin)
const completeDocumentUpload = async (req, res) => {
  const { error: validationError, value } = documentUploadCompleteSchema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const exists = await ensureObjectExists(value.objectKey);
    if (!exists) {
      return error(res, 'No se encontro el archivo cargado en GCS.', 404);
    }

    return success(res, {
      storageProvider: 'gcs',
      objectKey: value.objectKey,
      mimeType: value.mimeType,
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/documents/upload/chunk (admin)
const uploadDocumentChunk = async (req, res) => {
  return error(
    res,
    'La carga por chunks fue reemplazada por carga directa firmada a GCS. Usa /upload/init y /upload/complete.',
    410
  );
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

    if (isGcsDocument(doc)) {
      await deleteFileFromGcs(doc.storageObjectKey);
    }

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
  getDocumentAccessUrl,
  initDocumentUpload,
  uploadDocumentChunk,
  completeDocumentUpload,
  createDocument,
  updateDocument,
  deleteDocument,
};
