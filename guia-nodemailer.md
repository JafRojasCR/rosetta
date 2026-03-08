# Guia: Migrar de Gmail OAuth a Nodemailer + App Password

Esta guia te ayuda a dejar de depender de `EMAIL_REFRESH_TOKEN` (que en modo Testing puede vencer cada 7 dias) y pasar a un flujo estable con `Nodemailer + Gmail App Password`.

## Estado actual del proyecto

Tu backend ya usa `nodemailer` en `server/src/services/emailService.js`.

Actualmente la logica hace esto:

1. Si existen variables OAuth (`EMAIL_CLIENT_ID`, `EMAIL_CLIENT_SECRET`, `EMAIL_REFRESH_TOKEN`, `EMAIL_USER`), intenta enviar por OAuth2.
2. Si OAuth2 falla por autenticacion y existe `EMAIL_PASS`, hace fallback a App Password.
3. Si no hay credenciales validas, lanza error de configuracion.

Tambien `server/src/config/env.js` ya soporta `EMAIL_PASS`.

Conclusion: **no necesitas reescribir el servicio de correo**. Solo debes cambiar configuracion.

## Por que te pasa lo de "cada semana"

Si tu app OAuth en Google esta en estado **Testing** (no verificada/publicada), los refresh tokens pueden expirar en ~7 dias.

Con App Password no dependes de ese refresh token.

## Migracion recomendada (App Password)

## Paso 1: Preparar Gmail

1. En la cuenta Gmail que envia correos, activa 2-Step Verification.
2. Crea un App Password en Google Account > Security > App passwords.
3. Copia ese password de 16 caracteres.

## Paso 2: Ajustar variables en `server/.env`

Usa este bloque como referencia:

```dotenv
EMAIL_ENABLED=true
EMAIL_FROM="Rosetta <tu-correo@gmail.com>"
EMAIL_USER=tu-correo@gmail.com
EMAIL_PASS=tu_app_password_de_16_caracteres

# Opcional pero recomendado para migracion limpia:
EMAIL_CLIENT_ID=
EMAIL_CLIENT_SECRET=
EMAIL_REFRESH_TOKEN=
```

Notas:

- `EMAIL_FROM` puede ser `"Rosetta"`, pero es mejor `"Rosetta <tu-correo@gmail.com>"`.
- Para evitar intentos OAuth innecesarios, deja vacias las 3 variables OAuth.

## Paso 3: Reiniciar backend

Despues de cambiar `.env`, reinicia el servidor para que cargue nuevas variables.

Ejemplo:

```powershell
cd server
npm run dev
```

## Paso 4: Probar envio real

Prueba un flujo que ya mande correo en tu app:

1. Forgot password.
2. 2FA login.
3. Notificaciones de clase/pago.

Si `EMAIL_ENABLED=false`, no se enviaran correos reales.

## Checklist rapido

- [ ] `EMAIL_ENABLED=true`
- [ ] `EMAIL_USER` correcto (cuenta Gmail remitente)
- [ ] `EMAIL_PASS` es App Password, no contrasena normal de Gmail
- [ ] `EMAIL_CLIENT_ID`, `EMAIL_CLIENT_SECRET`, `EMAIL_REFRESH_TOKEN` vacios (para salida limpia de OAuth)
- [ ] Backend reiniciado

## Errores comunes

## "Invalid login" o "535"

Causas comunes:

- App Password mal copiado.
- Usaste password normal de Gmail en lugar de App Password.
- `EMAIL_USER` no coincide con la cuenta que genero App Password.

## Sigue intentando OAuth

Si en logs ves intentos OAuth, revisa que estas variables esten realmente vacias en entorno runtime:

- `EMAIL_CLIENT_ID`
- `EMAIL_CLIENT_SECRET`
- `EMAIL_REFRESH_TOKEN`

## Si luego quieres volver a OAuth

Puedes volver cuando tu OAuth app este verificada/publicada por Google. Tu codigo ya soporta ambos metodos.

---

## Resumen

La migracion en tu proyecto es de **bajo esfuerzo**: es principalmente cambio de variables de entorno. Tu implementacion actual ya esta preparada para App Password con `EMAIL_PASS`.
