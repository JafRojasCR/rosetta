const Class = require('../models/Class');
const Payment = require('../models/Payment');
const jwt = require('jsonwebtoken');
const path = require('path');
const { success, error } = require('../utils/apiResponse');
const Joi = require('joi');
const { googleDriveClassesVideosFolderId, jwtSecret, uploadDir } = require('../config/env');
const {
  getDriveClient,
  uploadFileToGoogleDrive,
  deleteFileFromGoogleDrive,
  createResumableUploadSession,
  uploadChunkToResumableSession,
  finalizeDriveFileUpload,
  removeTempFile,
} = require('../services/googleDriveService');

const MAX_CLASS_UPLOAD_CHUNK_BYTES =
  process.env.VERCEL ? 4 * 1024 * 1024 : 32 * 1024 * 1024;

const classUploadInitSchema = Joi.object({
  fileName: Joi.string().trim().min(1).required(),
  mimeType: Joi.string().trim().min(1).required(),
  fileSize: Joi.number().integer().positive().required(),
});

const classUploadCompleteSchema = Joi.object({
  fileId: Joi.string().trim().min(1).required(),
});

const extractGoogleDriveFileId = (url = '') => {
  if (!url) return '';

  const idFromQuery = url.match(/[?&]id=([^&]+)/);
  if (idFromQuery?.[1]) return idFromQuery[1];

  const idFromPath = url.match(/\/d\/([^/]+)/);
  if (idFromPath?.[1]) return idFromPath[1];

  return '';
};

const isClassUnlockedForUser = (cls, userEmail) => {
  if (!userEmail) return false;

  const normalizedEmail = String(userEmail).toLowerCase();
  return (cls.classStudents || []).some(
    (entry) =>
      entry?.student?.email?.toLowerCase() === normalizedEmail &&
      entry?.unlocked === true
  );
};

