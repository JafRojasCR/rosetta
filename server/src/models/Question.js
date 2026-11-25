const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    pregunta: {
      type: String,
      required: true,
      trim: true,
    },
    respuestas: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2 && arr.length <= 6,
        message: 'La pregunta debe tener entre 2 y 6 opciones de respuesta.',
      },
    },
    correcta: {
      type: Number,
      required: true,
      min: 0,
    },
    tipo: {
      type: String,
      required: true,
      trim: true,
    },
    subtipo: {
      type: String,
      default: '',
      trim: true,
    },
    explicacion: {
      type: String,
      default: '',
      trim: true,
    },
    imageObjectKey: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
