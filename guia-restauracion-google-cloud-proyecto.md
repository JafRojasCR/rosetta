# Guia de restauracion total de Google Cloud para Rosetta (2026)

Esta guia te permite reconstruir desde cero todo lo relacionado al proyecto Google para recuperar acceso y dejar el sistema operativo nuevamente:

- Proyecto de Google Cloud nuevo
- Bucket nuevo en Google Cloud Storage
- Service Account y credenciales nuevas
- Variables de entorno nuevas para backend
- Correo automatico (opciones: OAuth verificado, App Password, SMTP relay o proveedor externo)
- Checklist de validacion final

---

## 0) Resumen rapido de decisiones

Antes de empezar, define estas 2 decisiones:

1. Archivos:
- Usar GCS (recomendado y ya integrado en el backend).

2. Correo:
- Opcion A: OAuth con app verificada.
- Opcion B: App Password de Gmail.
- Opcion C: Google Workspace SMTP Relay.
- Opcion D: proveedor transaccional externo (Resend/SendGrid/Postmark/Brevo).

Orden de fallback implementado en backend:

1. Gmail OAuth2
2. Gmail App Password
3. Resend API

Nota importante sobre tu duda:
- OAuth con app verificada reduce riesgo de bloqueos por autenticacion y evita los refresh tokens de testing que vencen rapido.
- No garantiza que una cuenta nunca sea suspendida. Si hay patrones de spam, volumen anomalo o mala reputacion, Google puede restringir igual.

---

## 1) Preparacion y respaldo (antes de tocar produccion)

1. Exporta respaldo de variables actuales (local y Vercel).
2. Haz inventario de lo que existe en uso:
- Bucket actual
- Service accounts actuales
- Claves JSON activas
- Variables EMAIL_* y GCS_*
3. Congela cambios de despliegue durante la migracion.
4. Define una cuenta "owner" dedicada para Google Cloud (no personal si es posible).

---

## 2) Crear proyecto Google Cloud nuevo

1. Ve a Google Cloud Console.
2. Crea proyecto nuevo (ejemplo: rosetta-prod-2026).
3. Asocia una cuenta de facturacion.
4. Guarda:
- Project ID
- Project Number

Comando opcional (si usas gcloud):

```bash
gcloud projects create rosetta-prod-2026 --name="Rosetta Prod 2026"
gcloud beta billing projects link rosetta-prod-2026 --billing-account=TU_BILLING_ACCOUNT_ID
```

---

## 3) Habilitar APIs necesarias

Minimo para archivos en GCS:

- Cloud Storage JSON API

Opcionales recomendadas:

- IAM Service Account Credentials API
- Gmail API (solo si usaras OAuth de Gmail)

Con gcloud:

```bash
gcloud services enable storage.googleapis.com --project=rosetta-prod-2026
gcloud services enable iamcredentials.googleapis.com --project=rosetta-prod-2026
# Solo si usas Gmail OAuth
gcloud services enable gmail.googleapis.com --project=rosetta-prod-2026
```

---

## 4) Crear bucket nuevo (privado y seguro)

Recomendado:

1. Nombre unico global (ejemplo: rosetta-files-prod-2026-03).
2. Region cercana a usuarios.
3. Uniform bucket-level access = ON.
4. Public access prevention = Enforced.
5. No hacerlo publico.

Con gcloud:

```bash
gcloud storage buckets create gs://rosetta-files-prod-2026-03 \
  --project=rosetta-prod-2026 \
  --location=US-CENTRAL1 \
  --uniform-bucket-level-access
```

Aplicar prevencion de acceso publico:

```bash
gcloud storage buckets update gs://rosetta-files-prod-2026-03 --public-access-prevention
```

---

## 5) Configurar CORS del bucket

Crea archivo cors.json:

```json

cat <<EOF > cors.json
[
  {
    "origin": [
      "https://rosetta.jafrojas.com",
      "http://localhost:5173"
    ],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
EOF

```

Aplicar CORS:

