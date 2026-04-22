# Requisitos y cómo ejecutar el sistema

Requisitos previos:
- Node.js >= 18
- MongoDB (local o MongoDB Atlas)
- Variables de entorno configuradas para `server` y `client` (ver `server/.env.example` y `client/.env.example`)

Pasos para levantar el proyecto (tomados de `README.md`):
1. Clonar el repositorio:

```bash
git clone https://github.com/JafRojasCR/rosetta.git
cd rosetta
```

2. Configurar variables de entorno:

```bash
cp server/.env.example server/.env
# editar server/.env con MONGODB_URI, JWT_SECRET, etc.
cp client/.env.example client/.env
# editar client/.env si es necesario
```

3. Instalar dependencias:

```bash
npm install
cd client && npm install
cd ../server && npm install
```

4. Iniciar en desarrollo:

```bash
# Desde la raíz
npm run dev
```

Esto típicamente inicia frontend en `http://localhost:5173` y backend en `http://localhost:3000`.

Uso de Docker o entorno local:
- En el repositorio no se encontró un `Dockerfile` ni `docker-compose.yml` actualmente. Para pruebas en desarrollo se puede usar Docker creando un `Dockerfile` para el backend y un `docker-compose.yml` que levante MongoDB junto al servicio.

Ejemplo simple de `docker-compose.yml` (sugerido):

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:6
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    ports:
      - '27017:27017'

  backend:
    build: ./server
    command: npm run start
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/rosetta
    depends_on:
      - mongodb
    ports:
      - '3000:3000'

volumes:
  mongo_data:
```

Notas adicionales:
- Asegúrese de tener las variables de entorno de Google Drive y correo si desea que esas integraciones funcionen en local.
- Para despliegue en Vercel, siga la sección de despliegue en `README.md` y configure las variables de entorno en el panel de Vercel.
