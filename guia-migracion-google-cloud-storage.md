# Guia Completa: Migracion de Drive a Google Cloud Storage (GCS) con Signed URLs

## 1. Objetivo de esta migracion

Este cambio mueve el sistema de archivos de Rosetta desde Google Drive hacia Google Cloud Storage, con este flujo:

`Browser -> Backend (Vercel) firma URL temporal -> Browser sube/descarga directo a GCS`

Beneficios directos:

- Se reduce fuertemente el FOT en Vercel para archivos grandes.
- Se elimina el cuello de botella de chunks pasando por backend.
- Se evita depender de CORS de Google Drive para subida/descarga directa.
- Los links de archivo dejan de ser permanentes: ahora son temporales (signed URLs) y expiran.

---

## 2. Cambios implementados en el codigo

### 2.1 Nuevas piezas backend

Se agrego el servicio:

- `server/src/services/googleCloudStorageService.js`

Funciones principales:

- Generacion de object keys por tipo (`documents`, `classes`, `payments`)
- Signed URL de subida (`action: write`)
- Signed URL de lectura (`action: read`)
- Upload server-side (para casos como comprobantes de pago con OCR local)
- Descarga/eliminacion/verificacion de existencia de objetos

### 2.2 Configuracion y dependencias

Se agrego dependencia en backend:

- `@google-cloud/storage`

Archivos modificados:

- `server/package.json`
- `server/src/config/env.js`
- `server/.env.example`

### 2.3 Cambios de schema/modelos

#### Documento (`server/src/models/Document.js`)

Campos nuevos:

- `storageProvider`: `gcs | drive | local`
- `storageObjectKey`: key interna del objeto en bucket

Se mantiene `driveFileId` para compatibilidad con registros viejos.

#### Clase (`server/src/models/Class.js`)

Campos nuevos para video/canva:

- `recordingStorageProvider`
- `recordingStorageObjectKey`
- `canvaStorageProvider`
- `canvaStorageObjectKey`

#### Pago (`server/src/models/Payment.js`)

Campos nuevos para comprobante:

- `billStorageProvider`
- `billStorageObjectKey`

### 2.4 Controladores migrados

#### Documentos

- `server/src/controllers/documentController.js`

Cambios clave:

- `POST /api/documents/upload/init` ahora entrega signed URL de subida a GCS + `objectKey`
- `POST /api/documents/upload/complete` valida existencia del objeto en GCS
- `PUT /api/documents/upload/chunk` ahora responde `410` (deprecated)
- `GET /api/documents/:docId/access-url` nuevo endpoint para obtener URL temporal de lectura
- Video embed stream usa redirect a signed URL cuando el documento es GCS
- Borrado elimina objeto en GCS (si aplica), con fallback legacy Drive

#### Clases

- `server/src/controllers/classController.js`

Cambios clave:

- `POST /api/classes/recording-upload/init` ahora entrega signed URL + `objectKey`
- `POST /api/classes/recording-upload/complete` valida objeto en GCS
- `PUT /api/classes/recording-upload/chunk` ahora responde `410` (deprecated)
- `GET /api/classes/:classCode/recording-access` nuevo endpoint (URL temporal)
- `GET /api/classes/:classCode/canva-access` nuevo endpoint (URL temporal)
- Embed stream de clase redirige a signed URL si video esta en GCS
- Create/Update class ahora soporta `recordingStorageObjectKey` y `canvaStorageObjectKey`
- Delete class elimina objetos GCS (si existen), con fallback legacy Drive

#### Pagos

- `server/src/controllers/paymentController.js`

Cambios clave:

- Comprobantes nuevos se almacenan en GCS
- OCR sigue ejecutando localmente (archivo temporal), luego se sube a GCS
- `GET /api/payments/:paymentId/bill-access-url` nuevo endpoint para URL temporal segura
- `GET /api/payments/my` y `GET /api/payments/all` devuelven `billUrl` ya adaptado a endpoint seguro
- Rechazo/cancelacion elimina objeto GCS (si aplica), con fallback legacy Drive

### 2.5 Rutas nuevas

#### Documentos

- `GET /api/documents/:docId/access-url`

#### Clases

- `GET /api/classes/:classCode/recording-access`
- `GET /api/classes/:classCode/canva-access`

#### Pagos

- `GET /api/payments/:paymentId/bill-access-url`

### 2.6 Frontend migrado

#### Admin documentos

- `client/src/features/documents/AdminDocumentsPage.jsx`

Ahora:

1. Pide signed upload URL (`/documents/upload/init`)
2. Sube directo con `fetch(uploadUrl, { method: 'PUT', body: file })`
3. Confirma (`/documents/upload/complete`)
4. Crea metadata (`/documents` con `storageObjectKey`)

