const Joi = require('joi');
const Exam = require('../models/Exam');
const { success, error } = require('../utils/apiResponse');
const { getSignedDownloadUrl } = require('../services/googleCloudStorageService');

const examBodySchema = Joi.object({
  title: Joi.string().trim().min(2).max(150).required().messages({
    'string.empty': 'El título del examen es obligatorio.',
    'any.required': 'El título del examen es obligatorio.',
  }),
  description: Joi.string().trim().allow('').max(1000).default(''),
  questionIds: Joi.array()
    .items(Joi.string().hex().length(24).required())
    .min(1)
    .required()
    .messages({
      'array.min': 'Debes seleccionar al menos 1 pregunta para el examen.',
      'any.required': 'Debes seleccionar al menos 1 pregunta para el examen.',
    }),
  recommendedMinutes: Joi.number().integer().min(1).max(720).default(110),
  useBubbleSheetDefault: Joi.boolean().default(true),
  lockBubbleSheet: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
});

const attachSignedImageUrl = async (questionDoc) => {
  const plain =
    typeof questionDoc.toObject === 'function' ? questionDoc.toObject() : { ...questionDoc };
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

// GET /api/exams
const getExams = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const includeInactive = isAdmin && req.query.includeInactive === 'true';

    const filter = includeInactive ? {} : { isActive: true };
    const exams = await Exam.find(filter).sort({ createdAt: -1 });
    return success(res, exams);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/exams/:id
const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('questionIds');
    if (!exam) return error(res, 'Examen no encontrado.', 404);

    if (!exam.isActive && req.user?.role !== 'admin') {
      return error(res, 'Este examen no está disponible actualmente.', 403);
    }

    const validQuestions = (exam.questionIds || []).filter(Boolean);
    const enrichedQuestions = await Promise.all(validQuestions.map(attachSignedImageUrl));

    const plainExam = exam.toObject();
    plainExam.questions = enrichedQuestions;
    plainExam.questionIds = enrichedQuestions.map((q) => q._id);

    return success(res, plainExam);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/exams (admin)
const createExam = async (req, res) => {
  const { error: validationError, value } = examBodySchema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const exam = await Exam.create(value);
    return success(res, exam, 'Examen creado exitosamente', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/exams/:id (admin)
const updateExam = async (req, res) => {
  const { error: validationError, value } = examBodySchema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, value, {
      new: true,
      runValidators: true,
    });
    if (!exam) return error(res, 'Examen no encontrado.', 404);

    return success(res, exam, 'Examen actualizado exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/exams/:id (admin)
const deleteExam = async (req, res) => {
  try {
    const removed = await Exam.findByIdAndDelete(req.params.id);
    if (!removed) return error(res, 'Examen no encontrado.', 404);

    return success(res, null, 'Examen eliminado exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
};
