const Payment = require('../models/Payment');
const Class = require('../models/Class');
const Student = require('../models/Student');
const { success, error } = require('../utils/apiResponse');
const { extractPaymentData, validatePayment } = require('../services/paymentAIService');
const Joi = require('joi');

// GET /api/payments (student: own payments)
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ studentEmail: req.user.email }).sort({ date: -1 });
    return success(res, payments);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/payments/all (admin)
const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ date: -1 });
    return success(res, payments);
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/payments (student)
const createPayment = async (req, res) => {
  const schema = Joi.object({
    classCode: Joi.string().required(),
    billNumber: Joi.string().required(),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  try {
    const cls = await Class.findOne({ classCode: value.classCode });
    if (!cls) return error(res, 'Clase no encontrada.', 404);

    // Verificar comprobante no reutilizado
    const isValid = await validatePayment(value.billNumber);
    if (!isValid) return error(res, 'Este comprobante ya fue utilizado.', 409);

    let billUrl = null;
    let extractedData = {};

    if (req.file) {
      billUrl = `/uploads/${req.file.filename}`;
      extractedData = await extractPaymentData(req.file.path);
    }

    const paymentId = `PAY-${Date.now()}`;
    const payment = await Payment.create({
      paymentId,
      date: extractedData.date || new Date(),
      billNumber: value.billNumber,
      billUrl,
      studentEmail: req.user.email,
      classCode: value.classCode,
      status: 'pendiente',
    });

    return success(res, payment, 'Pago registrado exitosamente', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

// PATCH /api/payments/:paymentId/status (admin)
const updatePaymentStatus = async (req, res) => {
  const { status } = req.body;
  if (!['pendiente', 'aprobado', 'rechazado'].includes(status)) {
    return error(res, 'Estado inválido.', 400);
  }

  try {
    const payment = await Payment.findOne({ paymentId: req.params.paymentId });
    if (!payment) return error(res, 'Pago no encontrado.', 404);

    payment.status = status;
    await payment.save();

    if (status === 'aprobado') {
      const [cls, student] = await Promise.all([
        Class.findOne({ classCode: payment.classCode }),
        Student.findOne({ email: payment.studentEmail }),
      ]);

      if (cls && student) {
        if (!Array.isArray(cls.classStudents)) {
          cls.classStudents = [];
        }

        const existingIndex = cls.classStudents.findIndex(
          (entry) => entry.student?.email?.toLowerCase() === payment.studentEmail.toLowerCase()
        );

        const existingEntry = existingIndex >= 0 ? cls.classStudents[existingIndex] : null;
        const unlockedAt = payment.date || new Date();

        const studentEntry = {
          student: {
            id: student._id,
            email: student.email,
            name: student.name,
            lastName: student.lastName,
            phone: student.phone || '',
          },
          type: existingEntry?.type === 'tutored' ? 'tutored' : 'normal',
          unlocked: true,
          unlockedAt,
          paymentDate: unlockedAt,
        };

        if (existingIndex >= 0) {
          cls.classStudents[existingIndex] = studentEntry;
        } else {
          cls.classStudents.push(studentEntry);
        }

        await cls.save();
      }
    }

    return success(res, payment, 'Estado de pago actualizado');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getMyPayments, getAllPayments, createPayment, updatePaymentStatus };