#### Admin clases

- `client/src/features/admin/AdminClassesPage.jsx`

Ahora:

1. Pide signed upload URL (`/classes/recording-upload/init`)
2. Sube directo a GCS
3. Confirma (`/classes/recording-upload/complete`)
4. Guarda clase enviando `recordingStorageObjectKey`

#### Documentos (alumno)

- `client/src/features/documents/DocumentsPage.jsx`

Ahora pide URL temporal para:

- Vista PDF inline: `GET /documents/:docId/access-url?mode=inline`
- Descarga: `GET /documents/:docId/access-url?mode=download`

#### Pagos admin

- `client/src/features/admin/AdminPaymentsPage.jsx`

Ahora consume `GET /payments/:paymentId/bill-access-url` para visualizar comprobantes, sin parsear links Drive.

#### Class detail

- `client/src/features/classes/ClassDetailPage.jsx`

Botones de recursos ahora piden URL segura de backend (`recording-access`, `canva-access`) antes de abrir.

---

## 3. Variables de entorno nuevas

Definidas en `server/.env.example` y leidas desde `server/src/config/env.js`.

```env
STORAGE_PROVIDER=gcs
GCS_ENABLED=true
GCS_PROJECT_ID=
GCS_BUCKET_NAME=
GCS_CREDENTIALS_JSON=
GCS_CREDENTIALS_BASE64=
GCS_CREDENTIALS_FILE=
STORAGE_SIGNED_URL_EXPIRY_SECONDS=900
STORAGE_SIGNED_UPLOAD_EXPIRY_SECONDS=900
GCS_DOCUMENTS_PREFIX=documents
GCS_CLASSES_PREFIX=classes
GCS_PAYMENTS_PREFIX=payments
```

Notas:

- `GCS_CREDENTIALS_JSON`: JSON completo del service account (texto plano)
- `GCS_CREDENTIALS_BASE64`: mismo JSON pero en base64
- `GCS_CREDENTIALS_FILE`: path local al json (util para desarrollo local)
- Usa solo una estrategia de credenciales en runtime.

---

## 4. Setup en Google Cloud (paso a paso)

## 4.1 Crear proyecto

1. Crea o selecciona proyecto en Google Cloud.
2. Habilita facturacion.

## 4.2 Habilitar API requerida

Habilita:

- Cloud Storage JSON API

## 4.3 Crear bucket

Recomendado:

- Nombre global unico, por ejemplo `rosetta-files-prod`
- Region cercana a tus usuarios
- Uniform bucket-level access: habilitado
- Public access prevention: habilitado

No hagas bucket publico.

## 4.4 Crear service account

1. Crea service account, por ejemplo: `rosetta-storage-signer`.
2. Roles recomendados para este backend:
- `Storage Object Admin` (lectura/escritura/borrado de objetos)
- Opcionalmente `Storage Admin` si necesitas administracion completa de bucket

## 4.5 Generar credenciales

1. Crea key JSON del service account.
2. Guarda seguro.
3. Pasa ese JSON a Vercel via `GCS_CREDENTIALS_JSON` o base64 en `GCS_CREDENTIALS_BASE64`.

## 4.6 Configurar CORS del bucket

Ejemplo `cors.json`:

```json
[
  {
    "origin": [
      "https://tu-frontend.vercel.app",
      "http://localhost:5173"
    ],
    "method": ["GET", "PUT", "HEAD", "OPTIONS"],
    "responseHeader": [
      "Content-Type",
      "Content-Length",
      "Content-Range",
      "x-goog-resumable",
      "x-goog-meta-*"
    ],
    "maxAgeSeconds": 3600
  }
]
```

Aplicar (gcloud):

```bash
gsutil cors set cors.json gs://TU_BUCKET
```

Importante:

- Debe incluir tu dominio de Vercel exacto.
- Si usas varios entornos, agrega cada origin.

---

## 5. Setup en Vercel

Agrega en proyecto backend/serverless estas variables:

- `STORAGE_PROVIDER=gcs`
- `GCS_ENABLED=true`
- `GCS_PROJECT_ID=...`
- `GCS_BUCKET_NAME=...`
- `GCS_CREDENTIALS_JSON=...` (o base64/file)
- `STORAGE_SIGNED_URL_EXPIRY_SECONDS=900`
- `STORAGE_SIGNED_UPLOAD_EXPIRY_SECONDS=900`
- `GCS_DOCUMENTS_PREFIX=documents`
- `GCS_CLASSES_PREFIX=classes`
- `GCS_PAYMENTS_PREFIX=payments`

