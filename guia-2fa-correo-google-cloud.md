# Guía 2FA y recuperación por correo (Google Cloud + `.env`)

## 1) Qué se implementó

Se habilitó lógica de correo para:

- Código de verificación obligatorio al iniciar sesión (`2FA`) para **estudiantes y administradores**.
- Código de recuperación para restablecer contraseña.

### Endpoints nuevos/actualizados

- `POST /api/auth/login`
  - Valida credenciales.
  - **No entrega JWT todavía**.
  - Genera `verificationToken` + código de 6 dígitos y envía correo.
- `POST /api/auth/resend-2fa`
  - Reenvía código 2FA usando `verificationToken`.
- `POST /api/auth/verify-2fa`
  - Valida código + token.
  - Si es correcto, entrega `JWT` + `user` + `role`.
- `POST /api/auth/forgot-password`
  - Genera y envía código de recuperación.
- `POST /api/auth/verify-reset-code`
  - Verifica código de recuperación y entrega `resetToken`.
- `POST /api/auth/reset-password`
  - Restablece contraseña con `resetToken`.

---

## 2) Configuración en Google Cloud (Gmail API OAuth2)

### 2.1 Crear proyecto

1. Ir a Google Cloud Console.
2. Crear o seleccionar proyecto.

### 2.2 Habilitar API

1. Ir a **APIs & Services > Library**.
2. Buscar y habilitar **Gmail API**.

### 2.3 Pantalla de consentimiento OAuth

1. Ir a **APIs & Services > OAuth consent screen**.
2. Configurar app (External/Internal según tu caso).
3. Agregar usuarios de prueba si está en modo Testing.
4. Guardar.

### 2.4 Crear credenciales OAuth 2.0

1. Ir a **APIs & Services > Credentials**.
2. Crear **OAuth Client ID**.
3. Tipo: `Web application`.
4. Copiar:
   - `Client ID`
   - `Client Secret`

### 2.5 Obtener `refresh_token`

Puedes obtenerlo con OAuth Playground:

1. Abrir `https://developers.google.com/oauthplayground`.
2. Gear icon → marcar **Use your own OAuth credentials**.
3. Pegar `Client ID` y `Client Secret`.
4. Scope recomendado para enviar correo con Nodemailer (SMTP Gmail OAuth2):
  - `https://mail.google.com/`
5. Autorizar con la cuenta remitente.
6. Exchange authorization code → copiar `refresh_token`.

---

## 3) Variables `.env` del servidor

Agregar en `server/.env` (basado en `server/.env.example`):

```dotenv
# Auth/JWT
JWT_SECRET=tu_secreto_seguro
JWT_EXPIRES_IN=7d

# Correo
EMAIL_ENABLED=true
EMAIL_FROM="Rosetta <tu-correo@gmail.com>"
EMAIL_USER=tu-correo@gmail.com

# Opción A: OAuth2 (recomendada)
EMAIL_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
EMAIL_CLIENT_SECRET=xxxxxxxxxxxx
EMAIL_REFRESH_TOKEN=1//xxxxxxxxxxxx

# Opción B (fallback): App Password de Gmail
# EMAIL_PASS=xxxxxxxxxxxxxxxx
```

> Si usas OAuth2, `EMAIL_PASS` no es necesario.
>
> Nota: para este flujo SMTP con Nodemailer **no se usa `projectId` en `.env`**. Lo crítico es que `EMAIL_USER`, `EMAIL_CLIENT_ID`, `EMAIL_CLIENT_SECRET` y `EMAIL_REFRESH_TOKEN` pertenezcan al mismo cliente/cuenta y que el refresh token se haya emitido con scope `https://mail.google.com/`.

---

## 4) Flujo funcional esperado

1. Usuario (admin o estudiante) hace login con correo/contraseña.
2. Backend envía código de 6 dígitos al correo y responde `verificationToken`.
3. Frontend redirige a `/verificacion-2fa`.
4. Usuario ingresa código.
5. Backend valida token + código, y recién ahí emite JWT.

---

## 5) Prueba rápida

1. Iniciar backend.
2. Login con usuario existente.
3. Confirmar recepción del correo.
4. Ingresar el código en la vista 2FA.
5. Verificar acceso a `/dashboard`.

Si no llega correo:

- Revisar `EMAIL_ENABLED=true`.
- Verificar credenciales OAuth2.
- Revisar que Gmail API esté habilitada.
- Revisar logs del backend.
