const app = require('../server/src/app');
const connectDB = require('../server/src/config/db');

let isDbConnected = false;

module.exports = async (req, res) => {
  try {
    if (!isDbConnected) {
      await connectDB();
      isDbConnected = true;
    }

    return app(req, res);
  } catch (error) {
    console.error('Error en función serverless /api/index.js:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno en la API',
    });
  }
};