Tambien conserva tus variables actuales (`MONGODB_URI`, `JWT_SECRET`, etc.).

---

## 6. Flujo tecnico final

## 6.1 Subida (documentos/clases)

1. Frontend pide `/upload/init` con `fileName`, `mimeType`, `fileSize`.
2. Backend genera `objectKey` y signed upload URL.
3. Browser hace `PUT` directo a GCS.
4. Frontend llama `/upload/complete` para validar objeto.
5. Frontend guarda metadata en Mongo (`storageObjectKey`, etc.).

## 6.2 Descarga/visualizacion

1. Frontend pide endpoint seguro (`access-url`).
2. Backend valida permisos.
3. Backend responde URL temporal firmada.
4. Browser abre ese URL y descarga/reproduce directo desde GCS.

---

## 7. Seguridad y anti-sharing

Lo que SI se logra:

- Ya no se exponen links permanentes tipo Drive compartido.
- Cada URL temporal vence (TTL configurable).
- Cada solicitud de acceso pasa por autorizacion backend antes de firmar.

Lo que debes saber:

- Cualquier URL temporal abierta en navegador puede verse en DevTools mientras este activa.
- Mitigacion: expiraciones cortas (5-15 min), re-firma on-demand, permisos estrictos antes de firmar.

Recomendaciones extra:

- Mantener `STORAGE_SIGNED_URL_EXPIRY_SECONDS` bajo (ej. 300-900).
- No registrar URLs firmadas en logs.
- Agregar rate limit por usuario para endpoints de access-url.

---

## 8. Migracion de data historica (Drive -> GCS)

El codigo nuevo soporta fallback de registros legacy, pero te conviene migrarlos gradualmente.

Estrategia sugerida:

1. Exportar registros con `driveFileId` o URLs Drive.
2. Descargar cada archivo de Drive.
3. Subir a GCS con key estructurada (`documents/...`, `classes/...`, `payments/...`).
4. Actualizar registro Mongo:
- set `storageProvider = 'gcs'`
- set `storageObjectKey = ...`
- mantener `fileUrl`/`recordingUrl`/`billUrl` a endpoint API seguro
5. (Opcional) borrar archivo en Drive luego de verificar migracion.

Hazlo por lotes y con auditoria (log de IDs migrados + checksum si posible).

---

## 9. Checklist de verificacion post-migracion

## 9.1 Funcional

- [X] Subir documento grande desde admin funciona
- [X] Subir video de clase grande funciona
- [X] Visualizar PDF funciona en viewer
- [X] Descargar documento funciona
- [X] Ver video embebido de clase funciona
- [X] Ver comprobante en admin funciona
- [X] Rechazar pago elimina archivo en GCS

## 9.2 Seguridad

- [X] Bucket no publico
- [X] Solo signed URLs habilitan acceso
- [X] TTL de signed URLs configurado
- [X] Endpoint de access-url valida permisos por rol/usuario

## 9.3 Costos y performance

- [ ] FOT en Vercel baja despues de la migracion
- [ ] Tiempo de subida/descarga mejora
- [ ] Egress de GCS monitoreado en Cloud Billing

---

## 10. Archivos del repo que se tocaron en esta migracion

Backend:

- `server/package.json`
- `server/.env.example`
- `server/src/config/env.js`
- `server/src/services/googleCloudStorageService.js`
- `server/src/models/Document.js`
- `server/src/models/Class.js`
- `server/src/models/Payment.js`
- `server/src/controllers/documentController.js`
- `server/src/controllers/classController.js`
- `server/src/controllers/paymentController.js`
- `server/src/routes/documentRoutes.js`
- `server/src/routes/classRoutes.js`
- `server/src/routes/paymentRoutes.js`

Frontend:

- `client/src/features/documents/AdminDocumentsPage.jsx`
- `client/src/features/admin/AdminClassesPage.jsx`
- `client/src/features/documents/DocumentsPage.jsx`
- `client/src/features/admin/AdminPaymentsPage.jsx`
- `client/src/features/classes/ClassDetailPage.jsx`

---

## 11. Siguiente paso recomendado

Una vez valides que todo nuevo upload/download funciona en GCS:

1. Deja `GOOGLE_DRIVE_ENABLED=false` para nuevos flujos.
2. Ejecuta migracion de historicos por lotes.
3. Cuando no queden referencias activas a Drive, retira credenciales Drive del entorno.

Con esto, Rosetta queda desacoplado de los limites practicos de Drive+Vercel para archivos grandes y pasa a un modelo escalable y mas barato por GB transferido.
