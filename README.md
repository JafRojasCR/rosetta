# Rosetta - Plataforma de Aula Virtual

Rosetta es una plataforma educativa full-stack que permite a los estudiantes acceder a clases, gestionar pagos y descargar documentos.

## 🚀 Stack Tecnológico

- **Frontend**: Vite + React + TailwindCSS + React Router + Axios
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Autenticación**: JWT
- **Subida de archivos**: Multer
- **Validación**: Joi
- **Despliegue**: Vercel

## 📁 Estructura del Proyecto

```
/rosetta
├── /client       # Aplicación React (Vite)
├── /server       # API REST (Express)
└── package.json  # Workspace raíz
```

## ⚙️ Instalación y Configuración

### Prerrequisitos

- Node.js >= 18
- MongoDB (local o MongoDB Atlas)

### 1. Clonar el repositorio

```bash
git clone https://github.com/JafRojasCR/rosetta.git
cd rosetta
```

### 2. Configurar variables de entorno

```bash
# Backend
cp server/.env.example server/.env
# Edita server/.env con tus valores

# Frontend
cp client/.env.example client/.env
# Edita client/.env con tus valores
```

### 3. Instalar dependencias

```bash
npm install
cd client && npm install
cd ../server && npm install
```

### 4. Iniciar en desarrollo

```bash
# Desde la raíz
npm run dev
```

Esto inicia:
- Frontend en `http://localhost:5173`
- Backend en `http://localhost:3000`

## 🔧 Variables de Entorno

### Backend (`server/.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `MONGODB_URI` | URI de conexión MongoDB | `mongodb://localhost:27017/rosetta` |
| `JWT_SECRET` | Secreto para JWT | `tu_secreto_seguro` |
| `JWT_EXPIRES_IN` | Expiración del token | `7d` |
| `NODE_ENV` | Entorno de ejecución | `development` |

### Frontend (`client/.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_URL` | URL base de la API | `http://localhost:3000/api` |

## 📱 Funcionalidades

### Estudiantes
- ✅ Registro e inicio de sesión
- ✅ Dashboard con acceso rápido
- ✅ Ver y filtrar clases por materia
- ✅ Acceder a clases pagadas (grabación y Canva)
- ✅ Subir comprobantes de pago
- ✅ Ver historial de pagos
- ✅ Descargar documentos educativos
- ✅ Editar perfil

### Administradores
- ✅ Gestión de estudiantes (CRUD)
- ✅ Gestión de clases (CRUD)
- ✅ Gestión de documentos (CRUD)
- ✅ Ver todos los pagos

## 🚀 Despliegue en Vercel

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno en el panel de Vercel
3. Este proyecto usa configuración explícita en `vercel.json`:

```json
{
	"buildCommand": "npm run build",
	"devCommand": "npm run dev",
	"outputDirectory": "client/dist",
	"framework": "vite",
	"rewrites": [
		{
			"source": "/api/(.*)",
			"destination": "/api/index.js"
		}
	]
}
```

4. La entrada serverless para el backend es `api/index.js`, que carga `server/src/app`.

### ⚙️ Project Settings en Vercel

Si `vercel.json` está en la raíz, **no necesitas** configurar manualmente Build Command, Dev Command, Framework ni Output Directory en el panel: Vercel tomará esos valores del archivo.

Opcionalmente, puedes dejarlos iguales en UI:

- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Dev Command**: `npm run dev`
- **Output Directory**: `client/dist`
- **Install Command**: dejar por defecto (`npm install`) o definirlo explícitamente como `npm install`
- **Root Directory**: raíz del repositorio (`rosetta`)

### 🔐 Variables de entorno en Vercel

Mínimas recomendadas para producción:

- `MONGODB_URI`
- `JWT_SECRET` (obligatoria en producción)
- `JWT_EXPIRES_IN` (opcional, por ejemplo `7d`)
- `EMAIL_USER` y `EMAIL_PASS` (si usas envío de correos)
- `UPLOAD_DIR` (opcional; por defecto `uploads`)
- `VITE_API_URL` (opcional; para este setup puede omitirse y usar `/api`)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel --prod
```

## 📝 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia frontend y backend en desarrollo |
| `npm run build` | Construye el frontend para producción |
| `npm run start` | Inicia el servidor en producción |

## 🗂️ Modelos de Datos

### Estudiante
- `email` (clave primaria)
- `password` (hash bcrypt)
- `name`, `lastName`, `phone`

### Clase
- `classCode` (clave primaria)
- `title`, `description`, `date`
- `isPublic`, `price`
- `recordingUrl`, `canvaUrl`
- `subject` (objeto embebido)
- `tutoredEmail` (opcional)

### Pago
- `paymentId`, `date`, `billNumber`
- `billUrl` (URL del comprobante)
- `studentEmail`, `classCode`

### Documento
- `docId`, `title`, `description`
- `date`, `fileUrl`
- `subject` (objeto embebido)

## 🤝 Contribución

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Agrega nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

## 📄 Licencia

MIT
