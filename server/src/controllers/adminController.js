const Student = require('../models/Student');
const Class = require('../models/Class');
const { success, error } = require('../utils/apiResponse');
const Joi = require('joi');

// GET /api/admin/students
const getStudents = async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    return success(res, students);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/admin/students/:email
const getStudentByEmail = async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.params.email });
    if (!student) return error(res, 'Estudiante no encontrado.', 404);
    return success(res, student);
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/admin/students/:email (admin only)
const updateStudent = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().optional(),
    lastName: Joi.string().optional(),
    phone: Joi.string().allow('').optional(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const student = await Student.findOneAndUpdate(
      { email: req.params.email },
      value,
      { new: true, runValidators: true }
    );
    if (!student) return error(res, 'Estudiante no encontrado.', 404);
    return success(res, student, 'Estudiante actualizado');
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/admin/students/:email (admin only)
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ email: req.params.email });
    if (!student) return error(res, 'Estudiante no encontrado.', 404);

    await Class.updateMany(
      {},
      {
        $pull: {
          classStudents: {
            $or: [
              { 'student.email': String(student.email || '').toLowerCase() },
              { 'student.id': student._id },
            ],
          },
        },
      }
    );

    return success(res, null, 'Estudiante eliminado');
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/admin/profile (student self-update)
const updateMyProfile = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().optional(),
    lastName: Joi.string().optional(),
    phone: Joi.string().allow('').optional(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const student = await Student.findOneAndUpdate(
      { email: req.user.email },
      value,
      { new: true, runValidators: true }
    );
    if (!student) return error(res, 'Estudiante no encontrado.', 404);
    return success(res, student, 'Perfil actualizado');
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/admin/profile (student self-delete)
const deleteMyAccount = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ email: req.user.email });
    if (!student) return error(res, 'Estudiante no encontrado.', 404);

    await Class.updateMany(
      {},
      {
        $pull: {
          classStudents: {
            $or: [
              { 'student.email': String(student.email || '').toLowerCase() },
              { 'student.id': student._id },
            ],
          },
        },
      }
    );

    return success(res, null, 'Cuenta eliminada');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getStudents, getStudentByEmail, updateStudent, deleteStudent, updateMyProfile, deleteMyAccount };
