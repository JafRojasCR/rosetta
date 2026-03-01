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

const getDriveClient = () => {
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

  return google.drive({ version: 'v3', auth });
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
    uploaded: true,
    fileId,
    fileUrl: metadata.data.webViewLink || metadata.data.webContentLink,
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

const removeTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (_) {
    // ignore cleanup errors
  }
};

module.exports = {
  isDriveConfigured,
  getDriveClient,
  uploadFileToGoogleDrive,
  deleteFileFromGoogleDrive,
  removeTempFile,
};
