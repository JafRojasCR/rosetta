require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}

// In Vercel Serverless, only /tmp is writable
// Outside Vercel, keep relative upload directory behavior
const rawUploadDir = process.env.UPLOAD_DIR || (isVercel ? '/tmp/uploads' : 'uploads');
const uploadDir = isVercel
  ? '/tmp/uploads'
  : rawUploadDir.replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/^\/+/, '') || 'uploads';

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rosetta',
  jwtSecret: process.env.JWT_SECRET || 'rosetta_dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv,
  emailUser: process.env.EMAIL_USER || '',
  emailPass: process.env.EMAIL_PASS || '',
  uploadDir,
  isVercel,
};
