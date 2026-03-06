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
    billStorageProvider: {
      type: String,
      enum: ['gcs', 'drive', 'local'],
      default: 'gcs',
    },
    billStorageObjectKey: {
      type: String,
      trim: true,
      default: '',
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
    amount: {
      type: Number,
      default: null,
    },
    recipient: {
      type: String,
      trim: true,
      default: '',
    },
    detail: {
      type: String,
      trim: true,
      default: '',
    },
    validationChecks: {
      hasBillNumber: { type: Boolean, default: false },
      hasDate: { type: Boolean, default: false },
      amountMatches: { type: Boolean, default: false },
      detailMatches: { type: Boolean, default: false },
      recipientMatches: { type: Boolean, default: false },
    },
    validationErrors: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['pendiente', 'aprobado', 'rechazado'],
      default: 'pendiente',
    },
    approvedManually: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