const buildSecurePlayerHtml = (streamUrl) => `<!doctype html>
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
        background: linear-gradient(
          135deg,
          rgba(15, 23, 42, 0.58),
          rgba(30, 41, 59, 0.52)
        );
        border: 1px solid rgba(255, 255, 255, 0.16);
        backdrop-filter: blur(14px) saturate(130%);
        -webkit-backdrop-filter: blur(14px) saturate(130%);
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
        transition: opacity .35s ease, transform .35s ease, visibility .35s ease;
      }
      .controls::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 14px;
        pointer-events: none;
        background: rgba(255, 255, 255, 0.04);
      }
      .controls--hidden {
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        pointer-events: none;
      }
      .btn { border: 0; outline: none; border-radius: 12px; cursor: pointer; background: #2563eb; color: #fff; font-weight: 700; font-size: 12px; width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; transition: transform .2s ease, opacity .2s ease; }
      .btn:hover { transform: translateY(-1px); }
      .btn:active { transform: scale(.98); }
      .timeline { flex: 1; min-width: 0; appearance: none; height: 6px; border-radius: 999px; background: #374151; outline: none; }
      .timeline::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; border-radius: 999px; background: #3b82f6; cursor: pointer; }
      .time { color: #d1d5db; font-size: 12px; font-weight: 700; min-width: 90px; text-align: center; }
      .volume-wrap { display: flex; align-items: center; gap: 6px; }
      .vol-icon { color: #cbd5e1; font-size: 13px; font-weight: 700; line-height: 1; }
      .volume { flex: 0 0 66px; width: 66px; }
      .hint { color: #94a3b8; font-size: 11px; font-weight: 700; }
      @media (max-width: 768px) {
        .controls {
          gap: 8px;
          padding: 8px 10px;
        }
        .time,
        .volume-wrap {
          display: none;
        }
        .player-shell.mobile-fullscreen .time {
          display: block;
        }
        .player-shell.mobile-fullscreen .volume-wrap {
          display: flex;
        }
      }
    </style>
  </head>
  <body>
    <div class="player-shell">
      <div class="video-wrap">
      <video
        id="class-video"
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        disablePictureInPicture
        playsinline
        webkit-playsinline
        x-webkit-airplay="deny"
        preload="metadata"
      ></video>
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
      const video = document.getElementById('class-video');
      const playBtn = document.getElementById('toggle-play');
      const fullBtn = document.getElementById('toggle-full');
      const timeline = document.getElementById('timeline');
      const time = document.getElementById('time');
      const volume = document.getElementById('volume');
      const controls = document.querySelector('.controls');
      const videoWrap = document.querySelector('.video-wrap');
      const playerShell = document.querySelector('.player-shell');
      const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
      let controlsHideTimer = null;
      let mobileFullscreenActive = false;
      let previousOrientationType = null;
      let previousScrollY = 0;

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

      const clearControlsHideTimer = () => {
        if (controlsHideTimer) {
          clearTimeout(controlsHideTimer);
          controlsHideTimer = null;
        }
      };

      const showControls = () => {
        controls.classList.remove('controls--hidden');
      };

      const scheduleControlsHide = () => {
        clearControlsHideTimer();
        controlsHideTimer = setTimeout(() => {
          controls.classList.add('controls--hidden');
        }, 3000);
      };

      const wakeControls = () => {
        showControls();
        scheduleControlsHide();
      };

      const setMobileFullscreenMode = (active) => {
        if (!isMobileViewport) return;
        if (active) {
          playerShell.classList.add('mobile-fullscreen');
        } else {
          playerShell.classList.remove('mobile-fullscreen');
        }
      };

      const lockLandscape = async () => {
        try {
          await screen.orientation?.lock?.('landscape');
        } catch (_) {
          // no-op: some browsers block orientation lock
        }
      };

      const restoreOrientation = async () => {
        try {
          if (previousOrientationType && previousOrientationType.startsWith('portrait')) {
            await screen.orientation?.lock?.(previousOrientationType);
            return;
          }
          await screen.orientation?.lock?.('portrait-primary');
        } catch (_) {
          // no-op: some browsers block orientation lock
        }
      };

      const enforceLandscapeWhileFullscreen = async () => {
        if (!mobileFullscreenActive || !isMobileViewport) return;
        const orientationType = screen.orientation?.type || '';
        if (orientationType.startsWith('portrait')) {
          await lockLandscape();
        }
      };

      playBtn.addEventListener('click', () => {
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
        wakeControls();
      });

      video.addEventListener('play', () => {
        playBtn.textContent = '❚❚';
      });

      video.addEventListener('pause', () => {
        playBtn.textContent = '▶';
      });

      video.addEventListener('loadedmetadata', updateTimeUI);
      video.addEventListener('timeupdate', updateTimeUI);
      video.addEventListener('play', scheduleControlsHide);
      video.addEventListener('pause', wakeControls);
      video.addEventListener('seeking', wakeControls);

      timeline.addEventListener('input', () => {
        const total = video.duration || 0;
        if (total <= 0) return;
        video.currentTime = (Number(timeline.value) / 100) * total;
        wakeControls();
      });

      volume.addEventListener('input', () => {
        video.volume = Number(volume.value);
        wakeControls();
      });

      fullBtn.addEventListener('click', async () => {
        if (!document.fullscreenElement) {
          previousOrientationType = screen.orientation?.type || null;
          previousScrollY = window.scrollY || 0;
          await (playerShell.requestFullscreen?.() || document.documentElement.requestFullscreen?.());
          if (isMobileViewport) {
            mobileFullscreenActive = true;
            setMobileFullscreenMode(true);
            await lockLandscape();
          }
        } else {
          await document.exitFullscreen?.();
        }
        wakeControls();
      });

      document.addEventListener('mousemove', wakeControls);
      videoWrap.addEventListener('mousemove', wakeControls);
      controls.addEventListener('mousemove', wakeControls);
      document.addEventListener('touchstart', wakeControls, { passive: true });
      document.addEventListener('fullscreenchange', async () => {
        const isFullscreen = Boolean(document.fullscreenElement);

        if (!isFullscreen) {
          setMobileFullscreenMode(false);
          if (mobileFullscreenActive) {
            mobileFullscreenActive = false;
            await restoreOrientation();
            window.scrollTo({ top: previousScrollY, behavior: 'auto' });
          }
        } else if (isMobileViewport) {
          setMobileFullscreenMode(true);
        }

        wakeControls();
      });

      window.addEventListener('orientationchange', enforceLandscapeWhileFullscreen);
      window.addEventListener('resize', enforceLandscapeWhileFullscreen);
      screen.orientation?.addEventListener?.('change', enforceLandscapeWhileFullscreen);

      document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
      document.addEventListener('keydown', function (event) {
        const key = (event.key || '').toLowerCase();
        const blocked =
          key === 'f12' ||
          (event.ctrlKey && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
          (event.ctrlKey && (key === 's' || key === 'u')) ||
          key === 'f';
        if (blocked) event.preventDefault();
      });

      video.addEventListener('webkitbeginfullscreen', function (event) { event.preventDefault?.(); });
      video.addEventListener('enterpictureinpicture', () => {
        document.exitPictureInPicture?.();
      });

      wakeControls();
    </script>
  </body>
</html>`;

