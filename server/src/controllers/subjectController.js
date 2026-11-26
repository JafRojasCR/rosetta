const Joi = require('joi');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
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
    isCourse: Joi.boolean().default(false),
    price: Joi.number().min(0).default(0),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const normalized = {
      subjectId: value.subjectId.toLowerCase(),
      name: value.name,
      isCourse: Boolean(value.isCourse),
      price: value.isCourse ? Number(value.price || 0) : 0,
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
    isCourse: Joi.boolean().optional(),
    price: Joi.number().min(0).optional(),
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

    const nextIsCourse = value.isCourse !== undefined ? Boolean(value.isCourse) : Boolean(subject.isCourse);
    const nextPrice = nextIsCourse
      ? Number(value.price !== undefined ? value.price : subject.price || 0)
      : 0;

    subject.subjectId = nextId;
    subject.name = value.name;
    subject.isCourse = nextIsCourse;
    subject.price = nextPrice;
    await subject.save();

    if (!nextIsCourse) {
      await Student.updateMany({}, { $pull: { cursos: { $in: [currentId, nextId] } } });
    } else if (nextId !== currentId) {
      await Student.updateMany(
        { cursos: currentId },
        { $set: { 'cursos.$': nextId } }
      );
    }

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

    await Student.updateMany({}, { $pull: { cursos: subjectId } });

    return success(res, null, 'Materia eliminada exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getSubjects, createSubject, updateSubject, deleteSubject };
