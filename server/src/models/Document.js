const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    docId: {
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
    type: {
      type: String,
      enum: ['pdf', 'video'],
      default: 'pdf',
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    driveFileId: {
      type: String,
      trim: true,
      default: '',
    },
    subject: {
      subjectId: { type: String, required: true },
      name: { type: String, required: true },
    },
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
