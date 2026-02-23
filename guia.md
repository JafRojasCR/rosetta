# Guía de subida y manejo de archivos (Rosetta)

Esta guía explica cómo funciona la subida de archivos en el backend (Node/Express) del proyecto Rosetta: qué rutas intervienen, cómo se guardan los archivos, cómo se "analizan" (en el caso de pagos) y qué se hace con esa información.

---

## 1. Configuración base de uploads

**Archivo clave:** server/src/middlewares/upload.js

- Se utiliza `multer` con `diskStorage` para guardar archivos en disco.
- El directorio de subida se toma de `UPLOAD_DIR` en el `.env`, o por defecto `uploads`.
  - Configurado en server/src/config/env.js
  - La ruta final usada por `multer` es la variable `uploadDir`, que por defecto apunta a `uploads` en el root del proyecto backend.
- El nombre de archivo se genera como:
  - `Date.now()` + un número aleatorio + extensión original.
- Filtro de tipos (`fileFilter`): solo se aceptan:
  - `image/jpeg`, `image/png`, `image/jpg`, `application/pdf`.
- Límite de tamaño: 5 MB por archivo.

**Resultado:**
- Cada vez que se sube un archivo válido, se guarda físicamente en la carpeta `uploads/` del servidor con un nombre único.

---

## 2. Dónde se sirven/usan esos archivos

En los controladores, cuando se guarda un documento o un pago, se almacena en la base de datos una URL relativa del archivo:

- Para documentos: `/uploads/<filename>` (campo `fileUrl`).
- Para comprobantes de pago: `/uploads/<filename>` (campo `billUrl`).

Típicamente, el servidor Express expone la carpeta `uploads` como estática (esto suele hacerse en app.js o server.js). De esta forma, el frontend puede acceder a:

- `http(s)://TU_API/uploads/<filename>`

> Nota: Si cambias `UPLOAD_DIR` en el `.env`, asegúrate de que coincida con la carpeta servida estáticamente por Express.

---

## 3. Subida de documentos (imágenes/PDF)

**Modelo:** server/src/models/Document.js

Campos relevantes:
- `docId`: identificador interno del documento (ej. `DOC-<timestamp>`).
- `title`, `description`: metadatos visibles en el frontend.
- `date`: fecha del documento.
- `fileUrl`: ruta relativa al archivo subido (ej. `/uploads/1234567890-999999999.pdf`).
- `subject`: objeto con `subjectId` y `name`.
- `adminEmail`: correo del admin que subió el documento.

**Controlador:** server/src/controllers/documentController.js

Ruta: `POST /api/documents`
- Protegida por middleware: solo admins.
- Middlewares en cadena:
  - `protect` (autenticación JWT).
  - `adminOnly` (valida que sea admin).
  - `upload.single('file')` (usa multer para recibir un archivo en el campo `file`).
- Validación de body con Joi:
  - `title` (obligatorio).
  - `description` (opcional).
  - `subject` (objeto con `subjectId` y `name`, ambos obligatorios).

**Flujo para crear documento:**
1. El cliente (frontend) hace un `POST` a `/api/documents` con:
   - Headers de autenticación (token JWT de admin).
   - `Content-Type: multipart/form-data`.
   - Campo de archivo: `file` (imagen JPEG/JPG/PNG o PDF, máx 5 MB).
   - Campos de texto en el mismo form-data: `title`, `description`, `subject[subjectId]`, `subject[name]`.
2. `upload.single('file')` procesa el archivo:
   - Lo guarda en la carpeta `uploads/` con un nombre único.
   - Agrega `req.file` con información del archivo (incluye `filename` y `path`).
3. `createDocument` verifica:
   - Que `req.file` exista; si no, responde `400 Archivo requerido.`.
   - Valida el body con Joi.
4. Si todo es correcto:
   - Genera `docId = 'DOC-' + Date.now()`.
   - Crea un registro en MongoDB (colección `documents`) con:
     - `fileUrl: '/uploads/' + req.file.filename`.
     - `adminEmail: req.user.email`.
