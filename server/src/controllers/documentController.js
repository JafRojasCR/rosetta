const Document = require('../models/Document');
const { success, error } = require('../utils/apiResponse');
const Joi = require('joi');

// GET /api/documents
const getDocuments = async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = {};
    if (subjectId) filter['subject.subjectId'] = subjectId;

    const documents = await Document.find(filter).sort({ date: -1 });
    return success(res, documents);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/documents/:docId
const getDocumentById = async (req, res) => {
  try {
    const doc = await Document.findOne({ docId: req.params.docId });
    if (!doc) return error(res, 'Documento no encontrado.', 404);
    return success(res, doc);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/documents (admin)
const createDocument = async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().allow('').optional(),
    subject: Joi.object({
      subjectId: Joi.string().required(),
      name: Joi.string().required(),
    }).required(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    if (!req.file) return error(res, 'Archivo requerido.', 400);

    const docId = `DOC-${Date.now()}`;
    const doc = await Document.create({
      docId,
      ...value,
      date: new Date(),
      fileUrl: `/uploads/${req.file.filename}`,
      adminEmail: req.user.email,
    });

    return success(res, doc, 'Documento creado exitosamente', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

// PUT /api/documents/:docId (admin)
const updateDocument = async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().allow('').optional(),
    subject: Joi.object({
      subjectId: Joi.string().required(),
      name: Joi.string().required(),
    }).optional(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const doc = await Document.findOneAndUpdate(
      { docId: req.params.docId },
      value,
      { new: true, runValidators: true }
    );
    if (!doc) return error(res, 'Documento no encontrado.', 404);
    return success(res, doc, 'Documento actualizado exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

// DELETE /api/documents/:docId (admin)
const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findOneAndDelete({ docId: req.params.docId });
    if (!doc) return error(res, 'Documento no encontrado.', 404);
    return success(res, null, 'Documento eliminado exitosamente');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getDocuments, getDocumentById, createDocument, updateDocument, deleteDocument };
