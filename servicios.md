# Documentación de servicios (endpoints)

Resumen: Los endpoints están implementados por los controladores en `server/src/controllers/`.

Controladores principales encontrados:
- `authController.js` — autenticación, 2FA, recuperación de contraseña.
- `adminController.js` — gestión de administradores y operaciones administrativas.
- `classController.js` — CRUD y operaciones sobre `Class`.
- `classCalendarController.js` — calendario y slots de clases.
- `documentController.js` — gestión de documentos (upload, list, download).
- `paymentController.js` — manejo de comprobantes y estado de pagos.
- `subjectController.js` — CRUD de materias.

Métodos HTTP utilizados:
- GET: obtener recursos y listados.
- POST: crear recursos, login, subir archivos.
- PUT/PATCH: actualizar recursos existentes.
- DELETE: eliminar recursos.

Parámetros de entrada (generales):
- Rutas REST: parámetros por ruta (`/api/classes/:id`) y query params para filtros.
- Cuerpo JSON: (ej. `{ email, password }`, `{ title, date, price }`).
- Multipart/form-data: para uploads (`recordingFile`, `canvaFile`, `billFile`).
- Headers: `Authorization: Bearer <token>` para endpoints protegidos.

Respuestas esperadas:
- Respuestas JSON consistentes: `{ success: true, data: {...} }` o `{ success: false, error: 'mensaje' }`.
- Los controladores retornan objetos con los modelos serializados (sin campos sensibles como `password`).

Ejemplo de endpoints (extracto):
- `POST /api/auth/login` → body `{ email, password }` → respuesta `{ token, user }`.
- `POST /api/payments` → subir comprobante → respuesta `{ success: true, payment }`.
- `GET /api/classes` → lista de clases → respuesta `{ success: true, data: [ ... ] }`.

Dónde revisar implementaciones concretas:
- Las rutas están en `server/src/routes/` y conectan las rutas a los controladores.
- Revisar `server/src/controllers/*.js` para parámetros esperados y estructura de respuesta.
