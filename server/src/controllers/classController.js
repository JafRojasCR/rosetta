const Class = require('../models/Class');
const Payment = require('../models/Payment');
const jwt = require('jsonwebtoken');
const path = require('path');
const { success, error } = require('../utils/apiResponse');
const Joi = require('joi');
const { jwtSecret, uploadDir } = require('../config/env');
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

const classUploadInitSchema = Joi.object({
  fileName: Joi.string().trim().min(1).required(),
  mimeType: Joi.string().trim().min(1).required(),
  fileSize: Joi.number().integer().positive().required(),
});

const classUploadCompleteSchema = Joi.object({
  objectKey: Joi.string().trim().min(1).required(),
  mimeType: Joi.string().trim().min(1).required(),
});

const extractGoogleDriveFileId = (url = '') => {
  if (!url) return '';

  const idFromQuery = url.match(/[?&]id=([^&]+)/);
  if (idFromQuery?.[1]) return idFromQuery[1];

  const idFromPath = url.match(/\/d\/([^/]+)/);
  if (idFromPath?.[1]) return idFromPath[1];

  return '';
};

const isGcsClassObject = (provider = '', objectKey = '') =>
  String(provider || '').toLowerCase() === 'gcs' && Boolean(String(objectKey || '').trim());

const buildClassRecordingAccessApiUrl = (classCode = '') =>
  `/api/classes/${encodeURIComponent(String(classCode || ''))}/recording-access`;

