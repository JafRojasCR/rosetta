const Joi = require('joi');
const Subject = require('../models/Subject');
const { success, error } = require('../utils/apiResponse');

// GET /api/subjects
const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    return success(res, subjects);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/subjects (admin)
const createSubject = async (req, res) => {
  const schema = Joi.object({
    subjectId: Joi.string().trim().min(2).max(20).required(),
    name: Joi.string().trim().min(2).max(120).required(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const normalized = {
      subjectId: value.subjectId.toLowerCase(),
      name: value.name,
    };

    const exists = await Subject.findOne({ subjectId: normalized.subjectId });
    if (exists) return error(res, 'La materia ya existe.', 409);

    const subject = await Subject.create(normalized);
    return success(res, subject, 'Materia creada exitosamente', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/subjects/:subjectId (admin)
const updateSubject = async (req, res) => {
  const schema = Joi.object({
    subjectId: Joi.string().trim().min(2).max(20).required(),
    name: Joi.string().trim().min(2).max(120).required(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const currentId = String(req.params.subjectId || '').toLowerCase();
    const nextId = value.subjectId.toLowerCase();

    const subject = await Subject.findOne({ subjectId: currentId });
    if (!subject) return error(res, 'Materia no encontrada.', 404);

    if (nextId !== currentId) {
      const duplicated = await Subject.findOne({ subjectId: nextId });
      if (duplicated) return error(res, 'Ya existe una materia con ese codigo.', 409);
    }

    subject.subjectId = nextId;
    subject.name = value.name;
    await subject.save();

    return success(res, subject, 'Materia actualizada exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/subjects/:subjectId (admin)
const deleteSubject = async (req, res) => {
  try {
    const subjectId = String(req.params.subjectId || '').toLowerCase();
    const removed = await Subject.findOneAndDelete({ subjectId });
    if (!removed) return error(res, 'Materia no encontrada.', 404);

    return success(res, null, 'Materia eliminada exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getSubjects, createSubject, updateSubject, deleteSubject };
