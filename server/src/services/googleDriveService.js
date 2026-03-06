const fs = require('fs/promises');
const { google } = require('googleapis');
const {
  googleDriveEnabled,
  googleDriveClientId,
  googleDriveClientSecret,
  googleDriveRedirectUri,
  googleDriveRefreshToken,
  googleDriveFolderId,
} = require('../config/env');

const isDriveConfigured = () =>
  Boolean(
    googleDriveClientId &&
      googleDriveClientSecret &&
      googleDriveRedirectUri &&
      googleDriveRefreshToken &&
      googleDriveFolderId
  );

const getDriveAuthClient = () => {
  if (!googleDriveEnabled) return null;

  if (!isDriveConfigured()) {
    throw new Error('Google Drive (OAuth) esta habilitado pero faltan credenciales o carpeta.');
  }

  const auth = new google.auth.OAuth2(
    googleDriveClientId,
    googleDriveClientSecret,
    googleDriveRedirectUri
  );
  auth.setCredentials({ refresh_token: googleDriveRefreshToken });
  return auth;
};

const getDriveClient = () => {
  const auth = getDriveAuthClient();
  if (!auth) return null;

  return google.drive({ version: 'v3', auth });
};

const getDriveAccessToken = async () => {
  const auth = getDriveAuthClient();
  if (!auth) throw new Error('Google Drive deshabilitado.');

  const accessTokenResponse = await auth.getAccessToken();
  const token =
    typeof accessTokenResponse === 'string'
      ? accessTokenResponse
      : accessTokenResponse?.token || '';

  if (!token) {
    throw new Error('No se pudo obtener access token de Google Drive.');
  }

  return token;
};

const finalizeDriveFileUpload = async ({ fileId }) => {
  if (!googleDriveEnabled || !fileId) {
    throw new Error('No se puede finalizar archivo en Drive sin fileId o con Drive deshabilitado.');
  }

  const drive = getDriveClient();

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });

  const metadata = await drive.files.get({
    fileId,
    fields: 'id,webViewLink,webContentLink',
    supportsAllDrives: true,
  });

  return {
    fileId,
    fileUrl: metadata.data.webViewLink || metadata.data.webContentLink || null,
  };
};

const uploadFileToGoogleDrive = async ({ filePath, fileName, mimeType, folderId }) => {
  if (!googleDriveEnabled) {
    return { uploaded: false, fileUrl: null, fileId: null };
  }

  const drive = getDriveClient();
  const targetFolderId = folderId || googleDriveFolderId;

  let created;
  try {
    created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType,
        body: require('fs').createReadStream(filePath),
      },
      fields: 'id,webViewLink,webContentLink',
      supportsAllDrives: true,
    });
  } catch (err) {
    const apiMessage = err?.response?.data?.error?.message || err.message;
    throw new Error(`Error subiendo a Google Drive: ${apiMessage}`);
  }

  const fileId = created.data.id;

  const metadata = await finalizeDriveFileUpload({ fileId });

  return {
    uploaded: true,
    fileId,
    fileUrl: metadata.fileUrl,
  };
};

const deleteFileFromGoogleDrive = async (fileId) => {
  if (!googleDriveEnabled || !fileId) {
    return { deleted: false };
  }

  const drive = getDriveClient();

  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    return { deleted: true };
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) {
      return { deleted: false, notFound: true };
    }

    const apiMessage = err?.response?.data?.error?.message || err.message;
    throw new Error(`Error eliminando archivo en Google Drive: ${apiMessage}`);
  }
};

const createResumableUploadSession = async ({ fileName, mimeType, fileSize, folderId }) => {
  if (!googleDriveEnabled) {
    throw new Error('Google Drive deshabilitado.');
  }

  const targetFolderId = folderId || googleDriveFolderId;
  const token = await getDriveAccessToken();

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType || 'application/octet-stream',
        ...(Number.isFinite(fileSize) && fileSize > 0
          ? { 'X-Upload-Content-Length': String(fileSize) }
          : {}),
      },
      body: JSON.stringify({
        name: fileName,
        parents: [targetFolderId],
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`No se pudo iniciar carga resumable en Drive: ${details || response.status}`);
  }

  const uploadUrl = response.headers.get('location');
  if (!uploadUrl) {
    throw new Error('Google Drive no devolvio URL de sesion resumable.');
  }

  return { uploadUrl };
};