const resolveEmbedContext = async (token) => {
  const decoded = jwt.verify(token, jwtSecret);
  if (decoded?.type !== 'class_embed' || !decoded?.classCode) {
    return { denied: true, code: 403, message: 'Acceso no permitido.' };
  }

  const cls = await Class.findOne({ classCode: decoded.classCode });
  if (!cls) return { denied: true, code: 404, message: 'Clase no encontrada.' };

  const isAdmin = decoded.role === 'admin';
  const canAccess = isAdmin || isClassUnlockedForUser(cls, decoded.email);
  if (!canAccess) return { denied: true, code: 403, message: 'Clase bloqueada.' };

  return { denied: false, decoded, cls };
};

const safeJsonParse = (value, fallback) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
};

const normalizeClassPayload = (body = {}) => {
  const payload = { ...body };

  if (payload.subject && typeof payload.subject === 'string') {
    payload.subject = safeJsonParse(payload.subject, payload.subject);
  }

  if (!payload.subject && (body['subject[subjectId]'] || body['subject[name]'])) {
    payload.subject = {
      subjectId: body['subject[subjectId]'],
      name: body['subject[name]'],
    };
  }

  if (payload.classStudents && typeof payload.classStudents === 'string') {
    payload.classStudents = safeJsonParse(payload.classStudents, []);
  }

  if (typeof payload.isPublic === 'string') {
    payload.isPublic = payload.isPublic === 'true';
  }

  if (typeof payload.price === 'string') {
    payload.price = Number(payload.price);
  }

  return payload;
};

const voteSchema = Joi.object({
  vote: Joi.string().valid('1', '-1').allow(null).required(),
});

