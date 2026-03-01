# Guía: flujo de token + iframe para clases (ID oculto)

Esta guía explica cómo funciona el flujo para reproducir videos de clases sin exponer directamente el ID real del archivo en frontend.

## Objetivo

- Evitar mostrar el `fileId` de Google Drive en la UI.
- Validar acceso por estudiante desbloqueado (`classStudents[].unlocked === true`).
- Reproducir video dentro de `iframe` con controles personalizados.

---

## Archivos clave

- Backend controlador: `server/src/controllers/classController.js`
- Backend rutas: `server/src/routes/classRoutes.js`
- Frontend vista clases: `client/src/features/classes/ClassesPage.jsx`

---

## Flujo completo

### 1) Frontend pide clases

Endpoint:

- `GET /api/classes`

Respuesta (ejemplo):

```json
{
  "success": true,
  "data": [
    {
      "classCode": "mat190201",
      "title": "Lógica Proposicional",
      "recordingUrl": "https://drive.google.com/file/d/FILE_ID/view?...",
      "classStudents": [
        {
          "student": {
            "email": "estudiante@correo.com",
            "name": "Julio",
            "lastName": "Pérez"
          },
          "type": "normal",
          "unlocked": true,
          "unlockedAt": "2026-03-01T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

Frontend calcula si está bloqueada:

- bloqueada si el usuario actual NO existe en `classStudents` con `unlocked: true`

---

### 2) Usuario abre una clase desbloqueada

Cuando el estudiante expande una clase desbloqueada, frontend pide token de embed:

- `GET /api/classes/:classCode/embed-token`
- Requiere JWT (`protect` middleware)

Backend valida:

- clase existe
- usuario admin **o** estudiante desbloqueado
- clase tiene `recordingUrl`

Si todo bien, crea token JWT temporal (3h) con:

- `type: "class_embed"`
- `classCode`
- `email`
- `role`

Respuesta (ejemplo):

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJI...",
    "iframeUrl": "/api/classes/embed/eyJhbGciOiJI..."
  }
}
```

---

### 3) Iframe carga HTML seguro del reproductor

El `iframe` apunta a:

- `GET /api/classes/embed/:token`

Backend:

1. verifica JWT
2. valida acceso otra vez
3. genera HTML de reproductor custom
4. el HTML usa stream interno:
   - `/api/classes/embed/:token/stream`

Importante:

- aquí no se envía al cliente el `fileId` de Drive como dato de API.

---

### 4) Stream real del video

El `<video>` del iframe reproduce desde:

- `GET /api/classes/embed/:token/stream`

Backend:

1. valida token y acceso
2. detecta si `recordingUrl` es Drive o local
3. si es Drive, usa Google Drive API (`files.get` con `alt=media`)
4. pasa headers de rango (`Range`) para permitir seek
5. responde stream al navegador

Esto permite:

- reproducción dentro de iframe
- avance/retroceso en timeline
- no depender de redirección a ventana Drive

---

## Controles personalizados

En el HTML generado por backend (`buildSecurePlayerHtml`):

- Botón play/pause
- Timeline de progreso
- Tiempo actual/total
- Volumen (con icono)
- Fullscreen

Además se aplican restricciones:

- `controlsList="nodownload ..."`
- `disablePictureInPicture`
- bloqueo de `contextmenu`
- bloqueo de atajos comunes (`Ctrl+S`, `Ctrl+U`, `F12`, etc.)

> Nota: en web no existe protección 100% infalible contra extracción de media, pero este flujo reduce exposición y evita el acceso directo simple.

---

## Ejemplo de secuencia (resumen)

1. `GET /api/classes`
2. usuario abre clase desbloqueada
3. `GET /api/classes/:classCode/embed-token`
4. frontend monta iframe con `iframeUrl`
5. iframe pide `GET /api/classes/embed/:token`
6. player pide `GET /api/classes/embed/:token/stream`
7. backend transmite video desde Drive/local

---

## Qué se enmascara exactamente

- Se evita exponer `classCode` como llave de acceso al stream final.
- Se evita enviar un endpoint directo público con `fileId` como URL de reproducción en frontend.
- El acceso depende de token temporal y validación de desbloqueo.

---

## Recomendaciones

- Mantener expiración corta del token (`2h` o menos si deseas).
- Regenerar token por sesión de reproducción.
- Registrar intentos fallidos para auditoría.
- Si hay contenido muy sensible, considerar DRM externo (fuera de este stack).
