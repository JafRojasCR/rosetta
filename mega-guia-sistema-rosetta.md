# MEGA GUÍA TÉCNICA Y FUNCIONAL — ROSETTA

Versión: 1.0  
Fecha: 2026-03-02  
Audiencia: equipo técnico (dev frontend, dev backend, QA, soporte, DevOps)

---

## 1) Resumen ejecutivo

Rosetta es una plataforma educativa full-stack con:

- **Frontend** en React + Vite + Tailwind.
- **Backend** en Node.js + Express.
- **Base de datos** MongoDB (Mongoose).
- **Auth** con JWT + 2FA por correo.
- **Seguridad de sesión** con sesión única por cuenta (control por `sessionVersion`).
- **Gestión de contenido** (clases y recursos).
- **Pagos** con OCR + validación automática/manual.
- **Archivos** en Google Drive (con fallback/local temporal según flujo).
- **Uploads grandes** por bloques (chunk upload) vía backend.

---

## 2) Arquitectura general del sistema

## 2.1 Capas

1. **UI/Presentación (client)**
   - Render de pantallas, formularios y navegación.
   - Manejo de estado local y estado de autenticación global (`AuthContext`).
   - Consumo de API con Axios (`client/src/services/api.js`).

2. **API/Negocio (server)**
   - Exposición de endpoints REST bajo `/api`.
   - Validación de payload con Joi.
   - Reglas de negocio (auth, clases, pagos, documentos, administración).

3. **Persistencia (MongoDB)**
   - Modelos: Student, Admin, Class, Payment, Document, Subject, AuthVerificationToken.

4. **Servicios externos**
   - Correo (2FA y recuperación de contraseña).
   - Google Drive (subida, permisos públicos, streaming por backend).
   - OCR (Tesseract + parsing heurístico para comprobantes).

---

## 2.2 Flujo alto nivel (request lifecycle)

1. Cliente envía request a `/api/...`.
2. `app.js` aplica middlewares globales (`cors`, body parsers, rate limits).
3. Router principal enruta a módulo (`auth`, `classes`, `payments`, etc.).
4. `protect` valida JWT (si la ruta es protegida).
5. `adminOnly` / `studentOnly` aplica control de rol cuando corresponde.
6. Controlador ejecuta lógica + acceso a DB + servicios externos.
7. Respuesta uniforme con `success(...)` o `error(...)`.

