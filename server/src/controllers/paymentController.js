const Payment = require('../models/Payment');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const fs = require('fs/promises');
const path = require('path');
const { success, error } = require('../utils/apiResponse');
const {
  extractPaymentData,
  extractPaymentDataFromBuffer,
  validatePayment,
  validateExtractedPayment,
} = require('../services/paymentAIService');
const {
  generateObjectKey,
  uploadFileToGcs,
  deleteFileFromGcs,
  getSignedDownloadUrl,
  removeTempFile,
} = require('../services/googleCloudStorageService');
const {
  deleteFileFromGoogleDrive,
} = require('../services/googleDriveService');
const { uploadDir } = require('../config/env');
const Joi = require('joi');
const {
  sendPendingPaymentReviewEmail,
  sendApprovedPaymentNotificationEmail,
  sendStudentPaymentApprovedEmail,
  sendStudentPaymentRejectedEmail,
} = require('../services/emailService');

const resolveStudentDisplayName = async (payment) => {
  const student = await Student.findOne({ email: payment.studentEmail })
    .select('name lastName email')
    .lean();

  if (!student) return payment.studentEmail || '--';

  const fullName = `${student.name || ''} ${student.lastName || ''}`.trim();
  return fullName || student.email || payment.studentEmail || '--';
};

const notifyAdminsPaymentStatus = async (payment) => {
  const status = String(payment?.status || '').toLowerCase();
  if (!payment || (status !== 'pendiente' && status !== 'aprobado')) return;

  const admins = await Admin.find({}).select('email').lean();
  const adminEmails = [...new Set(admins.map((admin) => String(admin?.email || '').trim().toLowerCase()).filter(Boolean))];

  if (adminEmails.length === 0) return;

  const studentName = await resolveStudentDisplayName(payment);
  const sendEmail =
    status === 'aprobado'
      ? sendApprovedPaymentNotificationEmail
      : sendPendingPaymentReviewEmail;

  await Promise.allSettled(
    adminEmails.map((adminEmail) =>
      sendEmail({
        to: adminEmail,
        studentName,
        classCode: payment.classCode,
        amount: payment.amount,
        paymentId: payment.paymentId,
        status: payment.status,
      })
    )
  );
};

const notifyStudentPaymentDecision = async (payment) => {
  const status = String(payment?.status || '').toLowerCase();
  if (!payment?.studentEmail || (status !== 'aprobado' && status !== 'rechazado')) return;

  const studentName = await resolveStudentDisplayName(payment);
  const payload = {
    to: payment.studentEmail,
    studentName,
    classCode: payment.classCode,
    amount: payment.amount,
    paymentId: payment.paymentId,
    paymentDate: payment.date,
    billNumber: payment.billNumber,
  };

  if (status === 'aprobado') {
    await sendStudentPaymentApprovedEmail(payload);
    return;
  }

  await sendStudentPaymentRejectedEmail(payload);
};

const extractGoogleDriveFileId = (url = '') => {
  const idFromQuery = String(url || '').match(/[?&]id=([^&]+)/);
  if (idFromQuery?.[1]) return idFromQuery[1];

  const idFromPath = String(url || '').match(/\/d\/([^/]+)/);
  if (idFromPath?.[1]) return idFromPath[1];

  return '';
};

const isGcsBill = (payment) =>
  String(payment?.billStorageProvider || '').toLowerCase() === 'gcs' &&
  Boolean(String(payment?.billStorageObjectKey || '').trim());

const buildPaymentBillAccessApiUrl = (paymentId = '') =>
  `/api/payments/${encodeURIComponent(String(paymentId || ''))}/bill-access-url`;

const ensureStudentClassAccess = async ({ payment, cls, student, accessGrantedAt }) => {
  if (!cls || !student) return;

  if (!Array.isArray(cls.classStudents)) {
    cls.classStudents = [];
  }

  const studentEmail = String(payment.studentEmail || '').toLowerCase();
  const existingIndex = cls.classStudents.findIndex(
    (entry) => entry?.student?.email?.toLowerCase() === studentEmail
  );

  const existingEntry = existingIndex >= 0 ? cls.classStudents[existingIndex] : null;
  const unlockedAt = accessGrantedAt || new Date();
  const paymentDate = payment?.date || existingEntry?.paymentDate || null;

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
    paymentDate,
    vote:
      existingEntry?.vote === '1' || existingEntry?.vote === '-1' || existingEntry?.vote === null
        ? existingEntry.vote
        : null,
  };

  if (existingIndex >= 0) {
    cls.classStudents[existingIndex] = studentEntry;
  } else {
    cls.classStudents.push(studentEntry);
  }

  await cls.save();
};