// GET /api/classes
const getClasses = async (req, res) => {
  try {
    const { subjectId, isPublic, date } = req.query;
    const filter = {};
    if (subjectId) filter['subject.subjectId'] = subjectId;
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
    if (date) {
      const normalizedDate = new Date(date);
      if (Number.isNaN(normalizedDate.getTime())) {
        return error(res, 'Fecha invalida para filtrar clases.', 400);
      }

      const startOfDay = new Date(normalizedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(normalizedDate);
      endOfDay.setHours(23, 59, 59, 999);

      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const classes = await Class.find(filter).sort({ date: -1 });
    return success(res, classes);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/classes/:classCode
const getClassByCode = async (req, res) => {
  try {
    const cls = await Class.findOne({ classCode: req.params.classCode });
    if (!cls) return error(res, 'Clase no encontrada.', 404);

    // Si hay un usuario autenticado, verificar si pagó
    let hasPaid = false;
    if (req.user) {
      const payment = await Payment.findOne({
        studentEmail: req.user.email,
        classCode: cls.classCode,
        status: 'aprobado',
      });
      hasPaid = !!payment;
    }

    const classData = cls.toObject();
    if (!hasPaid && !cls.isPublic) {
      classData.recordingUrl = null;
      classData.canvaUrl = null;
    }

    return success(res, { ...classData, hasPaid });
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/classes (admin)
const createClass = async (req, res) => {
  const schema = Joi.object({
    classCode: Joi.string().required(),
    title: Joi.string().required(),
    description: Joi.string().allow('').optional(),
    date: Joi.date().required(),
    isPublic: Joi.boolean().default(false),
    price: Joi.number().min(0).required(),
    recordingUrl: Joi.string().uri().allow(null, '').optional(),
    canvaUrl: Joi.string().uri().allow(null, '').optional(),
    subject: Joi.object({
      subjectId: Joi.string().required(),
      name: Joi.string().required(),
    }).required(),
    adminEmail: Joi.string().email().optional(),
    classStudents: Joi.array()
      .items(
        Joi.object({
          student: Joi.object({
            id: Joi.string().required(),
            email: Joi.string().email().required(),
            name: Joi.string().required(),
            lastName: Joi.string().required(),
            phone: Joi.string().allow('').optional(),
          }).required(),
          type: Joi.string().valid('normal', 'tutored').default('normal'),
          unlocked: Joi.boolean().default(false),
          unlockedAt: Joi.date().allow(null).optional(),
          paymentDate: Joi.date().allow(null).optional(),
          vote: Joi.string().valid('1', '-1').allow(null).optional(),
        })
      )
      .optional(),
  });

  const normalizedBody = normalizeClassPayload(req.body);
  const { error: validationError, value } = schema.validate(normalizedBody);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const existing = await Class.findOne({ classCode: value.classCode });
    if (existing) return error(res, 'Ya existe una clase con ese código.', 409);

    let recordingUrl = value.recordingUrl || null;
    let canvaUrl = value.canvaUrl || null;

    const recordingFile = req.files?.recordingFile?.[0];
    const canvaFile = req.files?.canvaFile?.[0];

    if (recordingFile) {
      const uploaded = await uploadFileToGoogleDrive({
        filePath: recordingFile.path,
        fileName: recordingFile.originalname || recordingFile.filename,
        mimeType: recordingFile.mimetype,
        folderId: googleDriveClassesVideosFolderId,
      });

      if (uploaded.uploaded && uploaded.fileUrl) {
        recordingUrl = uploaded.fileUrl;
        await removeTempFile(recordingFile.path);
      } else {
        recordingUrl = `/uploads/${recordingFile.filename}`;
      }
    }

    if (canvaFile) {
      const uploaded = await uploadFileToGoogleDrive({
        filePath: canvaFile.path,
        fileName: canvaFile.originalname || canvaFile.filename,
        mimeType: canvaFile.mimetype,
      });

      if (uploaded.uploaded && uploaded.fileUrl) {
        canvaUrl = uploaded.fileUrl;
        await removeTempFile(canvaFile.path);
      } else {
        canvaUrl = `/uploads/${canvaFile.filename}`;
      }
    }

    const cls = await Class.create({
      ...value,
      recordingUrl,
      canvaUrl,
      adminEmail: value.adminEmail || req.user.email,
    });
    return success(res, cls, 'Clase creada exitosamente', 201);
  } catch (err) {
    await removeTempFile(req.files?.recordingFile?.[0]?.path);
    await removeTempFile(req.files?.canvaFile?.[0]?.path);
    return error(res, err.message);
  }
};

// POST /api/classes/recording-upload/init (admin)
const initClassRecordingUpload = async (req, res) => {
  const { error: validationError, value } = classUploadInitSchema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    if (!/^video\//i.test(String(value.mimeType || ''))) {
      return error(res, 'Solo se permite carga por chunks para archivos de video.', 400);
    }

    const session = await createResumableUploadSession({
      fileName: value.fileName,
      mimeType: value.mimeType,
      fileSize: value.fileSize,
      folderId: googleDriveClassesVideosFolderId,
    });

    return success(res, {
      uploadUrl: session.uploadUrl,
      chunkSize: MAX_CLASS_UPLOAD_CHUNK_BYTES,
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/classes/recording-upload/chunk (admin)
const uploadClassRecordingChunk = async (req, res) => {
  const uploadUrl = String(req.headers['x-upload-url'] || '').trim();
  const mimeType = String(req.headers['x-mime-type'] || 'application/octet-stream').trim();
  const fileSize = Number.parseInt(String(req.headers['x-file-size'] || ''), 10);
  const chunkStart = Number.parseInt(String(req.headers['x-chunk-start'] || ''), 10);
  const chunkEnd = Number.parseInt(String(req.headers['x-chunk-end'] || ''), 10);
  const chunkBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

  if (!uploadUrl) return error(res, 'Falta URL de sesion de subida.', 400);
  if (!Number.isFinite(fileSize) || fileSize <= 0) return error(res, 'Tamano total invalido.', 400);
  if (!Number.isFinite(chunkStart) || chunkStart < 0) return error(res, 'Inicio de chunk invalido.', 400);
  if (!Number.isFinite(chunkEnd) || chunkEnd < chunkStart) return error(res, 'Fin de chunk invalido.', 400);
  if (chunkBuffer.length === 0) return error(res, 'Chunk vacio.', 400);
  if (chunkBuffer.length > MAX_CLASS_UPLOAD_CHUNK_BYTES) {
    return error(res, `El chunk supera ${MAX_CLASS_UPLOAD_CHUNK_BYTES} bytes.`, 400);
  }

  const expectedLength = chunkEnd - chunkStart + 1;
  if (expectedLength !== chunkBuffer.length) {
    return error(res, 'Rango de chunk no coincide con el tamano enviado.', 400);
  }

  try {
    const result = await uploadChunkToResumableSession({
      uploadUrl,
      chunkBuffer,
      chunkStart,
      chunkEnd,
      fileSize,
      mimeType,
    });

    return success(res, {
      done: Boolean(result.done),
      fileId: result.fileId || null,
      fileUrl: result.fileUrl || null,
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/classes/recording-upload/complete (admin)
const completeClassRecordingUpload = async (req, res) => {
  const { error: validationError, value } = classUploadCompleteSchema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const finalized = await finalizeDriveFileUpload({ fileId: value.fileId });
    if (!finalized.fileUrl) {
      return error(res, 'No se pudo obtener la URL pública del video en Drive.', 500);
    }

    return success(res, {
      fileId: finalized.fileId,
      fileUrl: finalized.fileUrl,
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/classes/:classCode (admin)
const updateClass = async (req, res) => {
  const schema = Joi.object({
    classCode: Joi.string().optional(),
    title: Joi.string().optional(),
    description: Joi.string().allow('').optional(),
    date: Joi.date().optional(),
    isPublic: Joi.boolean().optional(),
    price: Joi.number().min(0).optional(),
    recordingUrl: Joi.string().uri().allow(null, '').optional(),
    canvaUrl: Joi.string().uri().allow(null, '').optional(),
    subject: Joi.object({
      subjectId: Joi.string().required(),
      name: Joi.string().required(),
    }).optional(),
    adminEmail: Joi.string().email().optional(),
    classStudents: Joi.array()
      .items(
        Joi.object({
          student: Joi.object({
            id: Joi.string().required(),
            email: Joi.string().email().required(),
            name: Joi.string().required(),
            lastName: Joi.string().required(),
            phone: Joi.string().allow('').optional(),
          }).required(),
          type: Joi.string().valid('normal', 'tutored').default('normal'),
          unlocked: Joi.boolean().default(false),
          unlockedAt: Joi.date().allow(null).optional(),
          paymentDate: Joi.date().allow(null).optional(),
          vote: Joi.string().valid('1', '-1').allow(null).optional(),
        })
      )
      .optional(),
  });

  const normalizedBody = normalizeClassPayload(req.body);
  const { error: validationError, value } = schema.validate(normalizedBody);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const existingClass = await Class.findOne({ classCode: req.params.classCode });
    if (!existingClass) return error(res, 'Clase no encontrada.', 404);

    const updateData = { ...value };
        if (Array.isArray(updateData.classStudents)) {
          const voteByEmail = (existingClass.classStudents || []).reduce((accumulator, entry) => {
            const email = String(entry?.student?.email || '').toLowerCase();
            if (!email) return accumulator;

            if (entry?.vote === '1' || entry?.vote === '-1' || entry?.vote === null) {
              accumulator[email] = entry.vote;
            }
            return accumulator;
          }, {});

          updateData.classStudents = updateData.classStudents.map((entry) => {
            const email = String(entry?.student?.email || '').toLowerCase();
            return {
              ...entry,
              vote:
                entry?.vote === '1' || entry?.vote === '-1' || entry?.vote === null
                  ? entry.vote
                  : voteByEmail[email] ?? null,
            };
          });
        }

    const nextClassCode = String(updateData.classCode || '').trim();
    const willChangeClassCode =
      Boolean(nextClassCode) && nextClassCode !== existingClass.classCode;

    if (willChangeClassCode) {
      const duplicated = await Class.findOne({ classCode: nextClassCode });
      if (duplicated) {
        return error(res, 'Ya existe una clase con ese código.', 409);
      }

      updateData.classCode = nextClassCode;
    } else {
      delete updateData.classCode;
    }

    const recordingFile = req.files?.recordingFile?.[0];
    const canvaFile = req.files?.canvaFile?.[0];

    if (recordingFile) {
      const uploaded = await uploadFileToGoogleDrive({
        filePath: recordingFile.path,
        fileName: recordingFile.originalname || recordingFile.filename,
        mimeType: recordingFile.mimetype,
        folderId: googleDriveClassesVideosFolderId,
      });

      if (uploaded.uploaded && uploaded.fileUrl) {
        updateData.recordingUrl = uploaded.fileUrl;
        await removeTempFile(recordingFile.path);

        const previousRecordingFileId = extractGoogleDriveFileId(existingClass.recordingUrl || '');
        const newRecordingFileId = extractGoogleDriveFileId(updateData.recordingUrl || '');
        if (previousRecordingFileId && previousRecordingFileId !== newRecordingFileId) {
          try {
            await deleteFileFromGoogleDrive(previousRecordingFileId);
          } catch (_) {
            // no-op: avoid blocking class update if old Drive file cannot be deleted
          }
        }
      } else {
        updateData.recordingUrl = `/uploads/${recordingFile.filename}`;
      }
    } else if (
      typeof updateData.recordingUrl === 'string' &&
      updateData.recordingUrl &&
      updateData.recordingUrl !== existingClass.recordingUrl
    ) {
      const previousRecordingFileId = extractGoogleDriveFileId(existingClass.recordingUrl || '');
      const newRecordingFileId = extractGoogleDriveFileId(updateData.recordingUrl || '');
      if (previousRecordingFileId && previousRecordingFileId !== newRecordingFileId) {
        try {
          await deleteFileFromGoogleDrive(previousRecordingFileId);
        } catch (_) {
          // no-op: avoid blocking class update if old Drive file cannot be deleted
        }
      }
    }

    if (canvaFile) {
      const uploaded = await uploadFileToGoogleDrive({
        filePath: canvaFile.path,
        fileName: canvaFile.originalname || canvaFile.filename,
        mimeType: canvaFile.mimetype,
      });

      if (uploaded.uploaded && uploaded.fileUrl) {
        updateData.canvaUrl = uploaded.fileUrl;
        await removeTempFile(canvaFile.path);
      } else {
        updateData.canvaUrl = `/uploads/${canvaFile.filename}`;
      }
    }

    const cls = await Class.findByIdAndUpdate(existingClass._id, updateData, {
      new: true,
      runValidators: true,
    });

    if (willChangeClassCode) {
      await Payment.updateMany(
        { classCode: existingClass.classCode },
        { $set: { classCode: nextClassCode } }
      );
    }

    return success(res, cls, 'Clase actualizada exitosamente');
  } catch (err) {
    await removeTempFile(req.files?.recordingFile?.[0]?.path);
    await removeTempFile(req.files?.canvaFile?.[0]?.path);
    return error(res, err.message);
  }
};

// PATCH /api/classes/:classCode/vote (student)
const setClassVote = async (req, res) => {
  const { error: validationError, value } = voteSchema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const userEmail = String(req.user?.email || '').toLowerCase();
    if (!userEmail) {
      return error(res, 'No se pudo identificar al estudiante.', 401);
    }

    const cls = await Class.findOne({ classCode: req.params.classCode });
    if (!cls) return error(res, 'Clase no encontrada.', 404);

    const studentEntryIndex = (cls.classStudents || []).findIndex(
      (entry) =>
        String(entry?.student?.email || '').toLowerCase() === userEmail &&
        entry?.unlocked === true
    );

    if (studentEntryIndex < 0) {
      return error(res, 'Solo puedes votar clases desbloqueadas para tu cuenta.', 403);
    }

    const normalizedVote = value.vote === '1' || value.vote === '-1' ? value.vote : null;
    cls.classStudents[studentEntryIndex].vote = normalizedVote;
    await cls.save();

    return success(
      res,
      {
        classCode: cls.classCode,
        vote: normalizedVote,
      },
      'Voto actualizado correctamente.'
    );
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/classes/:classCode (admin)
const deleteClass = async (req, res) => {
  try {
    const cls = await Class.findOne({ classCode: req.params.classCode });
    if (!cls) return error(res, 'Clase no encontrada.', 404);

    const recordingFileId = extractGoogleDriveFileId(cls.recordingUrl || '');
    const canvaFileId = extractGoogleDriveFileId(cls.canvaUrl || '');

    if (recordingFileId) {
      await deleteFileFromGoogleDrive(recordingFileId);
    }

    if (canvaFileId) {
      await deleteFileFromGoogleDrive(canvaFileId);
    }

    await Payment.deleteMany({ classCode: cls.classCode });

    await Class.deleteOne({ _id: cls._id });
    return success(res, null, 'Clase eliminada exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/classes/:classCode/embed-token
const getClassEmbedToken = async (req, res) => {
  try {
    const cls = await Class.findOne({ classCode: req.params.classCode });
    if (!cls) return error(res, 'Clase no encontrada.', 404);

    const isAdmin = req.user?.role === 'admin';
    const canAccess = isAdmin || isClassUnlockedForUser(cls, req.user?.email);

    if (!canAccess) {
      return error(res, 'Clase bloqueada para este estudiante.', 403);
    }

    if (!cls.recordingUrl) {
      return error(res, 'Esta clase no tiene video disponible.', 404);
    }

    const token = jwt.sign(
      {
        type: 'class_embed',
        classCode: cls.classCode,
        email: req.user?.email || '',
        role: req.user?.role || 'student',
      },
      jwtSecret,
      { expiresIn: '3h' }
    );

    return success(res, { token, iframeUrl: `/api/classes/embed/${token}` });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/classes/embed/:token
const getClassEmbedByToken = async (req, res) => {
  try {
    const context = await resolveEmbedContext(req.params.token);
    if (context.denied) {
      return res.status(context.code).send(context.message);
    }

    if (!context.cls.recordingUrl) return res.status(404).send('Video no disponible.');

    const streamUrl = `/api/classes/embed/${req.params.token}/stream`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildSecurePlayerHtml(streamUrl));
  } catch (_err) {
    return res.status(403).send('Token de reproducción inválido o expirado.');
  }
};

// GET /api/classes/embed/:token/stream
const getClassEmbedStreamByToken = async (req, res) => {
  try {
    const context = await resolveEmbedContext(req.params.token);
    if (context.denied) {
      return res.status(context.code).send(context.message);
    }

    const recordingUrl = context.cls.recordingUrl || '';
    if (!recordingUrl) return res.status(404).send('Video no disponible.');

    const driveFileId = extractGoogleDriveFileId(recordingUrl);
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

    if (recordingUrl.startsWith('/uploads/')) {
      const fileName = recordingUrl.replace(/^\/uploads\//, '');
      const localPath = path.resolve(__dirname, '..', uploadDir, fileName);
      return res.sendFile(localPath);
    }

    return res.status(404).send('Formato de video no compatible para reproducción segura.');
  } catch (err) {
    return res.status(403).send(err.message || 'No se pudo reproducir el video.');
  }
};

module.exports = {
  getClasses,
  getClassByCode,
  createClass,
  initClassRecordingUpload,
  uploadClassRecordingChunk,
  completeClassRecordingUpload,
  updateClass,
  deleteClass,
  getClassEmbedToken,
  getClassEmbedByToken,
  getClassEmbedStreamByToken,
  setClassVote,
};
