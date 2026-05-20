const mongoose = require('mongoose');
const { mongodbUri } = require('./env');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts = {
      // Keep pool small for serverless environments
      maxPoolSize: 5,
      // Avoid buffering commands when disconnected
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(mongodbUri, opts).then((m) => m);
  }

  cached.conn = await cached.promise;
  console.log('MongoDB conectado correctamente (cached)');
  return cached.conn;
}

module.exports = connectDB;