const ensureStudentCourseAccess = async ({ student, subjectId }) => {
  if (!student || !subjectId) return;

  const normalizedCourseId = String(subjectId || '').trim().toLowerCase();
  if (!normalizedCourseId) return;

  await Student.updateOne(
    { _id: student._id },
    { $addToSet: { cursos: normalizedCourseId } }
  );
};

// GET /api/payments (student: own payments)
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ studentEmail: req.user.email }).sort({ date: -1 }).lean();
    const mapped = payments.map((payment) => ({
      ...payment,
      billUrl: isGcsBill(payment)
        ? buildPaymentBillAccessApiUrl(payment.paymentId)
        : payment.billUrl,
    }));

    return success(res, mapped);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/payments/all (admin)
const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ date: -1 }).lean();
    const mapped = payments.map((payment) => ({
      ...payment,
      billUrl: isGcsBill(payment)
        ? buildPaymentBillAccessApiUrl(payment.paymentId)
        : payment.billUrl,
    }));

    return success(res, mapped);
  } catch (err) {
    return error(res, err.message);
  }
};

// GET /api/payments/:paymentId/bill-access-url
const getPaymentBillAccessUrl = async (req, res) => {
  try {
    const payment = await Payment.findOne({ paymentId: req.params.paymentId });
    if (!payment) return error(res, 'Pago no encontrado.', 404);

    const isAdmin = req.user?.role === 'admin';
    const canAccessOwn =
      String(payment.studentEmail || '').toLowerCase() ===
      String(req.user?.email || '').toLowerCase();

    if (!isAdmin && !canAccessOwn) {
      return error(res, 'No autorizado para ver este comprobante.', 403);
    }

    if (isGcsBill(payment)) {
      const signed = await getSignedDownloadUrl({
        objectKey: payment.billStorageObjectKey,
        inline: true,
      });

      return success(res, {
        accessUrl: signed.downloadUrl,
        expiresIn: signed.expiresIn,
      });
    }

    return success(res, {
      accessUrl: payment.billUrl || '',
      expiresIn: null,
    });
  } catch (err) {
    return error(res, err.message);
  }
};