5. Respuesta:
   - `201 Documento creado exitosamente` con los datos del documento (sin el archivo dentro, solo la URL).

**Qué se hace con el archivo del documento:**
- Se guarda como archivo estático en `uploads/`.
- No se analiza con IA ni se procesa adicionalmente en el backend en la implementación actual.
- El frontend puede utilizar `fileUrl` para mostrar/descargar el documento (imagen o PDF).

**Rutas relacionadas de documentos:**
- `GET /api/documents` → lista documentos (con filtro opcional por `subjectId`).
- `GET /api/documents/:docId` → detalle de un documento.
- `PUT /api/documents/:docId` → actualiza metadatos (no cambia el archivo en este código).
- `DELETE /api/documents/:docId` → elimina el documento en la base de datos (el archivo físico no se elimina automáticamente en este código).

---

## 4. Subida de comprobantes de pago

**Modelo de Pago:** server/src/models/Payment.js

(No se incluye aquí el contenido, pero es el que guarda `billUrl`, `billNumber`, `status`, etc.).

**Servicio de "IA":** server/src/services/paymentAIService.js

- Función `extractPaymentData(filePath)`:
  - Actualmente es un **mock** (no hay integración real con IA/OCR).
  - Muestra en consola: `[AI SERVICE] Procesando comprobante: <filePath>`.
  - Retorna un objeto simulado:
    - `classCode: null` (no se extrae realmente).
    - `date: new Date()`.
    - `billNumber: 'COMP-<timestamp>'`.
    - `amount: null`.
- Función `validatePayment(billNumber)`:
  - Revisa en la colección `payments` si ya existe un pago con ese `billNumber`.
  - Devuelve `true` si no existe (válido), `false` si ya existe (reutilizado).

**Controlador:** server/src/controllers/paymentController.js

Ruta: `POST /api/payments`
- Protegida para estudiantes:
  - `protect` (autenticación JWT).
  - `studentOnly` (valida que sea estudiante).
- Middlewares en cadena en la ruta (ver más abajo):
  - `upload.single('bill')` (usa multer para recibir un archivo en el campo `bill`).

**Validación de body (Joi):**
- `classCode`: string requerido.
- `billNumber`: string requerido.

**Flujo para registrar un pago con comprobante:**
1. El cliente (frontend) hace un `POST` a `/api/payments` con:
   - Headers de autenticación (token JWT de estudiante).
   - `Content-Type: multipart/form-data`.
   - Campo de archivo: `bill` (imagen/FOTO del comprobante o PDF, máx 5 MB).
   - Campos de texto: `classCode`, `billNumber`.
2. `upload.single('bill')` procesa el archivo:
   - Lo guarda en `uploads/`.
   - Agrega `req.file` con `filename` y `path`.
3. En `createPayment`:
   - Valida el body (Joi).
   - Busca la clase por `classCode` en `Class`.
     - Si no existe, responde `404 Clase no encontrada.`.
   - Llama a `validatePayment(billNumber)` para asegurarse de que el comprobante no se usó antes.
     - Si fue usado, responde `409 Este comprobante ya fue utilizado.`.
   - Si `req.file` existe:
     - `billUrl = '/uploads/' + req.file.filename`.
     - `extractedData = await extractPaymentData(req.file.path)`.
   - Genera `paymentId = 'PAY-' + Date.now()`.
   - Crea un pago con:
     - `date: extractedData.date || new Date()`.
     - `billNumber: value.billNumber`.
     - `billUrl` (si hubo archivo).
     - `studentEmail: req.user.email`.
     - `classCode: value.classCode`.
     - `status: 'pendiente'`.
4. Respuesta:
   - `201 Pago registrado exitosamente` con los datos del pago.

**Qué se hace con el archivo del comprobante:**
- Se almacena en `uploads/` (igual que los documentos).
- Se pasa la ruta física `req.file.path` a `extractPaymentData`.
  - Actualmente **solo loguea en consola y devuelve datos simulados**.
  - No hay una lógica real de extracción de monto, código de clase, etc.
- Los datos simulados (`extractedData`) solo se usan para la fecha del pago (en este momento).

