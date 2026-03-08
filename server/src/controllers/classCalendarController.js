const Joi = require('joi');
const { ClassCalendarSlot } = require('../models/ClassCalendarSlot');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const { success, error } = require('../utils/apiResponse');
const {
  sendClassScheduleRequestEmail,
  sendClassScheduleApprovedEmail,
  sendClassScheduleRejectedEmail,
} = require('../services/emailService');

const isoDateSchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required();

const createAvailabilitySchema = Joi.object({
  date: isoDateSchema,
  startMinute: Joi.number().integer().min(0).max(1410).required(),
  endMinute: Joi.number().integer().min(30).max(1440).required(),
  detail: Joi.string().trim().allow('').default('Horario habilitado por administrador'),
});

const reserveSlotSchema = Joi.object({
  date: isoDateSchema,
  startMinute: Joi.number().integer().min(0).max(1410).required(),
  endMinute: Joi.number().integer().min(30).max(1440).required(),
  detail: Joi.string().trim().allow('').default('Solicitud de clase'),
});

const listSlotsSchema = Joi.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

const isHalfHourBoundary = (minute) => minute % 30 === 0;

const toDateFromIsoDate = (dateString) => {
  const [year, month, day] = String(dateString || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

const toDateKey = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const intersects = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

const minutesToDate = (dateUtc, minuteOfDay) =>
  new Date(
    Date.UTC(
      dateUtc.getUTCFullYear(),
      dateUtc.getUTCMonth(),
      dateUtc.getUTCDate(),
      Math.floor(minuteOfDay / 60),
      minuteOfDay % 60,
      0,
      0
    )
  );

const toPublicSlot = (slot, isAdmin, currentUserId = '') => {
  const base = {
    id: String(slot._id),
    bookedCode: slot.bookedCode,
    date: slot.dateKey,
    startMinute: slot.startMinute,
    endMinute: slot.endMinute,
    status: slot.status,
    detail: slot.detail || '',
    startDateTime: slot.startDateTime,
    endDateTime: slot.endDateTime,
    requestedAt: slot.requestedAt,
    bookedAt: slot.bookedAt,
  };

  if (isAdmin) {
    return {
      ...base,
      adminEmail: slot.adminEmail,
      student:
        slot.student?.email
          ? {
              id: slot.student.id,
              email: slot.student.email,
              name: slot.student.name,
              lastName: slot.student.lastName,
            }
          : null,
    };
  }

  if (slot.status === 'booked' || slot.status === 'pending') {
    const isOwner = String(slot.student?.id || '') === String(currentUserId || '');

    return {
      ...base,
      student: null,
      adminEmail: '',
      isOwner,
    };
  }

  return {
    ...base,
    student: null,
    adminEmail: '',
    isOwner: false,
  };
};

const getSlotsInWindow = async ({ fromDateUtc, toDateUtc }) => {
  const rangeStart = new Date(fromDateUtc);
  const rangeEnd = addDays(toDateUtc, 1);

  const slots = await ClassCalendarSlot.find({
    startDateTime: { $lt: rangeEnd },
    endDateTime: { $gt: rangeStart },
  })
    .sort({ dateKey: 1, startMinute: 1 })
    .lean();

  return slots;
};

const validateRange = (startMinute, endMinute) => {
  if (!isHalfHourBoundary(startMinute) || !isHalfHourBoundary(endMinute)) {
    return 'Los horarios deben estar en intervalos de 30 minutos.';
  }

  if (endMinute <= startMinute) {
    return 'La hora final debe ser mayor que la hora inicial.';
  }

  return '';
};

const getExistingDaySlots = async (dateKey) => {
  return ClassCalendarSlot.find({ dateKey }).sort({ startMinute: 1 }).lean();
};

const mergeAdjacentAvailableSlots = async ({ daySlots, startMinute, endMinute, dayDateUtc, detail }) => {
  const availableSlots = daySlots.filter((slot) => slot.status === 'available');
  const beforeSlot = availableSlots.find((slot) => slot.endMinute === startMinute);
  const afterSlot = availableSlots.find((slot) => slot.startMinute === endMinute);

  const loadDoc = async (slot) => {
    if (!slot) return null;
    return ClassCalendarSlot.findById(slot._id);
  };

  const beforeDoc = await loadDoc(beforeSlot);
  const afterDoc = await loadDoc(afterSlot);

  if (beforeDoc && afterDoc && String(beforeDoc._id) !== String(afterDoc._id)) {
    beforeDoc.endMinute = afterDoc.endMinute;
    beforeDoc.endDateTime = minutesToDate(dayDateUtc, beforeDoc.endMinute);
    beforeDoc.detail = detail || beforeDoc.detail;
    await beforeDoc.save();
    await ClassCalendarSlot.findByIdAndDelete(afterDoc._id);
    return beforeDoc;
  }

  if (beforeDoc) {
    beforeDoc.endMinute = Math.max(beforeDoc.endMinute, endMinute);
    beforeDoc.endDateTime = minutesToDate(dayDateUtc, beforeDoc.endMinute);
    beforeDoc.detail = detail || beforeDoc.detail;
    await beforeDoc.save();
    return beforeDoc;
  }

  if (afterDoc) {
    afterDoc.startMinute = Math.min(afterDoc.startMinute, startMinute);
    afterDoc.startDateTime = minutesToDate(dayDateUtc, afterDoc.startMinute);
    afterDoc.detail = detail || afterDoc.detail;
    await afterDoc.save();
    return afterDoc;
  }

  return null;
};

const canReserveInsideAvailable = ({ availableSlot, startMinute, endMinute }) =>
  availableSlot.startMinute <= startMinute && availableSlot.endMinute >= endMinute;

const buildMinuteSet = (slots = []) => {
  const set = new Set();
  slots.forEach((slot) => {
    for (let minute = slot.startMinute; minute < slot.endMinute; minute += 30) {
      set.add(minute);
    }
  });
  return set;
};

const listCalendarSlots = async (req, res) => {
  const { error: validationError, value } = listSlotsSchema.validate(req.query || {});
  if (validationError) {
    return error(res, validationError.details[0].message, 400);
  }

  const fromDateUtc = toDateFromIsoDate(value.from);
  const toDateUtc = toDateFromIsoDate(value.to);

  if (!fromDateUtc || !toDateUtc) {
    return error(res, 'Rango de fechas invalido.', 400);
  }

  if (toDateUtc < fromDateUtc) {
    return error(res, 'La fecha final debe ser mayor o igual que la fecha inicial.', 400);
  }

  const isAdmin = req.user?.role === 'admin';
  const slots = await getSlotsInWindow({ fromDateUtc, toDateUtc });
  return success(
    res,
    slots.map((slot) => toPublicSlot(slot, isAdmin, req.user?.id)),
    'Calendario obtenido.'
  );
};

const createAvailabilitySlot = async (req, res) => {
  const { error: validationError, value } = createAvailabilitySchema.validate(req.body || {});
  if (validationError) {
    return error(res, validationError.details[0].message, 400);
  }

  const rangeError = validateRange(value.startMinute, value.endMinute);
  if (rangeError) return error(res, rangeError, 400);

  const dayDateUtc = toDateFromIsoDate(value.date);
  if (!dayDateUtc) return error(res, 'Fecha invalida.', 400);

  const dateKey = toDateKey(dayDateUtc);
  const daySlots = await getExistingDaySlots(dateKey);
  const hasCollision = daySlots.some((slot) =>
    intersects(value.startMinute, value.endMinute, slot.startMinute, slot.endMinute)
  );

  if (hasCollision) {
    return error(res, 'No se puede habilitar el bloque: existe traslape con otro horario.', 409);
  }

  const mergedSlot = await mergeAdjacentAvailableSlots({
    daySlots,
    startMinute: value.startMinute,
    endMinute: value.endMinute,
    dayDateUtc,
    detail: value.detail,
  });

  if (mergedSlot) {
    return success(res, toPublicSlot(mergedSlot.toObject(), true), 'Bloque disponible actualizado.');
  }

  const startDateTime = minutesToDate(dayDateUtc, value.startMinute);
  const endDateTime = minutesToDate(dayDateUtc, value.endMinute);

  const created = await ClassCalendarSlot.create({
    dateKey,
    startDateTime,
    endDateTime,
    startMinute: value.startMinute,
    endMinute: value.endMinute,
    status: 'available',
    adminEmail: req.user.email,
    adminId: req.user.id,
    detail: value.detail,
  });

  return success(res, toPublicSlot(created.toObject(), true), 'Bloque disponible creado.', 201);
};

const reserveSlot = async (req, res) => {
  const { error: validationError, value } = reserveSlotSchema.validate(req.body || {});
  if (validationError) {
    return error(res, validationError.details[0].message, 400);
  }

  const rangeError = validateRange(value.startMinute, value.endMinute);
  if (rangeError) return error(res, rangeError, 400);

  const requestedMinutes = value.endMinute - value.startMinute;
  if (requestedMinutes > 180) {
    return error(res, 'No puedes reservar mas de 3 horas en un mismo dia.', 400);
  }

  const dayDateUtc = toDateFromIsoDate(value.date);
  if (!dayDateUtc) return error(res, 'Fecha invalida.', 400);
  const dateKey = toDateKey(dayDateUtc);

  const daySlots = await getExistingDaySlots(dateKey);
  const availableSlots = daySlots.filter((slot) => slot.status === 'available');
  const blockingSlots = daySlots.filter((slot) => slot.status === 'pending' || slot.status === 'booked');

  const coveringAvailable = availableSlots.find((slot) =>
    canReserveInsideAvailable({ availableSlot: slot, startMinute: value.startMinute, endMinute: value.endMinute })
  );

  if (!coveringAvailable) {
    return error(res, 'El rango solicitado no cabe dentro de un bloque disponible.', 409);
  }

  const availableMinuteSet = buildMinuteSet(availableSlots);
  for (let minute = value.startMinute; minute < value.endMinute; minute += 30) {
    if (!availableMinuteSet.has(minute)) {
      return error(res, 'El rango solicitado contiene minutos no disponibles.', 409);
    }
  }

  const hasBlockedCollision = blockingSlots.some((slot) =>
    intersects(value.startMinute, value.endMinute, slot.startMinute, slot.endMinute)
  );
  if (hasBlockedCollision) {
    return error(res, 'El horario solicitado ya esta en proceso o reservado.', 409);
  }

  const studentOwnedReservedMinutes = daySlots
    .filter((slot) => {
      if (slot.status !== 'pending' && slot.status !== 'booked') return false;
      return String(slot.student?.id || '') === String(req.user?.id || '');
    })
    .reduce((total, slot) => total + Math.max(0, slot.endMinute - slot.startMinute), 0);

  if (studentOwnedReservedMinutes + requestedMinutes > 180) {
    return error(res, 'No puedes superar 3 horas acumuladas en un mismo dia.', 400);
  }

  const student = await Student.findById(req.user.id).lean();
  if (!student) {
    return error(res, 'Estudiante no encontrado.', 404);
  }

  const startDateTime = minutesToDate(dayDateUtc, value.startMinute);
  const endDateTime = minutesToDate(dayDateUtc, value.endMinute);

  const createdPending = await ClassCalendarSlot.create({
    dateKey,
    startDateTime,
    endDateTime,
    startMinute: value.startMinute,
    endMinute: value.endMinute,
    status: 'pending',
    adminEmail: coveringAvailable.adminEmail,
    adminId: coveringAvailable.adminId || null,
    detail: value.detail || 'Solicitud de clase',
    student: {
      id: student._id,
      email: student.email,
      name: student.name,
      lastName: student.lastName,
    },
    requestedAt: new Date(),
  });

  const admins = await Admin.find({}).select('email').lean();
  const adminEmails = [...new Set(admins.map((admin) => String(admin?.email || '').trim().toLowerCase()).filter(Boolean))];
  const studentDisplayName = `${student.name || ''} ${student.lastName || ''}`.trim() || student.email;

  await Promise.allSettled(
    adminEmails.map((adminEmail) =>
      sendClassScheduleRequestEmail({
        to: adminEmail,
        studentName: studentDisplayName,
        studentEmail: student.email,
        dateKey,
        startMinute: value.startMinute,
        endMinute: value.endMinute,
      })
    )
  );

  return success(res, toPublicSlot(createdPending.toObject(), false, req.user?.id), 'Solicitud enviada.', 201);
};

const approvePendingSlot = async (req, res) => {
  const slotId = String(req.params.slotId || '').trim();
  if (!slotId) return error(res, 'Id de bloque invalido.', 400);

  const pendingSlot = await ClassCalendarSlot.findOne({ _id: slotId, status: 'pending' });
  if (!pendingSlot) {
    return error(res, 'No existe una solicitud pendiente para aprobar.', 404);
  }

  pendingSlot.status = 'booked';
  pendingSlot.bookedAt = new Date();
  await pendingSlot.save();

  if (pendingSlot.student?.email) {
    const fullName = `${pendingSlot.student.name || ''} ${pendingSlot.student.lastName || ''}`.trim();
    sendClassScheduleApprovedEmail({
      to: pendingSlot.student.email,
      studentName: fullName,
      dateKey: pendingSlot.dateKey,
      startMinute: pendingSlot.startMinute,
      endMinute: pendingSlot.endMinute,
    }).catch(() => null);
  }

  return success(res, toPublicSlot(pendingSlot.toObject(), true), 'Solicitud aprobada.');
};

const deleteSlot = async (req, res) => {
  const slotId = String(req.params.slotId || '').trim();
  if (!slotId) return error(res, 'Id de bloque invalido.', 400);

  const requesterRole = String(req.user?.role || '').toLowerCase();

  if (requesterRole === 'admin') {
    const deleted = await ClassCalendarSlot.findByIdAndDelete(slotId).lean();
    if (!deleted) return error(res, 'Bloque no encontrado.', 404);

    const isStudentOwned = Boolean(deleted?.student?.email);
    const wasPendingOrBooked = deleted?.status === 'pending' || deleted?.status === 'booked';
    if (isStudentOwned && wasPendingOrBooked) {
      const fullName = `${deleted.student?.name || ''} ${deleted.student?.lastName || ''}`.trim();
      sendClassScheduleRejectedEmail({
        to: deleted.student.email,
        studentName: fullName || deleted.student.email,
        dateKey: deleted.dateKey,
        startMinute: deleted.startMinute,
        endMinute: deleted.endMinute,
        previousStatus: deleted.status,
      }).catch(() => null);
    }

    return success(res, { id: slotId }, 'Bloque eliminado.');
  }

  const deletedOwnPending = await ClassCalendarSlot.findOneAndDelete({
    _id: slotId,
    status: { $in: ['pending', 'booked'] },
    'student.id': req.user?.id,
  }).lean();

  if (!deletedOwnPending) {
    const existing = await ClassCalendarSlot.findById(slotId).select('_id').lean();
    if (!existing) return error(res, 'Bloque no encontrado.', 404);
    return error(res, 'No tienes permisos para eliminar este bloque.', 403);
  }

  return success(res, { id: slotId }, 'Bloque eliminado.');
};

module.exports = {
  listCalendarSlots,
  createAvailabilitySlot,
  reserveSlot,
  approvePendingSlot,
  deleteSlot,
};