// POST /api/payments (student)
const createPayment = async (req, res) => {
  const schema = Joi.object({
    classCode: Joi.string().required(),
    paymentType: Joi.string().valid('class', 'course').default('class'),
  });

  const { error: validationError, value } = schema.validate(req.body);
  if (validationError) return error(res, validationError.details[0].message, 400);

  let uploadedBillObjectKey = '';

  try {
    const isCoursePayment = value.paymentType === 'course';
    let cls = null;
    let courseSubject = null;

    if (isCoursePayment) {
      courseSubject = await Subject.findOne({
        subjectId: String(value.classCode || '').trim().toLowerCase(),
        isCourse: true,
      });
      if (!courseSubject) return error(res, 'Curso no encontrado.', 404);
    } else {
      cls = await Class.findOne({ classCode: value.classCode });
      if (!cls) return error(res, 'Clase no encontrada.', 404);
    }

    if (!req.file) {
      return error(res, 'Debes adjuntar el comprobante para validar el pago.', 400);
    }

    const targetCode = isCoursePayment ? courseSubject.subjectId : cls.classCode;
    const expectedPrice = isCoursePayment ? Number(courseSubject.price || 0) : Number(cls.price || 0);

    const existingUnresolvedForClass = await Payment.findOne({
      studentEmail: req.user.email,
      classCode: targetCode,
      status: { $in: ['pendiente', 'rechazado'] },
    });

    if (existingUnresolvedForClass) {
      await removeTempFile(req.file.path);
      const unresolvedStatus = existingUnresolvedForClass.status;
      const targetLabel = isCoursePayment ? 'este curso' : 'esta clase';
      return error(
        res,
        unresolvedStatus === 'rechazado'
          ? `Ya tienes un pago rechazado para ${targetLabel}. Elimínalo primero para subir otro comprobante.`
          : `Ya tienes un pago pendiente para ${targetLabel}. Elimínalo primero para subir otro comprobante.`,
        409,
        {
          paymentId: existingUnresolvedForClass.paymentId,
          status: unresolvedStatus,
        }
      );
    }

    let extractedData;
    try {
      extractedData = await extractPaymentData(req.file.path, expectedPrice);
      if (!String(extractedData?.rawText || '').trim()) {
        throw new Error('OCR local sin texto extraído.');
      }
    } catch (_) {
      try {
        const localBuffer = await fs.readFile(req.file.path);
        extractedData = await extractPaymentDataFromBuffer({
          buffer: localBuffer,
          mimeType: req.file.mimetype,
          fileName: req.file.originalname || req.file.filename,
          source: `local:${req.file.filename || ''}`,
          expectedAmount: expectedPrice,
        });
      } catch (fallbackError) {
        await removeTempFile(req.file.path);
        return error(
          res,
          `No se pudo leer el comprobante para validar el pago (${fallbackError.message}).`,
          400
        );
      }
    }

    const validation = validateExtractedPayment({
      extractedData,
      classCode: targetCode,
      classPrice: expectedPrice,
    });

    if (!validation.checks.hasBillNumber) {
      await removeTempFile(req.file.path);
      return error(
        res,
        'No se detectó número de comprobante/documento. Sube una imagen más clara del recibo.',
        400,
        {
          checks: isCoursePayment
            ? {
                hasBillNumber: validation.checks.hasBillNumber,
                detailMatches: validation.checks.detailMatches,
              }
            : validation.checks,
          validationErrors: isCoursePayment
            ? ['No se detectó número de comprobante/documento en la imagen.']
            : validation.errors,
        }
      );
    }

    const billNumber = String(extractedData.billNumber || '').trim();

    if (isCoursePayment) {
      const isValid = await validatePayment(billNumber);
      if (!isValid) {
        await removeTempFile(req.file.path);
        return error(res, 'Este comprobante ya fue utilizado.', 409, {
          checks: {
            hasBillNumber: validation.checks.hasBillNumber,
            detailMatches: validation.checks.detailMatches,
          },
        });
      }
    }

    const failedCoreCriteria = isCoursePayment
      ? [validation.checks.detailMatches ? null : 'detalle'].filter(Boolean)
      : [
          validation.checks.amountMatches ? null : 'monto',
          validation.checks.recipientMatches ? null : 'destinatario',
          validation.checks.detailMatches ? null : 'detalle',
        ].filter(Boolean);

    const coreFailuresCount = failedCoreCriteria.length;

    if (!isCoursePayment && coreFailuresCount >= 2) {
      await removeTempFile(req.file.path);
      return error(
        res,
        'No se pudo verificar automáticamente el comprobante. Revisa monto, destinatario y detalle, y vuelve a subirlo.',
        400,
        {
          checks: validation.checks,
          failedCoreCriteria,
          validationErrors: validation.errors,
        }
      );
    }

    const effectiveChecks = isCoursePayment
      ? {
          hasBillNumber: validation.checks.hasBillNumber,
          hasDate: true,
          amountMatches: true,
          detailMatches: validation.checks.detailMatches,
          recipientMatches: true,
        }
      : validation.checks;

    const effectiveValidationErrors = isCoursePayment
      ? validation.checks.detailMatches
        ? []
        : ['El detalle del pago no coincide con el código del curso.']
      : validation.errors;

    const paymentId = `PAY-${Date.now()}`;
    const billObjectKey = generateObjectKey({
      type: 'payments',
      fileName: req.file.originalname || req.file.filename,
    });
    await uploadFileToGcs({
      filePath: req.file.path,
      objectKey: billObjectKey,
      mimeType: req.file.mimetype,
    });
    uploadedBillObjectKey = billObjectKey;

    const billUrl = buildPaymentBillAccessApiUrl(paymentId);
    const paymentStatus = coreFailuresCount >= 1 ? 'pendiente' : 'aprobado';
    const resolvedAmount = Number.isFinite(validation.resolvedAmount)
      ? validation.resolvedAmount
      : extractedData.amount;
    const payment = await Payment.create({
      paymentId,
      date: extractedData.date || new Date(),
      billNumber,
      billUrl,
      billStorageProvider: 'gcs',
      billStorageObjectKey: billObjectKey,
      studentEmail: req.user.email,
      classCode: targetCode,
      paymentType: isCoursePayment ? 'course' : 'class',
      amount: Number.isFinite(resolvedAmount) ? resolvedAmount : null,
      recipient: extractedData.recipient || '',
      detail: extractedData.detail || '',
      validationChecks: effectiveChecks,
      validationErrors: effectiveValidationErrors,
      status: paymentStatus,
      approvedManually: false,
    });
    uploadedBillObjectKey = '';
    await removeTempFile(req.file.path);

    if (payment.status === 'aprobado') {
      const student = await Student.findOne({ email: payment.studentEmail });
      if (isCoursePayment) {
        await ensureStudentCourseAccess({
          student,
          subjectId: courseSubject.subjectId,
        });
      } else {
        await ensureStudentClassAccess({
          payment,
          cls,
          student,
          accessGrantedAt: new Date(),
        });
      }
      await notifyAdminsPaymentStatus(payment);
      await notifyStudentPaymentDecision(payment);
    } else if (payment.status === 'pendiente') {
      await notifyAdminsPaymentStatus(payment);
    }

    return success(
      res,
      {
        payment,
        checks: isCoursePayment
          ? {
              hasBillNumber: validation.checks.hasBillNumber,
              detailMatches: validation.checks.detailMatches,
            }
          : validation.checks,
        failedCoreCriteria,
      },
      payment.status === 'aprobado'
        ? 'Pago validado automáticamente y aprobado.'
        : 'El mensaje no pasó la verificación automática y quedó pendiente de revisión manual',
      201
    );
  } catch (err) {
    if (req.file?.path) {
      await removeTempFile(req.file.path);
    }
    if (uploadedBillObjectKey) {
      try {
        await deleteFileFromGcs(uploadedBillObjectKey);
      } catch (_) {
        // ignore cleanup failures
      }
    }
    return error(res, err.message);
  }
};

