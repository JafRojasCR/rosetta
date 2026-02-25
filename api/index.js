const app = require('../server/src/app');
const connectDB = require('../server/src/config/db');

let isDbConnected = false;

module.exports = async (req, res) => {
  if (!isDbConnected) {
    await connectDB();
    isDbConnected = true;
  }

  return app(req, res);
};