const Student = require('../models/Student');
const Class = require('../models/Class');
const Admin = require('../models/Admin');
const { success, error } = require('../utils/apiResponse');
const Joi = require('joi');
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// GET /api/admin/admins
const getAdmins = async (_req, res) => {
  try {
    const admins = await Admin.find().sort({ createdAt: -1 });
    return success(res, admins);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/admin/admins
const createAdmin = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string()
      .pattern(strongPasswordRegex)
      .required()
      .messages({
        'string.pattern.base':
          'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número.',
      }),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const normalizedEmail = String(value.email).toLowerCase();
    const exists = await Admin.findOne({ email: normalizedEmail });
    if (exists) return error(res, 'Ya existe un administrador con ese correo.', 409);

    const admin = await Admin.create({
      email: normalizedEmail,
      password: value.password,
    });

    return success(res, admin, 'Administrador creado exitosamente.', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/admin/admins/:email/password
const updateAdminPassword = async (req, res) => {
  const schema = Joi.object({
    newPassword: Joi.string()
      .pattern(strongPasswordRegex)
      .required()
      .messages({
        'string.pattern.base':
          'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número.',
      }),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const normalizedEmail = String(req.params.email || '').toLowerCase();
    const admin = await Admin.findOne({ email: normalizedEmail });
    if (!admin) return error(res, 'Administrador no encontrado.', 404);

    admin.password = value.newPassword;
    await admin.save();

    return success(res, null, 'Contraseña de administrador actualizada.');
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/admin/admins/:email
const deleteAdmin = async (req, res) => {
  try {
    const normalizedEmail = String(req.params.email || '').toLowerCase();
    const requesterEmail = String(req.user?.email || '').toLowerCase();

    if (normalizedEmail === requesterEmail) {
      return error(res, 'No puedes eliminar tu propia cuenta de administrador.', 400);
    }

    const deleted = await Admin.findOneAndDelete({ email: normalizedEmail });
    if (!deleted) return error(res, 'Administrador no encontrado.', 404);

    return success(res, null, 'Administrador eliminado.');
  } catch (err) {
    return error(res, err.message);
  }
};

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

module.exports = {
  getStudents,
  getStudentByEmail,
  updateStudent,
  deleteStudent,
  updateMyProfile,
  deleteMyAccount,
  getAdmins,
  createAdmin,
  updateAdminPassword,
  deleteAdmin,
};
