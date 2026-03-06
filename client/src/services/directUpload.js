export const uploadToSignedUrl = ({ uploadUrl, file, mimeType, onProgress }) => {
  return new Promise((resolve, reject) => {
    if (!uploadUrl) {
      reject(new Error('Falta uploadUrl para la carga directa.'));
      return;
    }

    if (!file) {
      reject(new Error('Falta archivo para la carga directa.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', mimeType || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (typeof onProgress !== 'function') return;
      const total = event.total || file.size || 0;
      const loaded = event.loaded || 0;
      onProgress({ loaded, total });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ status: xhr.status });
        return;
      }

      reject(
        new Error(
          `Fallo la carga directa a GCS (status ${xhr.status || 'desconocido'}).`
        )
      );
    };

    xhr.onerror = () => {
      reject(new Error('Error de red durante la carga directa a GCS.'));
    };

    xhr.onabort = () => {
      reject(new Error('La carga directa fue cancelada.'));
    };

    xhr.send(file);
  });
};
