const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    classCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: Date,
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    recordingUrl: {
      type: String,
      trim: true,
      default: null,
    },
    canvaUrl: {
      type: String,
      trim: true,
      default: null,
    },
    subject: {
      subjectId: { type: String, required: true },
      name: { type: String, required: true },
    },
    tutoredEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Class', classSchema);
