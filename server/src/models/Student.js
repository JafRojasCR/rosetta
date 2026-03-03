const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    sessionVersion: {
      type: Number,
      default: 0,
    },
    activeSession: {
      deviceId: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      ip: { type: String, default: '' },
      startedAt: { type: Date, default: null },
      lastSeenAt: { type: Date, default: null },
    },
    twoFactorCode: {
      type: String,
      default: null,
    },
    twoFactorExpiry: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

studentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

studentSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

studentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorCode;
  delete obj.twoFactorExpiry;
  return obj;
};

module.exports = mongoose.model('Student', studentSchema);
