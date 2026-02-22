const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    billNumber: {
      type: String,
      required: true,
      trim: true,
    },
    billUrl: {
      type: String,
      trim: true,
      default: null,
    },
    studentEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    classCode: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pendiente', 'aprobado', 'rechazado'],
      default: 'pendiente',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
