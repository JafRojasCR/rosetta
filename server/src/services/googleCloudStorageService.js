const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');
const {
  gcsEnabled,
  gcsProjectId,
  gcsBucketName,
  gcsCredentialsJson,
  gcsCredentialsBase64,
  gcsCredentialsFile,
  gcsSignedUrlExpirySeconds,
  gcsSignedUploadExpirySeconds,
  gcsDocumentsPrefix,
  gcsClassesPrefix,
  gcsPaymentsPrefix,
} = require('../config/env');

let storageClient = null;
let cachedCredentials = null;

const isGcsConfigured = () => Boolean(gcsBucketName);

const parseCredentials = () => {
  if (cachedCredentials) return cachedCredentials;

  const inlineJson = String(gcsCredentialsJson || '').trim();
  if (inlineJson) {
    try {
      // First attempt: raw JSON (single-line or multi-line if env supports it)
      cachedCredentials = JSON.parse(inlineJson);
      return cachedCredentials;
    } catch (err) {
      // Some deploy environments (or accidental .env edits) store the JSON
      // with escaped newlines ("\\n") or stripped into a single line.
      // Try to recover by un-escaping common patterns before failing.
      try {
        const unescaped = inlineJson.replace(/\\n/g, '\n');
        cachedCredentials = JSON.parse(unescaped);
        return cachedCredentials;
      } catch (_) {
        // Fall through to error below with helpful message
      }
      throw new Error(
        'Unable to parse GCS_CREDENTIALS_JSON. Provide a valid JSON service account key,\n' +
          'or use GCS_CREDENTIALS_BASE64 (base64 of the JSON), or set GCS_CREDENTIALS_FILE to a path.\n' +
          'If you placed the JSON directly in `.env`, convert it to base64 to avoid newline issues.'
      );
    }
  }

  const base64 = String(gcsCredentialsBase64 || '').trim();
  if (base64) {
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    cachedCredentials = JSON.parse(decoded);
    return cachedCredentials;
  }

  cachedCredentials = null;
  return null;
};

const getStorageClient = () => {
  if (!gcsEnabled) return null;
  if (storageClient) return storageClient;

  const credentials = parseCredentials();
  const options = {};

  if (gcsProjectId) {
    options.projectId = gcsProjectId;
  }

  if (credentials) {
    options.credentials = credentials;
  } else if (gcsCredentialsFile) {
    options.keyFilename = gcsCredentialsFile;
  }

  storageClient = new Storage(options);
  return storageClient;
};

const getBucket = () => {
  if (!gcsEnabled) {
    throw new Error('Google Cloud Storage deshabilitado.');
  }

  if (!isGcsConfigured()) {
    throw new Error('Google Cloud Storage habilitado pero falta GCS_BUCKET_NAME.');
  }

  const client = getStorageClient();
  return client.bucket(gcsBucketName);
};

const normalizeObjectKey = (value = '') => String(value || '').replace(/^\/+/, '').trim();

const sanitizeFilename = (value = '') =>
  String(value || 'file.bin')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');

const getPrefixByType = (type = '') => {
  const normalizedType = String(type || '').trim().toLowerCase();
  if (normalizedType === 'classes') return gcsClassesPrefix;
  if (normalizedType === 'payments') return gcsPaymentsPrefix;
  return gcsDocumentsPrefix;
};

const generateObjectKey = ({ type = 'documents', fileName = '' }) => {
  const prefix = normalizeObjectKey(getPrefixByType(type));
  const datePart = new Date().toISOString().slice(0, 10);
  const nonce = crypto.randomBytes(8).toString('hex');
  const normalizedName = sanitizeFilename(fileName || 'file.bin');

  return [prefix, datePart, `${nonce}-${normalizedName}`].filter(Boolean).join('/');
};

const getSignedUploadUrl = async ({ objectKey, mimeType }) => {
  const key = normalizeObjectKey(objectKey);
  if (!key) throw new Error('Falta objectKey para URL firmada de subida.');

  const file = getBucket().file(key);
  const expiresAt = Date.now() + gcsSignedUploadExpirySeconds * 1000;

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: expiresAt,
    contentType: mimeType || 'application/octet-stream',
  });

  return {
    uploadUrl: url,
    expiresIn: gcsSignedUploadExpirySeconds,
  };
};

const getSignedDownloadUrl = async ({ objectKey, inline = false }) => {
  const key = normalizeObjectKey(objectKey);
  if (!key) throw new Error('Falta objectKey para URL firmada de descarga.');

  const file = getBucket().file(key);
  const expiresAt = Date.now() + gcsSignedUrlExpirySeconds * 1000;
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error('Archivo no encontrado en Google Cloud Storage.');
  }

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: expiresAt,
    responseDisposition: inline ? 'inline' : 'attachment',
  });

  return {
    downloadUrl: url,
    expiresIn: gcsSignedUrlExpirySeconds,
  };
};

const uploadFileToGcs = async ({ filePath, objectKey, mimeType = 'application/octet-stream' }) => {
  const key = normalizeObjectKey(objectKey);
  if (!key) throw new Error('Falta objectKey para subir archivo a GCS.');

  const bucket = getBucket();
  await bucket.upload(filePath, {
    destination: key,
    metadata: {
      contentType: mimeType,
      cacheControl: 'private, max-age=0, no-store',
    },
  });

  return {
    uploaded: true,
    objectKey: key,
  };
};

const downloadFileBufferFromGcs = async (objectKey) => {
  const key = normalizeObjectKey(objectKey);
  if (!key) throw new Error('Falta objectKey para descargar desde GCS.');

  const file = getBucket().file(key);
  const [buffer] = await file.download();
  return buffer;
};

const deleteFileFromGcs = async (objectKey) => {
  const key = normalizeObjectKey(objectKey);
  if (!key) return { deleted: false };

  const file = getBucket().file(key);
  try {
    await file.delete();
    return { deleted: true };
  } catch (err) {
    if (err?.code === 404) {
      return { deleted: false, notFound: true };
    }
    throw err;
  }
};

const ensureObjectExists = async (objectKey) => {
  const key = normalizeObjectKey(objectKey);
  if (!key) return false;

  const file = getBucket().file(key);
  const [exists] = await file.exists();
  return Boolean(exists);
};

const removeTempFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(path.resolve(filePath));
  } catch (_) {
    // ignore cleanup failures
  }
};

module.exports = {
  isGcsConfigured,
  normalizeObjectKey,
  generateObjectKey,
  getSignedUploadUrl,
  getSignedDownloadUrl,
  uploadFileToGcs,
  downloadFileBufferFromGcs,
  deleteFileFromGcs,
  ensureObjectExists,
  removeTempFile,
};