const uploadChunkToResumableSession = async ({
  uploadUrl,
  chunkBuffer,
  chunkStart,
  chunkEnd,
  fileSize,
  mimeType,
}) => {
  if (!uploadUrl) throw new Error('Falta uploadUrl para carga resumable.');
  if (!Buffer.isBuffer(chunkBuffer) || chunkBuffer.length === 0) {
    throw new Error('Chunk vacio o invalido.');
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Length': String(chunkBuffer.length),
      'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${fileSize}`,
    },
    body: chunkBuffer,
  });

  if (response.status === 308) {
    return { done: false, status: 308 };
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Error subiendo chunk a Drive: ${details || response.status}`);
  }

  const data = await response.json();
  const fileId = data?.id;
  if (!fileId) {
    throw new Error('Drive completo la carga pero no devolvio fileId.');
  }

  const metadata = await finalizeDriveFileUpload({ fileId });

  return {
    done: true,
    status: response.status,
    fileId,
    fileUrl: metadata.fileUrl,
  };
};

const downloadFileBufferFromGoogleDrive = async (fileId) => {
  if (!googleDriveEnabled || !fileId) {
    throw new Error('No se puede descargar de Google Drive sin fileId o con Drive deshabilitado.');
  }

  const drive = getDriveClient();

  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      {
        responseType: 'arraybuffer',
      }
    );

    return Buffer.from(response.data);
  } catch (err) {
    const apiMessage = err?.response?.data?.error?.message || err.message;
    throw new Error(`Error descargando archivo de Google Drive: ${apiMessage}`);
  }
};

const removeTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (_) {
    // ignore cleanup errors
  }
};

const buildDriveDirectMediaUrl = (fileId, resourceKey = '') => {
  const normalizedFileId = String(fileId || '').trim();
  if (!normalizedFileId) return '';

  const params = new URLSearchParams({
    export: 'download',
    id: normalizedFileId,
    confirm: 't',
  });

  const normalizedResourceKey = String(resourceKey || '').trim();
  if (normalizedResourceKey) {
    params.set('resourcekey', normalizedResourceKey);
  }

  return `https://drive.usercontent.google.com/download?${params.toString()}`;
};

const resolveDriveDirectMediaUrl = async ({ fileId, fallbackResourceKey = '' }) => {
  const normalizedFileId = String(fileId || '').trim();
  if (!normalizedFileId) return '';

  const fallbackUrl = buildDriveDirectMediaUrl(normalizedFileId, fallbackResourceKey);

  try {
    const drive = getDriveClient();
    if (!drive) return fallbackUrl;

    const metadata = await drive.files.get({
      fileId: normalizedFileId,
      fields: 'id,webContentLink,resourceKey',
      supportsAllDrives: true,
    });

    const webContentLink = String(metadata.data?.webContentLink || '').trim();
    if (webContentLink) {
      return webContentLink;
    }

    const resourceKey = String(metadata.data?.resourceKey || fallbackResourceKey || '').trim();
    return buildDriveDirectMediaUrl(normalizedFileId, resourceKey);
  } catch (_) {
    return fallbackUrl;
  }
};

const probeDriveDirectMediaUrl = async (url) => {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    return { ok: false, status: 0, reason: 'empty-url' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-1',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    const ok = response.status === 200 || response.status === 206;
    return {
      ok,
      status: response.status,
      reason: ok ? 'ok' : 'http-status',
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      reason: err?.name === 'AbortError' ? 'timeout' : 'request-failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

module.exports = {
  isDriveConfigured,
  getDriveAuthClient,
  getDriveClient,
  uploadFileToGoogleDrive,
  deleteFileFromGoogleDrive,
  downloadFileBufferFromGoogleDrive,
  createResumableUploadSession,
  uploadChunkToResumableSession,
  finalizeDriveFileUpload,
  buildDriveDirectMediaUrl,
  resolveDriveDirectMediaUrl,
  probeDriveDirectMediaUrl,
  removeTempFile,
};
