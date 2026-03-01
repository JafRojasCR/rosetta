const Class = require('../models/Class');
const Payment = require('../models/Payment');
const jwt = require('jsonwebtoken');
const { success, error } = require('../utils/apiResponse');
const Joi = require('joi');
const { googleDriveClassesVideosFolderId, jwtSecret } = require('../config/env');
const {
  uploadFileToGoogleDrive,
  deleteFileFromGoogleDrive,
  removeTempFile,
} = require('../services/googleDriveService');

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

const getPlayableVideoUrl = (recordingUrl = '', req) => {
  if (!recordingUrl) return '';

  if (/^https?:\/\//i.test(recordingUrl)) {
    const driveFileId = extractGoogleDriveFileId(recordingUrl);
    if (driveFileId) {
      return `https://drive.google.com/uc?export=download&id=${driveFileId}`;
    }
    return recordingUrl;
  }

  if (recordingUrl.startsWith('/')) {
    return `${req.protocol}://${req.get('host')}${recordingUrl}`;
  }

  return recordingUrl;
};

const buildSecurePlayerHtml = (videoUrl) => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reproductor</title>
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #0f172a; overflow: hidden; }
      .wrap { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
      video { width: 100%; height: 100%; object-fit: contain; background: #0f172a; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <video
        id="class-video"
        controls
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        disablePictureInPicture
        playsinline
      >
        <source src="${videoUrl}" />
      </video>
    </div>
    <script>
      document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
      document.addEventListener('keydown', function (event) {
        const key = (event.key || '').toLowerCase();
        const blocked =
          key === 'f12' ||
          (event.ctrlKey && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
          (event.ctrlKey && (key === 's' || key === 'u'));
        if (blocked) event.preventDefault();
      });
    </script>
  </body>
</html>`;

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

// PUT /api/classes/:classCode (admin)
const updateClass = async (req, res) => {
  const schema = Joi.object({
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
    return success(res, cls, 'Clase actualizada exitosamente');
  } catch (err) {
    await removeTempFile(req.files?.recordingFile?.[0]?.path);
    await removeTempFile(req.files?.canvaFile?.[0]?.path);
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
      { expiresIn: '2h' }
    );

    return success(res, { token, iframeUrl: `/api/classes/embed/${token}` });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/classes/embed/:token
const getClassEmbedByToken = async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, jwtSecret);
    if (decoded?.type !== 'class_embed' || !decoded?.classCode) {
      return res.status(403).send('Acceso no permitido.');
    }

    const cls = await Class.findOne({ classCode: decoded.classCode });
    if (!cls) return res.status(404).send('Clase no encontrada.');

    const isAdmin = decoded.role === 'admin';
    const canAccess = isAdmin || isClassUnlockedForUser(cls, decoded.email);
    if (!canAccess) return res.status(403).send('Clase bloqueada.');

    const playableUrl = getPlayableVideoUrl(cls.recordingUrl || '', req);
    if (!playableUrl) return res.status(404).send('Video no disponible.');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildSecurePlayerHtml(playableUrl));
  } catch (_err) {
    return res.status(403).send('Token de reproducción inválido o expirado.');
  }
};

module.exports = {
  getClasses,
  getClassByCode,
  createClass,
  updateClass,
  deleteClass,
  getClassEmbedToken,
  getClassEmbedByToken,
};