// DELETE /api/payments/:paymentId (student deletes unapproved payment)
const cancelMyPendingPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      paymentId: req.params.paymentId,
      studentEmail: req.user.email,
    });

    if (!payment) return error(res, 'Pago no encontrado.', 404);

    if (payment.status === 'aprobado') {
      return error(res, 'No puedes eliminar pagos aprobados.', 400);
    }

    if (isGcsBill(payment)) {
      await deleteFileFromGcs(payment.billStorageObjectKey);
    }

    const driveFileId = extractGoogleDriveFileId(payment.billUrl || '');
    if (driveFileId) {
      await deleteFileFromGoogleDrive(driveFileId);
    }

    if (String(payment.billUrl || '').startsWith('/uploads/')) {
      const fileName = String(payment.billUrl || '').replace(/^\/uploads\//, '');
      const localFilePath = path.resolve(__dirname, '..', uploadDir, fileName);
      await removeTempFile(localFilePath);
    }

    await Payment.deleteOne({ _id: payment._id });
    return success(res, null, 'Pago eliminado correctamente del historial.');
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

    if (status === 'rechazado') {
      if (isGcsBill(payment)) {
        try {
          await deleteFileFromGcs(payment.billStorageObjectKey);
          payment.billUrl = '';
          payment.billStorageObjectKey = '';
        } catch (_) {
          // no-op
        }
      }

      const driveFileId = extractGoogleDriveFileId(payment.billUrl || '');
      if (driveFileId) {
        try {
          await deleteFileFromGoogleDrive(driveFileId);
          payment.billUrl = '';
        } catch (_) {
          // no-op: keep rejection flow even if cleanup fails
        }
      }
    }

    payment.status = status;
    payment.approvedManually = status === 'aprobado';
    await payment.save();

    if (status === 'aprobado') {
      const [cls, student, courseSubject] = await Promise.all([
        Class.findOne({ classCode: payment.classCode }),
        Student.findOne({ email: payment.studentEmail }),
        Subject.findOne({
          subjectId: String(payment.classCode || '').trim().toLowerCase(),
          isCourse: true,
        }),
      ]);

      if (payment.paymentType === 'course' || (!cls && courseSubject)) {
        await ensureStudentCourseAccess({
          student,
          subjectId: courseSubject?.subjectId || payment.classCode,
        });
      } else {
        await ensureStudentClassAccess({
          payment,
          cls,
          student,
          accessGrantedAt: new Date(),
        });
      }
      await notifyAdminsPaymentStatus(payment);
      await notifyStudentPaymentDecision(payment);
    } else if (status === 'pendiente') {
      await notifyAdminsPaymentStatus(payment);
    } else if (status === 'rechazado') {
      await notifyStudentPaymentDecision(payment);
    }

    return success(res, payment, 'Estado de pago actualizado');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = {
  getMyPayments,
  getAllPayments,
  getPaymentBillAccessUrl,
  createPayment,
  updatePaymentStatus,
  cancelMyPendingPayment,
};