```bash
gsutil cors set cors.json gs://rosetta-files-prod-2026-03
```

Verificar:

```bash
gsutil cors get gs://rosetta-files-prod-2026-03
```

---

## 6) Crear Service Account nueva para backend

1. Crea service account (ejemplo: rosetta-storage-signer).
2. Asigna rol minimo:
- Storage Object Admin
3. Solo si requieres administracion completa del bucket:
- Storage Admin (opcional)

Con gcloud:

```bash
gcloud iam service-accounts create rosetta-storage-signer \
  --project=rosetta-prod-2026 \
  --display-name="Rosetta Storage Signer"

gcloud projects add-iam-policy-binding rosetta-prod-2026 \
  --member="serviceAccount:rosetta-storage-signer@rosetta-prod-2026.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

Generar clave JSON:

```bash
gcloud iam service-accounts keys create rosetta-storage-signer-key.json \
  --iam-account=rosetta-storage-signer@rosetta-490302.iam.gserviceaccount.com \
  --project=rosetta-490302
```

Codificar a base64 (para variable de entorno):

Linux/macOS:

```bash
base64 -w 0 rosetta-storage-signer-key.json
```

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\rosetta-storage-signer-key.json"))
```

---

## 7) Configurar variables de entorno en backend

Este proyecto ya lee variables desde:

- server/.env.example
- server/src/config/env.js

### 7.1 Bloque GCS recomendado

```dotenv
STORAGE_PROVIDER=gcs
GCS_ENABLED=true
GCS_PROJECT_ID=rosetta-prod-2026
GCS_BUCKET_NAME=rosetta-files-prod-2026-03
GCS_CREDENTIALS_BASE64=PEGA_AQUI_BASE64_DEL_JSON
STORAGE_SIGNED_URL_EXPIRY_SECONDS=900
STORAGE_SIGNED_UPLOAD_EXPIRY_SECONDS=900
GCS_DOCUMENTS_PREFIX=documents
GCS_CLASSES_PREFIX=classes
GCS_PAYMENTS_PREFIX=payments
```

### 7.2 Desactivar Google Drive legacy

```dotenv
GOOGLE_DRIVE_ENABLED=false
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_DRIVE_CLASSES_VIDEOS_FOLDER_ID=
GOOGLE_DRIVE_PAYMENTS_FOLDER_ID=
```

---

## 8) Correo automatico: que opcion elegir

El proyecto ahora soporta OAuth2, App Password y fallback a Resend en server/src/services/emailService.js.

## Opcion A: Gmail OAuth con app verificada

Recomendado si quieres seguir con Google y minimizar problemas de autenticacion.

Pasos:

