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

const parsedClassUploadMaxMb = Number(process.env.CLASS_UPLOAD_MAX_FILE_SIZE_MB);
const classUploadMaxFileSizeMb = Number.isFinite(parsedClassUploadMaxMb) && parsedClassUploadMaxMb > 0
  ? parsedClassUploadMaxMb
  : 2048;

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rosetta',
  jwtSecret: process.env.JWT_SECRET || 'rosetta_dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv,
  emailUser: process.env.EMAIL_USER || '',
  emailPass: process.env.EMAIL_PASS || '',
  uploadDir,
  classUploadMaxFileSizeMb,
  isVercel,
  googleDriveEnabled:
    process.env.GOOGLE_DRIVE_ENABLED === '1' || process.env.GOOGLE_DRIVE_ENABLED === 'true',
  googleDriveClientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
  googleDriveClientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
  googleDriveRedirectUri:
    process.env.GOOGLE_DRIVE_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
  googleDriveRefreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '',
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  googleDriveClassesVideosFolderId:
    process.env.GOOGLE_DRIVE_CLASSES_VIDEOS_FOLDER_ID || '16GFwAhMJ1TpPH0hcUQWmp9v6MkBDV5lW',
};
