const Joi = require('joi');
const Question = require('../models/Question');
const { success, error } = require('../utils/apiResponse');
const {
  generateObjectKey,
  getSignedUploadUrl,
  getSignedDownloadUrl,
  ensureObjectExists,
  deleteFileFromGcs,
} = require('../services/googleCloudStorageService');

const MAX_QUESTION_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB

const questionBodySchema = Joi.object({
  pregunta: Joi.string().trim().min(3).max(4000).required().messages({
    'string.empty': 'El enunciado de la pregunta es obligatorio.',
    'any.required': 'El enunciado de la pregunta es obligatorio.',
  }),
  respuestas: Joi.array()
    .items(Joi.string().trim().min(1).max(1000).required())
    .min(2)
    .max(6)
    .required()
    .messages({
      'array.min': 'Debe incluir al menos 2 opciones de respuesta.',
      'array.max': 'Puede incluir como máximo 6 opciones de respuesta.',
      'any.required': 'Las opciones de respuesta son obligatorias.',
    }),
  correcta: Joi.number().integer().min(0).required().messages({
    'number.base': 'Debe seleccionar una respuesta correcta.',
    'any.required': 'Debe seleccionar una respuesta correcta.',
  }),
  tipo: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'El tipo o área es obligatorio.',
    'any.required': 'El tipo o área es obligatorio.',
  }),
  subtipo: Joi.string().trim().allow('').max(150).default(''),
  explicacion: Joi.string().trim().allow('').max(4000).default(''),
  imageObjectKey: Joi.string().trim().allow('').max(500).default(''),
  isActive: Joi.boolean().default(true),
});

const imageUploadInitSchema = Joi.object({
  fileName: Joi.string().trim().min(1).required(),
  mimeType: Joi.string().trim().min(1).required(),
  fileSize: Joi.number().integer().positive().max(MAX_QUESTION_IMAGE_BYTES).required().messages({
    'number.max': 'La imagen no puede superar los 15 MB.',
  }),
});

const imageUploadCompleteSchema = Joi.object({
  objectKey: Joi.string().trim().min(1).required(),
  mimeType: Joi.string().trim().min(1).required(),
});

const attachSignedImageUrl = async (questionDoc) => {
  const plain = typeof questionDoc.toObject === 'function' ? questionDoc.toObject() : { ...questionDoc };
  if (!plain.imageObjectKey) {
    return { ...plain, imageUrl: '' };
  }

  try {
    const signed = await getSignedDownloadUrl({
      objectKey: plain.imageObjectKey,
      inline: true,
    });
    return { ...plain, imageUrl: signed.downloadUrl || '' };
  } catch (_) {
    return { ...plain, imageUrl: '' };
  }
};

// POST /api/questions/image-upload/init (admin)
const initQuestionImageUpload = async (req, res) => {
  const { error: validationError, value } = imageUploadInitSchema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  if (!String(value.mimeType).toLowerCase().startsWith('image/')) {
    return error(res, 'Solo se permiten archivos de imagen (PNG, JPG, WEBP, GIF).', 400);
  }

  try {
    const objectKey = generateObjectKey({
      type: 'questions',
      fileName: value.fileName,
    });

    const signed = await getSignedUploadUrl({
      objectKey,
      mimeType: value.mimeType,
    });

    return success(res, {
      uploadUrl: signed.uploadUrl,
      objectKey,
      expiresIn: signed.expiresIn,
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/questions/image-upload/complete (admin)
const completeQuestionImageUpload = async (req, res) => {
  const { error: validationError, value } = imageUploadCompleteSchema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const exists = await ensureObjectExists(value.objectKey);
    if (!exists) {
      return error(res, 'No se encontró la imagen cargada en Google Cloud Storage.', 404);
    }

    const signed = await getSignedDownloadUrl({
      objectKey: value.objectKey,
      inline: true,
    }).catch(() => ({ downloadUrl: '' }));

    return success(res, {
      objectKey: value.objectKey,
      imageUrl: signed.downloadUrl || '',
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/questions
const getQuestions = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const includeInactive = isAdmin && req.query.includeInactive === 'true';

    const filter = includeInactive ? {} : { isActive: true };
    const questions = await Question.find(filter).sort({ createdAt: -1 });
    const enriched = await Promise.all(questions.map(attachSignedImageUrl));
    return success(res, enriched);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/questions (admin)
const createQuestion = async (req, res) => {
  const { error: validationError, value } = questionBodySchema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  if (value.correcta >= value.respuestas.length) {
    return error(res, 'El índice de la respuesta correcta está fuera de rango.', 400);
  }

  try {
    const question = await Question.create(value);
    const enriched = await attachSignedImageUrl(question);
    return success(res, enriched, 'Pregunta creada exitosamente', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/questions/:id (admin)
const updateQuestion = async (req, res) => {
  const { error: validationError, value } = questionBodySchema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  if (value.correcta >= value.respuestas.length) {
    return error(res, 'El índice de la respuesta correcta está fuera de rango.', 400);
  }

  try {
    const existing = await Question.findById(req.params.id);
    if (!existing) return error(res, 'Pregunta no encontrada.', 404);

    const previousKey = existing.imageObjectKey || '';
    const nextKey = value.imageObjectKey || '';

    const question = await Question.findByIdAndUpdate(req.params.id, value, {
      new: true,
      runValidators: true,
    });

    if (previousKey && previousKey !== nextKey) {
      deleteFileFromGcs(previousKey).catch(() => {});
    }

    const enriched = await attachSignedImageUrl(question);
    return success(res, enriched, 'Pregunta actualizada exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/questions/:id (admin)
const deleteQuestion = async (req, res) => {
  try {
    const removed = await Question.findByIdAndDelete(req.params.id);
    if (!removed) return error(res, 'Pregunta no encontrada.', 404);

    if (removed.imageObjectKey) {
      deleteFileFromGcs(removed.imageObjectKey).catch(() => {});
    }

    return success(res, null, 'Pregunta eliminada exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  initQuestionImageUpload,
  completeQuestionImageUpload,
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