1. En Google Cloud, configura OAuth consent screen.
2. Publica/verifica app si aplica a tu caso y alcance.
3. Crea OAuth Client ID.
4. Obtiene refresh token con scope correcto para SMTP/Nodemailer (https://mail.google.com/).
5. Configura:

```dotenv
EMAIL_ENABLED=true
EMAIL_FROM="Rosetta <tu-correo@dominio.com>"
EMAIL_USER=tu-correo@dominio.com
EMAIL_CLIENT_ID=...
EMAIL_CLIENT_SECRET=...
EMAIL_REFRESH_TOKEN=...
EMAIL_PASS=
```

Ventaja:
- Flujo moderno y estable cuando esta bien configurado.

Riesgo:
- No inmuniza contra bloqueos por reputacion o abuso.

## Opcion B: Gmail App Password

Pasos:

1. Activa 2FA en la cuenta remitente.
2. Genera App Password de 16 caracteres.
3. Configura:

```dotenv
EMAIL_ENABLED=true
EMAIL_FROM="Rosetta <tu-correo@gmail.com>"
EMAIL_USER=tu-correo@gmail.com
EMAIL_PASS=APP_PASSWORD_16_CARACTERES
EMAIL_CLIENT_ID=
EMAIL_CLIENT_SECRET=
EMAIL_REFRESH_TOKEN=
```

Ventaja:
- Muy rapido de implementar.

Limite:
- Menos robusto para operaciones de alto volumen.

## Opcion C: Google Workspace SMTP Relay (recomendado para empresa)

Ventaja:
- Mejor escenario para correos operativos de organizacion.

Requiere:
- Cuenta Google Workspace
- Configuracion en Admin Console
- Politicas de relay/IP/autenticacion correctas

## Opcion D: Proveedor transaccional externo

Ventaja:
- Mejor entregabilidad y observabilidad para apps productivas.

Recomendado si:
- Quieres reducir dependencia de Google para correo.

## Opcion E: Resend como fallback automatico

Si OAuth y App Password fallan, el backend intenta enviar por Resend.

Variables necesarias:

```dotenv
RESEND_API_KEY=tu_api_key_de_resend
RESEND_FROM="Rosetta <onboarding@resend.dev>"
```

Notas:

- En produccion, usa un dominio verificado en Resend para RESEND_FROM.
- Puedes dejar OAuth/App Password activos; Resend se usa solo como tercera via.
- Si quieres usar solo Resend, deja vacias las variables EMAIL_CLIENT_* / EMAIL_REFRESH_TOKEN / EMAIL_PASS.

---

## 9) Variables de entorno sugeridas por escenario

## Escenario 1: GCS + OAuth verificado

```dotenv
# Storage
STORAGE_PROVIDER=gcs
GCS_ENABLED=true
GCS_PROJECT_ID=rosetta-prod-2026
GCS_BUCKET_NAME=rosetta-files-prod-2026-03
GCS_CREDENTIALS_BASE64=...
STORAGE_SIGNED_URL_EXPIRY_SECONDS=900
STORAGE_SIGNED_UPLOAD_EXPIRY_SECONDS=900
GCS_DOCUMENTS_PREFIX=documents
GCS_CLASSES_PREFIX=classes
GCS_PAYMENTS_PREFIX=payments

# Drive legacy OFF
GOOGLE_DRIVE_ENABLED=false

# Email OAuth
EMAIL_ENABLED=true
EMAIL_FROM="Rosetta <tu-correo@dominio.com>"
EMAIL_USER=tu-correo@dominio.com
EMAIL_CLIENT_ID=...
EMAIL_CLIENT_SECRET=...
EMAIL_REFRESH_TOKEN=...
EMAIL_PASS=
```

## Escenario 2: GCS + App Password

```dotenv
# Storage
STORAGE_PROVIDER=gcs
GCS_ENABLED=true
GCS_PROJECT_ID=rosetta-prod-2026
GCS_BUCKET_NAME=rosetta-files-prod-2026-03
GCS_CREDENTIALS_BASE64=...

# Drive legacy OFF
GOOGLE_DRIVE_ENABLED=false

# Email App Password
EMAIL_ENABLED=true
EMAIL_FROM="Rosetta <tu-correo@gmail.com>"
EMAIL_USER=tu-correo@gmail.com
EMAIL_PASS=APP_PASSWORD_16_CARACTERES
EMAIL_CLIENT_ID=
EMAIL_CLIENT_SECRET=
EMAIL_REFRESH_TOKEN=
```

## Escenario 3: GCS + Resend (sin Gmail)

```dotenv
# Storage
STORAGE_PROVIDER=gcs
GCS_ENABLED=true
GCS_PROJECT_ID=rosetta-prod-2026
GCS_BUCKET_NAME=rosetta-files-prod-2026-03
GCS_CREDENTIALS_BASE64=...

# Drive legacy OFF
GOOGLE_DRIVE_ENABLED=false

# Email por Resend
EMAIL_ENABLED=true
EMAIL_FROM="Rosetta"
EMAIL_USER=
EMAIL_PASS=
EMAIL_CLIENT_ID=
EMAIL_CLIENT_SECRET=
EMAIL_REFRESH_TOKEN=
RESEND_API_KEY=...
RESEND_FROM="Rosetta <onboarding@resend.dev>"
```

---

## 10) Cargar secretos en Vercel

1. Abre proyecto en Vercel.
2. Environment Variables:
- Production
- Preview (si aplica)
- Development (si aplica)
3. Copia exactamente los valores del escenario elegido.
4. Redeploy despues de guardar secretos.

Tip:
- No mezcles EMAIL_PASS con OAuth parcialmente configurado si no lo necesitas.
- Si migras a OAuth puro, limpia EMAIL_PASS.
- Si usas Resend, agrega RESEND_API_KEY y RESEND_FROM en los mismos ambientes de Vercel.

---

## 11) Pruebas obligatorias post-restauracion

1. Subir documento grande desde admin.
2. Subir video de clase.
3. Abrir documento (access-url firmado).
4. Abrir recurso de clase (recording/canva access).
5. Crear pago con comprobante y visualizar.
6. Login con 2FA.
7. Forgot password y reset.

Esperado:
- Sin errores CORS en navegador.
- Sin 403 en GCS para objetos recien subidos.
- Sin errores SMTP 535 o invalid_grant.

---

## 12) Plan de corte del proyecto Google viejo

Hazlo solo cuando el nuevo entorno este validado al 100%.

1. Revocar claves viejas de service account.
2. Eliminar secretos viejos en Vercel.
3. Revocar refresh tokens viejos de OAuth (si aplica).
4. Apagar APIs no usadas en el proyecto viejo.
5. Desvincular billing y eliminar proyecto viejo.

---

## 13) Troubleshooting rapido

## Error: invalid_grant (OAuth)

Causas comunes:

- Refresh token emitido con cliente equivocado.
- Scope incorrecto.
- Token revocado por cambio de seguridad.

Accion:
- Regenerar refresh token con el client correcto y scope correcto.

## Error: 535 Invalid login (SMTP)

Causas comunes:

- Password normal en vez de App Password.
- EMAIL_USER no coincide con la cuenta que genero App Password.

Accion:
- Regenerar App Password y validar EMAIL_USER.

## Error: envio falla en Resend

Causas comunes:

- API key invalida/revocada.
- RESEND_FROM no autorizado por dominio en Resend.

Accion:
- Regenerar API key en Resend y verificar dominio/remitente permitido.

## Error CORS al subir a GCS

Causas comunes:

- Dominio frontend no agregado exacto.
- CORS no aplicado al bucket correcto.

Accion:
- Reaplicar cors.json al bucket nuevo y verificar.

## Error 403 al firmar URL

Causas comunes:

- Service account sin permisos de objeto.
- Credenciales base64 corruptas.

Accion:
- Revisar rol IAM y volver a cargar clave JSON/base64.

---

## 14) Checklist final (marca todo antes de cerrar migracion)

- [ ] Proyecto nuevo creado y con billing activo.
- [ ] Cloud Storage API habilitada.
- [ ] Bucket nuevo privado y con CORS correcto.
- [ ] Service account nueva con rol correcto.
- [ ] Credencial JSON/base64 cargada en entorno.
- [ ] Variables GCS configuradas.
- [ ] Drive legacy desactivado.
- [ ] Correo configurado (OAuth verificado o alternativa elegida).
- [ ] RESEND_API_KEY y RESEND_FROM cargados (si usaras fallback Resend).
- [ ] Deploy realizado.
- [ ] Pruebas de archivos, 2FA y recovery pasando.
- [ ] Secretos viejos revocados.

---

## 15) Recomendacion final de arquitectura

Para minimizar riesgos operativos:

1. Mantener archivos en GCS (como ya esta en el backend).
2. Para correo productivo, preferir SMTP Relay de Workspace o proveedor transaccional.
3. Si te quedas con Gmail OAuth, mantener app verificada, dominio autenticado (SPF/DKIM/DMARC) y politicas anti-abuso.

Con esto puedes reconstruir todo el entorno Google sin depender del proyecto anterior y con una ruta clara de recuperacion.
