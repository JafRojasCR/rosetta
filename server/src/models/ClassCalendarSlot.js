const mongoose = require('mongoose');

const slotStatuses = ['available', 'pending', 'booked'];

const classCalendarSlotSchema = new mongoose.Schema(
  {
    bookedCode: {
      type: String,
      required: true,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString(),
      trim: true,
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    startDateTime: {
      type: Date,
      required: true,
      index: true,
    },
    endDateTime: {
      type: Date,
      required: true,
      index: true,
    },
    startMinute: {
      type: Number,
      required: true,
      min: 0,
      max: 1410,
    },
    endMinute: {
      type: Number,
      required: true,
      min: 30,
      max: 1440,
    },
    status: {
      type: String,
      enum: slotStatuses,
      default: 'available',
      index: true,
    },
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    student: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        default: null,
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        default: '',
      },
      name: {
        type: String,
        trim: true,
        default: '',
      },
      lastName: {
        type: String,
        trim: true,
        default: '',
      },
    },
    detail: {
      type: String,
      trim: true,
      default: '',
    },
    requestedAt: {
      type: Date,
      default: null,
    },
    bookedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

classCalendarSlotSchema.index({ dateKey: 1, status: 1, startMinute: 1, endMinute: 1 });

module.exports = {
  ClassCalendarSlot: mongoose.model('ClassCalendarSlot', classCalendarSlotSchema),
  SLOT_STATUSES: slotStatuses,
};