Formato de respuesta estándar:

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": {}
}
```

Errores:

```json
{
  "success": false,
  "message": "Descripción del error",
  "errors": { "code": "..." }
}
```

---

## 3) Estructura de carpetas y responsabilidades

## 3.1 Raíz

- `client/`: SPA React.
- `server/`: API Express + lógica de negocio.
- `api/index.js`: entrada para despliegue serverless en Vercel.
- `vercel.json`: rewrites/build para frontend + API.

## 3.2 Frontend (`client/src`)

- `router/index.jsx`: mapa de rutas de la SPA.
- `context/AuthContext.jsx`: login, 2FA, sesión, logout, estado auth.
- `services/api.js`: instancia Axios + interceptores JWT/401.
- `hooks/useApi.js`: wrapper de requests con loading/error.
- `features/...`: páginas por dominio (`auth`, `classes`, `payments`, `documents`, `admin`, etc.).
- `components/ProtectedRoute.jsx`: guard de autenticación + rol.
- `layouts/*`: layouts de autenticación y de app principal.

## 3.3 Backend (`server/src`)

- `app.js`: bootstrap de middlewares y rutas.
- `routes/*.js`: definición de endpoints por módulo.
- `controllers/*.js`: lógica HTTP + negocio por caso de uso.
- `models/*.js`: esquemas Mongoose.
- `middlewares/*.js`: auth, upload y manejo de errores.
- `services/*.js`: integración externa (Drive, correo, OCR).
- `utils/apiResponse.js`: helper de respuestas uniformes.
- `config/env.js`: variables de entorno normalizadas.

---

## 4) Frontend: rutas, protección y navegación

## 4.1 Rutas públicas

- `/login`
- `/registro`
- `/verificacion-2fa`
- `/forgot-password`
- `/recoverPassword`

## 4.2 Rutas protegidas de estudiante

- `/dashboard`
- `/clases`
- `/clases/:classCode`
- `/pagos`
- `/pagos/nuevo` (redirecciona a `/pagos`)
- `/recursos`
- `/perfil`

## 4.3 Rutas protegidas de admin

- `/admin/dashboard`
- `/admin/clases`
- `/admin/pagos`
- `/admin/usuarios`
- `/admin/materias`
- `/admin/recursos`
- `/configuracion`

## 4.4 Control de acceso en `ProtectedRoute`

- Si no hay `user` => redirige a `/login`.
- Si `requiredRole` no coincide => redirige a `/dashboard`.
- Si pasa validación => renderiza children.

---

## 5) Autenticación y sesiones (lógica completa)

## 5.1 Login con 2FA (flujo)

1. `POST /api/auth/login` con email/password.
2. Backend valida credenciales en Student/Admin.
3. Crea registro temporal `AuthVerificationToken` con:
   - `tokenHash`
   - `codeHash`
   - `expiresAt` (10 min)
   - `purpose = login_2fa`
4. Envía código por correo.
5. Frontend guarda `pending2fa` en `sessionStorage`.

## 5.2 Verificación 2FA

`POST /api/auth/verify-2fa` soporta 2 modos:

### A) Verificación normal
- Payload: `verificationToken`, `code`, `deviceId`.
- Reglas:
  - Máx 5 intentos erróneos.
  - Bloqueo de 30s si excede intentos.
  - Token/código deben estar vigentes.

### B) Toma de sesión (force takeover)
- Payload: `forceTakeover=true`, `takeoverToken`, `deviceId`.
- Se usa cuando ya hay una sesión activa en otro dispositivo.

## 5.3 Sesión única por cuenta

Cada usuario (Student/Admin) tiene:

- `sessionVersion` (entero).
- `activeSession` con `deviceId`, `userAgent`, `ip`, timestamps.

Al completar 2FA exitosa:

1. `sessionVersion` incrementa (`+1`).
2. Se guarda snapshot de `activeSession`.
3. JWT se firma con claim `sv = sessionVersion`.

## 5.4 Revocación automática de sesión previa

Middleware `protect` compara:

- `sv` del token vs `sessionVersion` en DB.

Si no coincide:

- 401 con `errors.code = SESSION_REVOKED`.
- Frontend interceptor limpia localStorage y redirige a login.

## 5.5 Logout

- `POST /api/auth/logout` (protegido).
- Revoca sesión actual incrementando `sessionVersion`.
- Frontend limpia estado local (`token`, `user`, `role`, `pending2fa`).

## 5.6 Recuperación de contraseña

- `POST /api/auth/forgot-password` => genera token JWT de reset (15 min) y envía enlace.
- `POST /api/auth/verify-reset-code` y `POST /api/auth/reset-password` completan proceso.

---

## 6) Backend: mapa de rutas API

Base path: `/api`

## 6.1 Auth (`/api/auth`)

- `POST /register`
- `POST /login`
- `POST /resend-2fa`
- `POST /verify-2fa`
- `POST /forgot-password`
- `POST /verify-reset-code`
- `POST /reset-password`
- `GET /me` (protect)
- `PUT /change-password` (protect)
- `POST /logout` (protect)

## 6.2 Clases (`/api/classes`)

- `GET /` (listar + filtros)
- `GET /:classCode` (detalle)
- `POST /` (admin, multipart)
- `PUT /:classCode` (admin, multipart)
- `DELETE /:classCode` (admin)
- `GET /:classCode/embed-token` (protect)
- `GET /embed/:token` (player seguro)
- `GET /embed/:token/stream` (stream seguro)
- `PATCH /:classCode/vote` (student)

### Upload por chunks de video de clase
- `POST /recording-upload/init` (admin)
- `PUT /recording-upload/chunk` (admin, octet-stream)
- `POST /recording-upload/complete` (admin)

## 6.3 Pagos (`/api/payments`)

- `GET /my` (student)
- `GET /all` (admin)
- `POST /` (student, multipart campo `bill`)
- `DELETE /:paymentId` (student, solo no aprobados)
- `PATCH /:paymentId/status` (admin)

## 6.4 Documentos/Recursos (`/api/documents`)

- `GET /`
- `GET /:docId`
- `POST /` (admin)
- `PUT /:docId` (admin)
- `DELETE /:docId` (admin)
- `GET /:docId/embed-token`
- `GET /embed/:token`
- `GET /embed/:token/stream`

### Upload por chunks de documento/recurso
- `POST /upload/init` (admin)
- `PUT /upload/chunk` (admin, octet-stream)
- `POST /upload/complete` (admin)

## 6.5 Materias (`/api/subjects`)

- `GET /`
- `POST /` (admin)
- `PUT /:subjectId` (admin)
- `DELETE /:subjectId` (admin)

## 6.6 Administración (`/api/admin`)

- Perfil estudiante (self-service):
  - `PUT /profile` (student)
  - `DELETE /profile` (student)
- Gestión de estudiantes (admin):
  - `GET /students`
  - `GET /students/:email`
  - `PUT /students/:email`
  - `DELETE /students/:email`
- Gestión de admins (admin):
  - `GET /admins`
  - `POST /admins`
  - `PUT /admins/:email/password`
  - `DELETE /admins/:email`

---

## 7) Modelos de datos (lógica funcional)

## 7.1 Student

Campos relevantes:
- Identidad: `email`, `name`, `lastName`, `phone`.
- Seguridad: `password` (bcrypt), `sessionVersion`, `activeSession`.
- Auditoría: `lastLoginAt`, timestamps.

## 7.2 Admin

- `email`, `password`.
- `sessionVersion`, `activeSession`, `lastLoginAt`.

## 7.3 Class

- `classCode` único.
- `title`, `description`, `date`, `price`, `isPublic`.
- `recordingUrl`, `canvaUrl`.
- `subject { subjectId, name }`.
- `classStudents[]`: estado de acceso por estudiante (`unlocked`, `paymentDate`, `vote`).

## 7.4 Payment

- `paymentId`, `billNumber`, `billUrl`.
- `studentEmail`, `classCode`.
- Metadatos OCR: `amount`, `recipient`, `detail`.
- Resultado validación: `validationChecks`, `validationErrors`.
- Estado de negocio: `status = pendiente|aprobado|rechazado`, `approvedManually`.

## 7.5 Document

- `docId`, `title`, `description`, `type` (pdf/video), `fileUrl`.
- `driveFileId` para manejo en Google Drive.
- `subject`, `adminEmail`.

---

## 8) Subida de archivos: cómo funciona realmente

## 8.1 Estrategias de upload implementadas

Rosetta usa **2 estrategias** según módulo:

1. **Multipart clásico (Multer)**
   - Usado en ciertos endpoints de creación/edición.
   - Ideal para archivos más pequeños o flujo simple.

2. **Chunk upload vía backend + sesión resumable de Drive**
   - Usado para videos/archivos grandes (clases/recursos).
   - El navegador envía bloques al backend.
   - Backend retransmite a Google Drive usando `uploadUrl` resumable.

---

## 8.2 Flujo chunked upload (paso a paso)

### Paso 1: Init
`POST /api/classes/recording-upload/init` o `POST /api/documents/upload/init`

Request (JSON):
```json
{
  "fileName": "video.mp4",
  "mimeType": "video/mp4",
  "fileSize": 123456789
}
```

Response:
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://www.googleapis.com/upload/...",
    "chunkSize": 4194304
  }
}
```

### Paso 2: Envío de chunks
`PUT /api/.../chunk` con body binario (`application/octet-stream`) y headers:

- `X-Upload-Url`
- `X-Chunk-Start`
- `X-Chunk-End`
- `X-File-Size`
- `X-Mime-Type`

Backend valida tamaño máximo por chunk:
- En Vercel: ~4MB por bloque.
- Fuera de Vercel: mayor (configurado más alto).

### Paso 3: Complete
Cuando Drive devuelve `fileId`, frontend llama:
- `POST /api/classes/recording-upload/complete`
- o `POST /api/documents/upload/complete`

Payload:
```json
{ "fileId": "1AbCdEf..." }
```

Backend:
- Aplica permisos públicos (`anyone: reader`).
- Obtiene URL final (`webViewLink`/`webContentLink`).
- Devuelve `fileUrl` para guardar en la entidad.

---

## 8.3 Límites y tolerancia

- `app.js` separa rate limit global y rate limit de uploads.
- Uploads chunked tienen límite dedicado alto para evitar 429 durante cargas largas.
- Endpoints de upload se excluyen del limiter global para no castigar transferencias extensas.

---

## 8.4 Seguridad y control en archivos

- Tipos MIME validados por middlewares de Multer.
- Limpieza de temporales locales (`removeTempFile`) tras subir a Drive.
- Streaming de videos bajo token de embed para no exponer links internos directamente.

---

## 9) Pagos: OCR, reglas de validación y estados

## 9.1 Flujo de negocio de pagos

1. Estudiante sube comprobante (`POST /api/payments`, archivo `bill`).
2. Sistema sube comprobante a Drive.
3. OCR extrae texto del archivo.
4. Se parsean campos: número de comprobante, fecha, monto, destinatario, detalle.
5. Se aplican reglas de validación.
6. Se decide estado:
   - `aprobado` automático,
   - `pendiente` para revisión manual,
   - o rechazo inmediato sin crear pago (si falla severo).

---

## 9.2 Reglas clave actuales

### Regla dura 1: número de comprobante
Si no hay `billNumber` detectable:
- Se aborta operación con error 400.
- Se elimina archivo en Drive (cleanup).

### Regla dura 2: comprobante reutilizado
Si `validatePayment(billNumber)` indica repetido:
- Se rechaza con 409.

### Criterios core para estado
Se evalúan 3 criterios principales:

- `amountMatches`
- `recipientMatches`
- `detailMatches`

Conteo de fallos core:

- **0 fallos** → `aprobado` automático.
- **1 fallo** → `pendiente` (revisión manual).
- **2 o más fallos** → error 400 (no se crea el pago).

> Nota: la fecha (`hasDate`) se registra en checks, pero no es hard-fail core en la decisión principal actual.

### Duplicidad por clase en estado no resuelto
Si existe pago previo `pendiente` o `rechazado` para la misma clase:
- No permite nuevo upload hasta eliminar el anterior.

---

## 9.3 Efecto de aprobar pago

Al aprobar (automático o manual):

- Se busca `Class` y `Student`.
- Se actualiza/crea entrada en `classStudents`.
- Se marca `unlocked=true` con `unlockedAt`.
- El estudiante obtiene acceso a la clase.

Si admin rechaza:
- Se intenta borrar comprobante en Drive.
- Se mantiene trazabilidad del pago rechazado.

---

## 10) Clases y recursos: lógica funcional

## 10.1 Clases

- Filtro por materia/fecha/publicación.
- Código de clase (`classCode`) sigue patrón generado en frontend (prefijo de materia + fecha + orden).
- Clase puede incluir:
  - grabación (`recordingUrl`)
  - enlace Canva (`canvaUrl`)

Acceso de estudiante a detalle/video:
- Requiere estar desbloqueado en `classStudents` o ser admin.

## 10.2 Recursos (documentos)

- Tipo se deduce por MIME (`video/*` => video, sino pdf).
- Videos usan flujo embed + stream protegido.
- PDFs/documentos se listan y consumen según `fileUrl`.

---

## 11) Players seguros y streaming

Para videos de clases y recursos:

1. Se solicita token de embed (`.../embed-token`).
2. Se construye URL de iframe (`/api/.../embed/:token`).
3. Backend sirve HTML player seguro (sin descargar fácilmente).
4. El `<video>` consume stream desde `/api/.../embed/:token/stream`.

Beneficios:
- Controlar autorización en backend.
- Reducir exposición directa de enlaces sensibles.
- Soporte de range requests para reproducción progresiva.

---

## 12) Rate limiting y protección de API

Configuración principal en `server/src/app.js`:

- **Global limiter `/api`**: control general de solicitudes.
- **Auth limiter `/api/auth`**: más estricto para frenar brute force.
- **Upload limiter** para:
  - `/api/classes/recording-upload`
  - `/api/documents/upload`

Además:
- Upload endpoints se excluyen del limiter global para evitar 429 en cargas por bloques.

---

## 13) Variables de entorno críticas

## 13.1 Core
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `NODE_ENV`
- `APP_BASE_URL`

## 13.2 Correo
- `EMAIL_ENABLED`
- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`
- (opcionales OAuth mail) `EMAIL_CLIENT_ID`, `EMAIL_CLIENT_SECRET`, `EMAIL_REFRESH_TOKEN`

## 13.3 Upload/infra
- `UPLOAD_DIR`
- `CLASS_UPLOAD_MAX_FILE_SIZE_MB`
- `VERCEL`

## 13.4 Google Drive
- `GOOGLE_DRIVE_ENABLED`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REDIRECT_URI`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_DRIVE_CLASSES_VIDEOS_FOLDER_ID`
- `GOOGLE_DRIVE_PAYMENTS_FOLDER_ID`

---

## 14) API desde frontend: patrón de consumo

## 14.1 Axios base

`client/src/services/api.js`:

- `baseURL = VITE_API_URL || '/api'`.
- Inyecta `Authorization: Bearer <token>` si existe token.
- Intercepta 401 (excepto login) y limpia sesión local.
- Si código de error es `SESSION_REVOKED`, redirige a `/login?reason=session-revoked`.

## 14.2 Hook `useApi`

Ofrece:
- `loading`
- `error`
- métodos `get/post/put/del`

Esto simplifica manejo de estado de requests por pantalla.

---

## 15) Casos de uso funcionales (E2E)

## 15.1 Estudiante entra y paga una clase

1. Login + 2FA.
2. Entra a `Pagos`.
3. Sube comprobante.
4. OCR/validación determina estado.
5. Si aprobado, clase queda desbloqueada.
6. En `Clases`, puede reproducir grabación vía player seguro.

## 15.2 Admin publica recurso en video

1. Entra a panel admin.
2. Va a `AdminDocumentsPage`.
3. Inicia upload chunked a Drive (`init/chunk/complete`).
4. Guarda metadata del recurso (`POST /documents`).
5. Estudiantes ven recurso en `Recursos`.

## 15.3 Admin sube video de clase

1. Entra a `AdminClassesPage`.
2. Carga video por chunks (`classes/recording-upload/*`).
3. Crea/edita clase con `recordingUrl` y datos académicos.
4. Estudiante desbloqueado accede al contenido.

---

## 16) Seguridad funcional implementada

- JWT firmado con secreto configurable.
- Rutas protegidas por middleware.
- Control de rol por endpoint.
- 2FA por correo con token/código hash y expiración.
- Lock temporal de OTP por intentos fallidos.
- Sesión única por `sessionVersion`.
- Revocación en logout.
- Rate limiting por contexto.
- Control MIME y tamaños en uploads.

---

## 17) Observabilidad y troubleshooting

## 17.1 OCR debug

`paymentAIService` soporta logs detallados si `DEBUG_OCR` está activo (en no producción), útil para:
- Ver qué texto extrajo OCR.
- Entender por qué falló un criterio (`detail`, `amount`, etc.).

## 17.2 Problemas comunes

### 401 inesperado
- Verificar token expirado o sesión revocada por otro login.

### 409 en verify-2fa
- Conflicto de sesión activa (`ACTIVE_SESSION_EXISTS`), resolver con takeover.

### 429 en uploads
- Revisar configuración de upload limiter y tamaño de chunks.

### Upload incompleto
- Confirmar secuencia `init -> chunk(s) -> complete`.
- Revisar headers `X-...` en cada chunk.

---

## 18) Guía rápida para nuevos desarrolladores

1. Levantar entorno local (`npm run dev`).
2. Probar login + 2FA en frontend.
3. Confirmar endpoints en `/api/health` y módulos principales.
4. Revisar `router/index.jsx` para mapa de pantallas.
5. Revisar `server/src/routes/index.js` para mapa de API.
6. Entender `AuthContext` + `api.js` (base de sesión en cliente).
7. Entender `authMiddleware` + `authController` (base de sesión en servidor).
8. Probar un flujo completo:
   - crear clase
   - subir recurso
   - subir pago
   - aprobar pago
   - consumir clase

---

## 19) Anexos

## 19.1 Checklist técnico de despliegue

- [ ] Variables env cargadas correctamente.
- [ ] MongoDB accesible.
- [ ] JWT secret seguro en producción.
- [ ] Drive configurado y folder IDs correctos.
- [ ] Correo configurado para 2FA/reset.
- [ ] Rate limits ajustados para volumen real.
- [ ] Prueba de upload grande completada.
- [ ] Prueba de takeover de sesión completada.

## 19.2 Recomendaciones de mejora futura

- Centralizar documentación OpenAPI/Swagger.
- Agregar tracing de requests (request-id).
- Agregar métricas de upload por chunk y latencia OCR.
- Test automatizados E2E para flujo de pagos y sesión única.
- Políticas de retención de comprobantes y auditoría formal.

---

## 20) Referencia rápida de archivos clave

### Frontend
- `client/src/router/index.jsx`
- `client/src/context/AuthContext.jsx`
- `client/src/services/api.js`
- `client/src/features/admin/AdminClassesPage.jsx`
- `client/src/features/documents/AdminDocumentsPage.jsx`

### Backend
- `server/src/app.js`
- `server/src/routes/index.js`
- `server/src/routes/authRoutes.js`
- `server/src/routes/classRoutes.js`
- `server/src/routes/documentRoutes.js`
- `server/src/routes/paymentRoutes.js`
- `server/src/controllers/authController.js`
- `server/src/controllers/classController.js`
- `server/src/controllers/documentController.js`
- `server/src/controllers/paymentController.js`
- `server/src/middlewares/authMiddleware.js`
- `server/src/services/googleDriveService.js`
- `server/src/services/paymentAIService.js`
- `server/src/models/*.js`

---

### Fin de la MEGA GUÍA

Si quieres, en la siguiente iteración te la convierto a una versión “arquitectura para onboarding” con:

- diagrama de flujo por módulo,
- tabla de permisos por endpoint,
- matriz de errores HTTP por caso de uso,
- y checklist QA funcional por pantalla.
