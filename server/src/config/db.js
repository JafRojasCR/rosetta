const mongoose = require('mongoose');
const { mongodbUri } = require('./env');

const connectDB = async () => {
  try {
    await mongoose.connect(mongodbUri);
    console.log('MongoDB conectado correctamente');
  } catch (error) {
    console.error('Error al conectar MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