const buildClassCanvaAccessApiUrl = (classCode = '') =>
  `/api/classes/${encodeURIComponent(String(classCode || ''))}/canva-access`;

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
    const { subjectId, isPublic, date, fields } = req.query;
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

    const projection =
      fields === 'minimal'
        ? { classCode: 1, date: 1, 'subject.subjectId': 1 }
        : {
            classCode: 1,
            title: 1,
            description: 1,
            date: 1,
            isPublic: 1,
            price: 1,
            recordingUrl: 1,
            canvaUrl: 1,
            subject: 1,
            adminEmail: 1,
            classStudents: 1,
            createdAt: 1,
            updatedAt: 1,
          };

    const classes = await Class.find(filter).select(projection).sort({ date: -1 }).lean();
    const mapped = classes.map((cls) => ({
      ...cls,
      recordingUrl: isGcsClassObject(cls.recordingStorageProvider, cls.recordingStorageObjectKey)
        ? buildClassRecordingAccessApiUrl(cls.classCode)
        : cls.recordingUrl,
      canvaUrl: isGcsClassObject(cls.canvaStorageProvider, cls.canvaStorageObjectKey)
        ? buildClassCanvaAccessApiUrl(cls.classCode)
        : cls.canvaUrl,
    }));

    return success(res, mapped);
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
    if (isGcsClassObject(classData.recordingStorageProvider, classData.recordingStorageObjectKey)) {
      classData.recordingUrl = buildClassRecordingAccessApiUrl(classData.classCode);
    }
    if (isGcsClassObject(classData.canvaStorageProvider, classData.canvaStorageObjectKey)) {
      classData.canvaUrl = buildClassCanvaAccessApiUrl(classData.classCode);
    }

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
    recordingUrl: Joi.string().allow(null, '').optional(),
    recordingStorageObjectKey: Joi.string().allow('').optional(),
    canvaUrl: Joi.string().allow(null, '').optional(),
    canvaStorageObjectKey: Joi.string().allow('').optional(),
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
    let recordingStorageObjectKey = String(value.recordingStorageObjectKey || '').trim();
    let recordingStorageProvider = recordingStorageObjectKey ? 'gcs' : 'drive';
    let canvaUrl = value.canvaUrl || null;
    let canvaStorageObjectKey = String(value.canvaStorageObjectKey || '').trim();
    let canvaStorageProvider = canvaStorageObjectKey ? 'gcs' : 'drive';

    const recordingFile = req.files?.recordingFile?.[0];
    const canvaFile = req.files?.canvaFile?.[0];

    if (recordingFile) {
      const recordingKey = generateObjectKey({
        type: 'classes',
        fileName: recordingFile.originalname || recordingFile.filename,
      });
      await uploadFileToGcs({
        filePath: recordingFile.path,
        objectKey: recordingKey,
        mimeType: recordingFile.mimetype,
      });

      recordingStorageProvider = 'gcs';
      recordingStorageObjectKey = recordingKey;
      await removeTempFile(recordingFile.path);
    }

    if (canvaFile) {
      const canvaKey = generateObjectKey({
        type: 'classes',
        fileName: canvaFile.originalname || canvaFile.filename,
      });
      await uploadFileToGcs({
        filePath: canvaFile.path,
        objectKey: canvaKey,
        mimeType: canvaFile.mimetype,
      });

      canvaStorageProvider = 'gcs';
      canvaStorageObjectKey = canvaKey;
      await removeTempFile(canvaFile.path);
    }

    if (recordingStorageObjectKey) {
      recordingUrl = buildClassRecordingAccessApiUrl(value.classCode);
    }

    if (canvaStorageObjectKey) {
      canvaUrl = buildClassCanvaAccessApiUrl(value.classCode);
    }

    const cls = await Class.create({
      ...value,
      recordingUrl,
      recordingStorageProvider,
      recordingStorageObjectKey,
      canvaUrl,
      canvaStorageProvider,
      canvaStorageObjectKey,
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

    const objectKey = generateObjectKey({
      type: 'classes',
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

// PUT /api/classes/recording-upload/chunk (admin)
const uploadClassRecordingChunk = async (req, res) => {
  return error(
    res,
    'La carga por chunks fue reemplazada por carga directa firmada a GCS. Usa /recording-upload/init y /recording-upload/complete.',
    410
  );
};

// POST /api/classes/recording-upload/complete (admin)
const completeClassRecordingUpload = async (req, res) => {
  const { error: validationError, value } = classUploadCompleteSchema.validate(req.body || {});
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

// PUT /api/classes/:classCode (admin)
const updateClass = async (req, res) => {
  const schema = Joi.object({
    classCode: Joi.string().optional(),
    title: Joi.string().optional(),
    description: Joi.string().allow('').optional(),
    date: Joi.date().optional(),
    isPublic: Joi.boolean().optional(),
    price: Joi.number().min(0).optional(),
    recordingUrl: Joi.string().allow(null, '').optional(),
    recordingStorageObjectKey: Joi.string().allow('').optional(),
    canvaUrl: Joi.string().allow(null, '').optional(),
    canvaStorageObjectKey: Joi.string().allow('').optional(),
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
      const recordingKey = generateObjectKey({
        type: 'classes',
        fileName: recordingFile.originalname || recordingFile.filename,
      });

      await uploadFileToGcs({
        filePath: recordingFile.path,
        objectKey: recordingKey,
        mimeType: recordingFile.mimetype,
      });

      updateData.recordingStorageProvider = 'gcs';
      updateData.recordingStorageObjectKey = recordingKey;
      updateData.recordingUrl = buildClassRecordingAccessApiUrl(
        willChangeClassCode ? nextClassCode : existingClass.classCode
      );
      await removeTempFile(recordingFile.path);

      if (isGcsClassObject(existingClass.recordingStorageProvider, existingClass.recordingStorageObjectKey)) {
        await deleteFileFromGcs(existingClass.recordingStorageObjectKey);
      } else {
        const previousRecordingFileId = extractGoogleDriveFileId(existingClass.recordingUrl || '');
        if (previousRecordingFileId) {
          try {
            await deleteFileFromGoogleDrive(previousRecordingFileId);
          } catch (_) {
            // no-op
          }
        }
      }
    } else if (String(updateData.recordingStorageObjectKey || '').trim()) {
      const nextRecordingObjectKey = String(updateData.recordingStorageObjectKey || '').trim();
      const previousRecordingObjectKey = String(existingClass.recordingStorageObjectKey || '').trim();

      updateData.recordingStorageProvider = 'gcs';
      updateData.recordingStorageObjectKey = nextRecordingObjectKey;
      updateData.recordingUrl = buildClassRecordingAccessApiUrl(
        willChangeClassCode ? nextClassCode : existingClass.classCode
      );

      // Signed-upload edit flow: remove old object when key changes.
      if (
        isGcsClassObject(existingClass.recordingStorageProvider, previousRecordingObjectKey) &&
        previousRecordingObjectKey &&
        previousRecordingObjectKey !== nextRecordingObjectKey
      ) {
        await deleteFileFromGcs(previousRecordingObjectKey);
      } else if (!isGcsClassObject(existingClass.recordingStorageProvider, previousRecordingObjectKey)) {
        const previousRecordingFileId = extractGoogleDriveFileId(existingClass.recordingUrl || '');
        if (previousRecordingFileId) {
          try {
            await deleteFileFromGoogleDrive(previousRecordingFileId);
          } catch (_) {
            // no-op
          }
        }
      }
    }

    if (canvaFile) {
      const canvaKey = generateObjectKey({
        type: 'classes',
        fileName: canvaFile.originalname || canvaFile.filename,
      });

      await uploadFileToGcs({
        filePath: canvaFile.path,
        objectKey: canvaKey,
        mimeType: canvaFile.mimetype,
      });

      updateData.canvaStorageProvider = 'gcs';
      updateData.canvaStorageObjectKey = canvaKey;
      updateData.canvaUrl = buildClassCanvaAccessApiUrl(
        willChangeClassCode ? nextClassCode : existingClass.classCode
      );
      await removeTempFile(canvaFile.path);

      if (isGcsClassObject(existingClass.canvaStorageProvider, existingClass.canvaStorageObjectKey)) {
        await deleteFileFromGcs(existingClass.canvaStorageObjectKey);
      }
    } else if (String(updateData.canvaStorageObjectKey || '').trim()) {
      updateData.canvaStorageProvider = 'gcs';
      updateData.canvaStorageObjectKey = String(updateData.canvaStorageObjectKey || '').trim();
      updateData.canvaUrl = buildClassCanvaAccessApiUrl(
        willChangeClassCode ? nextClassCode : existingClass.classCode
      );
    } else if (
      willChangeClassCode &&
      isGcsClassObject(existingClass.canvaStorageProvider, existingClass.canvaStorageObjectKey)
    ) {
      updateData.canvaUrl = buildClassCanvaAccessApiUrl(nextClassCode);
    }

    if (
      willChangeClassCode &&
      isGcsClassObject(existingClass.recordingStorageProvider, existingClass.recordingStorageObjectKey) &&
      !updateData.recordingUrl
    ) {
      updateData.recordingUrl = buildClassRecordingAccessApiUrl(nextClassCode);
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

    if (isGcsClassObject(cls.recordingStorageProvider, cls.recordingStorageObjectKey)) {
      await deleteFileFromGcs(cls.recordingStorageObjectKey);
    }

    if (isGcsClassObject(cls.canvaStorageProvider, cls.canvaStorageObjectKey)) {
      await deleteFileFromGcs(cls.canvaStorageObjectKey);
    }

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

    if (
      isGcsClassObject(
        context.cls.recordingStorageProvider,
        context.cls.recordingStorageObjectKey
      )
    ) {
      const signed = await getSignedDownloadUrl({
        objectKey: context.cls.recordingStorageObjectKey,
        inline: true,
      });

      return res.redirect(302, signed.downloadUrl);
    }

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

// GET /api/classes/:classCode/recording-access
const getClassRecordingAccessUrl = async (req, res) => {
  try {
    const cls = await Class.findOne({ classCode: req.params.classCode });
    if (!cls) return error(res, 'Clase no encontrada.', 404);

    const isAdmin = req.user?.role === 'admin';
    const canAccess = isAdmin || cls.isPublic || isClassUnlockedForUser(cls, req.user?.email);
    if (!canAccess) {
      return error(res, 'Clase bloqueada para este estudiante.', 403);
    }

    if (
      isGcsClassObject(cls.recordingStorageProvider, cls.recordingStorageObjectKey)
    ) {
      const signed = await getSignedDownloadUrl({
        objectKey: cls.recordingStorageObjectKey,
        inline: true,
      });

      return success(res, {
        accessUrl: signed.downloadUrl,
        expiresIn: signed.expiresIn,
      });
    }

    return success(res, {
      accessUrl: cls.recordingUrl || '',
      expiresIn: null,
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/classes/:classCode/canva-access
const getClassCanvaAccessUrl = async (req, res) => {
  try {
    const cls = await Class.findOne({ classCode: req.params.classCode });
    if (!cls) return error(res, 'Clase no encontrada.', 404);

    const isAdmin = req.user?.role === 'admin';
    const canAccess = isAdmin || cls.isPublic || isClassUnlockedForUser(cls, req.user?.email);
    if (!canAccess) {
      return error(res, 'Clase bloqueada para este estudiante.', 403);
    }

    if (isGcsClassObject(cls.canvaStorageProvider, cls.canvaStorageObjectKey)) {
      const signed = await getSignedDownloadUrl({
        objectKey: cls.canvaStorageObjectKey,
        inline: true,
      });

      return success(res, {
        accessUrl: signed.downloadUrl,
        expiresIn: signed.expiresIn,
      });
    }

    return success(res, {
      accessUrl: cls.canvaUrl || '',
      expiresIn: null,
    });
  } catch (err) {
    return error(res, err.message);
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
  getClassRecordingAccessUrl,
  getClassCanvaAccessUrl,
  setClassVote,
};
