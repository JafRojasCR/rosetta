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

const parsedDocumentUploadMaxMb = Number(process.env.DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB);
const documentUploadMaxFileSizeMb =
  Number.isFinite(parsedDocumentUploadMaxMb) && parsedDocumentUploadMaxMb > 0
    ? parsedDocumentUploadMaxMb
    : 2048;

const parsedDocumentUploadChunkSizeMb = Number(process.env.DOCUMENT_UPLOAD_CHUNK_SIZE_MB);
const defaultDocumentChunkSizeMb = isVercel ? 4 : 32;
const normalizedDocumentChunkSizeMb =
  Number.isFinite(parsedDocumentUploadChunkSizeMb) && parsedDocumentUploadChunkSizeMb > 0
    ? Math.floor(parsedDocumentUploadChunkSizeMb)
    : defaultDocumentChunkSizeMb;
const documentUploadChunkSizeMb = isVercel
  ? Math.min(normalizedDocumentChunkSizeMb, 4)
  : normalizedDocumentChunkSizeMb;

const parsedStorageSignedUrlExpirySeconds = Number(process.env.STORAGE_SIGNED_URL_EXPIRY_SECONDS);
const storageSignedUrlExpirySeconds =
  Number.isFinite(parsedStorageSignedUrlExpirySeconds) && parsedStorageSignedUrlExpirySeconds > 30
    ? Math.floor(parsedStorageSignedUrlExpirySeconds)
    : 900;

const parsedStorageSignedUploadExpirySeconds = Number(
  process.env.STORAGE_SIGNED_UPLOAD_EXPIRY_SECONDS
);
const storageSignedUploadExpirySeconds =
  Number.isFinite(parsedStorageSignedUploadExpirySeconds) && parsedStorageSignedUploadExpirySeconds > 30
    ? Math.floor(parsedStorageSignedUploadExpirySeconds)
    : 900;

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rosetta',
  jwtSecret: process.env.JWT_SECRET || 'rosetta_dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  appBaseUrl: process.env.APP_BASE_URL || 'https://rosetta.jafrojas.com',
  nodeEnv,
  emailEnabled:
    process.env.EMAIL_ENABLED === '1' ||
    process.env.EMAIL_ENABLED === 'true' ||
    process.env.EMAIL_ENABLED === 'yes',
  emailUser: process.env.EMAIL_USER || '',
  emailPass: process.env.EMAIL_PASS || '',
  emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
  emailClientId: process.env.EMAIL_CLIENT_ID || '',
  emailClientSecret: process.env.EMAIL_CLIENT_SECRET || '',
  emailRefreshToken: process.env.EMAIL_REFRESH_TOKEN || '',
  uploadDir,
  classUploadMaxFileSizeMb,
  documentUploadMaxFileSizeMb,
  documentUploadChunkSizeMb,
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
    process.env.GOOGLE_DRIVE_CLASSES_VIDEOS_FOLDER_ID || '',
  googleDrivePaymentsFolderId:
    process.env.GOOGLE_DRIVE_PAYMENTS_FOLDER_ID || '',
  storageProvider: String(process.env.STORAGE_PROVIDER || 'gcs').toLowerCase(),
  gcsEnabled:
    process.env.GCS_ENABLED === '1' ||
    process.env.GCS_ENABLED === 'true' ||
    String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'gcs',
  gcsProjectId: process.env.GCS_PROJECT_ID || '',
  gcsBucketName: process.env.GCS_BUCKET_NAME || '',
  gcsSignedUrlExpirySeconds: storageSignedUrlExpirySeconds,
  gcsSignedUploadExpirySeconds: storageSignedUploadExpirySeconds,
  gcsCredentialsJson: process.env.GCS_CREDENTIALS_JSON || '',
  gcsCredentialsBase64: process.env.GCS_CREDENTIALS_BASE64 || '',
  gcsCredentialsFile: process.env.GCS_CREDENTIALS_FILE || '',
  gcsDocumentsPrefix: process.env.GCS_DOCUMENTS_PREFIX || 'documents',
  gcsClassesPrefix: process.env.GCS_CLASSES_PREFIX || 'classes',
  gcsPaymentsPrefix: process.env.GCS_PAYMENTS_PREFIX || 'payments',
};
