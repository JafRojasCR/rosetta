# Guía de configuración de Google Drive con OAuth (Rosetta)

Esta guía configura la subida de archivos de **Documentos** y **Clases** usando credenciales **OAuth 2.0** (sin Service Account).

## 1) Crear credenciales OAuth en Google Cloud

1. Abre Google Cloud Console.
2. Crea o selecciona tu proyecto.
3. Habilita **Google Drive API**.
4. Ve a **APIs y servicios > Credenciales**.
5. Crea un **OAuth Client ID** tipo **Web application**.
6. En redirect URIs autorizadas agrega:
   - `https://developers.google.com/oauthplayground`

Guarda:
- `Client ID`
- `Client Secret`

## 2) Generar Refresh Token

Forma rápida con OAuth Playground:

1. Abre `https://developers.google.com/oauthplayground`.
2. Click en ícono de configuración y activa:
   - **Use your own OAuth credentials**
3. Ingresa tu `Client ID` y `Client Secret`.
4. En scopes agrega:
   - `https://www.googleapis.com/auth/drive.file`
5. Click en **Authorize APIs**.
6. Acepta permisos con la cuenta Google dueña de la carpeta.
7. Click en **Exchange authorization code for tokens**.
8. Copia el `refresh_token`.

## 3) Crear carpeta en Drive y obtener Folder ID

1. En Google Drive, crea una carpeta (ej. `RosettaUploads`).
2. Copia el ID desde la URL:
   - `https://drive.google.com/drive/folders/<FOLDER_ID>`

## 4) Configurar variables de entorno

En `server/.env`:

```dotenv
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_CLIENT_ID=TU_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET=TU_CLIENT_SECRET
GOOGLE_DRIVE_REDIRECT_URI=https://developers.google.com/oauthplayground
GOOGLE_DRIVE_REFRESH_TOKEN=TU_REFRESH_TOKEN
GOOGLE_DRIVE_FOLDER_ID=TU_FOLDER_ID
```

## 5) Reiniciar backend

Cada cambio en `.env` requiere reiniciar el servidor.

## 6) Qué rutas usan Drive

Con Drive activo (`GOOGLE_DRIVE_ENABLED=true`):

- `POST /api/documents` (campo `file`)
- `POST /api/classes` (campos opcionales `recordingFile`, `canvaFile`)
- `PUT /api/classes/:classCode` (campos opcionales `recordingFile`, `canvaFile`)

Los enlaces guardados en DB (`fileUrl`, `recordingUrl`, `canvaUrl`) serán enlaces públicos de Drive.

## 7) Fallback local

Si `GOOGLE_DRIVE_ENABLED=false`, el sistema vuelve al flujo local `/uploads`.

## 8) Errores comunes

- `invalid_grant`: refresh token inválido/expirado, genera uno nuevo.
- `access_denied`: cuenta OAuth no autorizó scope o credenciales incorrectas.
- `File not found`: `GOOGLE_DRIVE_FOLDER_ID` incorrecto.
- `insufficient permissions`: cuenta OAuth no tiene acceso real a la carpeta.