**Rutas relacionadas de pagos:**
- `GET /api/payments/my` → pagos del estudiante autenticado.
- `GET /api/payments/all` → todos los pagos (solo admin).
- `PATCH /api/payments/:paymentId/status` → cambiar estado (`pendiente`, `aprobado`, `rechazado`) — solo admin.

---

## 5. Rutas y middlewares de subida (resumen)

**Documentos** – server/src/routes/documentRoutes.js
- `router.post('/', protect, adminOnly, upload.single('file'), createDocument);`
  - Campo de archivo en el form-data: `file`.
  - Solo admins.

**Pagos** – server/src/routes/paymentRoutes.js
- `router.post('/', protect, studentOnly, upload.single('bill'), createPayment);`
  - Campo de archivo en el form-data: `bill`.
  - Solo estudiantes.

---

## 6. Dónde se guardan físicamente las imágenes/PDFs

- Carpeta física: `uploads/` (por defecto en la raíz del backend `server/` o donde indique `UPLOAD_DIR`).
- El nombre del archivo es generado automáticamente por `multer` (timestamp + número random + extensión original).
- En la base de datos **no se guarda el binario**, solo la URL relativa:
  - Documentos: `fileUrl` → `/uploads/<nombre_archivo>`.
  - Pagos: `billUrl` → `/uploads/<nombre_archivo>`.

A la hora de servirlos:
- Express debe tener algo como `app.use('/uploads', express.static(uploadDir));` (revisar app.js/server.js).
- El frontend debe construir la URL completa usando la base de la API + `fileUrl`/`billUrl`.

---

## 7. ¿Y los vídeos?

En el código actual:
- El middleware `upload` **no permite vídeos** porque el `fileFilter` solo acepta:
  - `image/jpeg`, `image/png`, `image/jpg`, `application/pdf`.
- No hay campos específicos ni controladores que trabajen con vídeos.

Para soportar vídeos, tendrías que:
1. Modificar `fileFilter` en server/src/middlewares/upload.js para aceptar `video/*` (por ejemplo `video/mp4`, `video/mpeg`, etc.).
2. Asegurarte de que el límite de tamaño (`limits.fileSize`) sea adecuado para vídeos (normalmente mucho mayores que 5 MB).
3. Añadir los campos necesarios en los modelos (por ejemplo, otra colección o campos en `Document` si quieres que un vídeo sea un tipo de documento).
4. Ajustar las rutas/controladores correspondientes para guardar y exponer la URL del vídeo.
5. En el frontend, manejar la reproducción de vídeo usando esa URL.

---

## 8. Resumen rápido de "qué debo hacer" para usarlo

### Para subir un documento (imagen o PDF)
1. Autenticarte como **admin** y obtener un token JWT.
2. Hacer un `POST` a `/api/documents` con `multipart/form-data`:
   - `file`: el archivo (imagen/PDF, máx 5 MB).
   - `title`: texto.
   - `description`: texto opcional.
   - `subject[subjectId]`: id de la materia.
   - `subject[name]`: nombre de la materia.
3. El backend guardará el archivo en `uploads/` y el registro en Mongo con `fileUrl`.
4. Usar `fileUrl` en el frontend para mostrar/descargar el documento.

### Para subir un comprobante de pago
1. Autenticarte como **estudiante** y obtener un token JWT.
2. Hacer un `POST` a `/api/payments` con `multipart/form-data`:
   - `bill`: imagen/PDF del comprobante.
   - `classCode`: código de la clase a pagar.
   - `billNumber`: número de comprobante (debe ser único).
3. El backend guardará el archivo en `uploads/`, validará que la clase exista y que el `billNumber` no se haya reutilizado.
4. Opcionalmente (en el futuro), `extractPaymentData` podría analizar realmente el comprobante usando OCR/IA.
5. El pago queda con estado `pendiente` hasta que un admin lo cambie a `aprobado` o `rechazado`.

Si quieres, puedo ampliar la guía con ejemplos exactos de peticiones `curl` o de uso desde el frontend React para subir estos archivos.