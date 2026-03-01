const Class = require('../models/Class');
const Payment = require('../models/Payment');
const { success, error } = require('../utils/apiResponse');
const Joi = require('joi');
const {
  uploadFileToGoogleDrive,
  removeTempFile,
} = require('../services/googleDriveService');

// GET /api/classes
const getClasses = async (req, res) => {
  try {
    const { subjectId, isPublic } = req.query;
    const filter = {};
    if (subjectId) filter['subject.subjectId'] = subjectId;
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';

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
  });

  const { error: validationError, value } = schema.validate(req.body);
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
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const updateData = { ...value };

    const recordingFile = req.files?.recordingFile?.[0];
    const canvaFile = req.files?.canvaFile?.[0];

    if (recordingFile) {
      const uploaded = await uploadFileToGoogleDrive({
        filePath: recordingFile.path,
        fileName: recordingFile.originalname || recordingFile.filename,
        mimeType: recordingFile.mimetype,
      });

      if (uploaded.uploaded && uploaded.fileUrl) {
        updateData.recordingUrl = uploaded.fileUrl;
        await removeTempFile(recordingFile.path);
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

    const cls = await Class.findOneAndUpdate(
      { classCode: req.params.classCode },
      updateData,
      { new: true, runValidators: true }
    );
    if (!cls) return error(res, 'Clase no encontrada.', 404);
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
    const cls = await Class.findOneAndDelete({ classCode: req.params.classCode });
    if (!cls) return error(res, 'Clase no encontrada.', 404);
    return success(res, null, 'Clase eliminada exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getClasses, getClassByCode, createClass, updateClass, deleteClass };
