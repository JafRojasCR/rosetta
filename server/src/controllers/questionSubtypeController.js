const Joi = require('joi');
const QuestionSubtype = require('../models/QuestionSubtype');
const { success, error } = require('../utils/apiResponse');

// GET /api/question-subtypes
const getQuestionSubtypes = async (_req, res) => {
  try {
    const subtypes = await QuestionSubtype.find().sort({ name: 1 });
    return success(res, subtypes);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/question-subtypes (admin)
const createQuestionSubtype = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(2).max(120).required().messages({
      'string.empty': 'El nombre del subtipo es obligatorio.',
      'any.required': 'El nombre del subtipo es obligatorio.',
    }),
  });

  const { error: validationError, value } = schema.validate(req.body || {});
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const existing = await QuestionSubtype.findOne({
      name: { $regex: new RegExp(`^${value.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (existing) {
      return error(res, 'Ese subtipo ya se encuentra registrado.', 409);
    }

    const created = await QuestionSubtype.create({ name: value.name });
    return success(res, created, 'Subtipo creado exitosamente', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/question-subtypes/:id (admin)
const deleteQuestionSubtype = async (req, res) => {
  try {
    const removed = await QuestionSubtype.findByIdAndDelete(req.params.id);
    if (!removed) return error(res, 'Subtipo no encontrado.', 404);

    return success(res, null, 'Subtipo eliminado exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  getQuestionSubtypes,
  createQuestionSubtype,
  deleteQuestionSubtype,
};
