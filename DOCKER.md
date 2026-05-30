## Docker / Production run — full guide

This document explains how to build and run the two production containers (frontend served by Nginx, backend by Node), how to provide environment variables, what each Dockerfile line does and why, and how to inspect and debug containers locally (Docker Desktop, CLI).

Prerequisites
- Docker (Desktop or Engine) installed and running
- Docker Compose v1.29+ or Compose v2
- Optional: Azure CLI (for pushing to Azure)

1) Prepare environment variables
- Copy `server/.env.example` to `server/.env` and fill required values:
	- `MONGODB_URI` — your MongoDB connection string (Atlas recommended)
	- `JWT_SECRET` — production secret
	- `GCS_ENABLED`, `GCS_PROJECT_ID`, `GCS_BUCKET_NAME`, `GCS_CREDENTIALS_BASE64` — enable and configure Google Cloud Storage for persistent uploads
	- `EMAIL_*` and other optional settings per your needs

2) Build and run (production)

```bash
# From repo root
docker-compose build --no-cache
docker-compose up -d
```

This will create two images and start two containers bound to:
- Backend: `http://localhost:3000` (API & health endpoint `/api/health`)
- Frontend: `http://localhost/` (Nginx on port 80)

3) What each Dockerfile command does and why

Server (`server/Dockerfile`)
- `FROM node:18-slim` — base image with Node 18 LTS; small and stable for production.
- `WORKDIR /app` — sets working directory inside image.
- `ENV NODE_ENV=production` — runtime environment; many libs (and npm) use this to optimize installs.
- `COPY package*.json ./` — copy package metadata first so we can install dependencies separately (cache optimization).
- `RUN npm ci --only=production` — install exact dependency tree for production; faster and reproducible.
- `COPY . .` — copy app source after deps installed (reduces rebuild time when code changes are unrelated to deps).
- `RUN mkdir -p /app/uploads` — ensure upload directory exists inside container.
- `EXPOSE 3000` — documents the port the app listens on (no port mapping done here).
- `CMD ["node", "src/server.js"]` — default process run by container; starts the Express server.

Frontend (`client/Dockerfile`)
- `FROM node:18-alpine AS builder` — lightweight image to build static assets.
- `WORKDIR /app` — working directory.
- `COPY package*.json ./` and `RUN npm ci` — install dependencies for build.
- `COPY . .` and `RUN npm run build` — produce optimized `dist/` (Vite output).
- `FROM nginx:stable-alpine` — production web server to serve static files.
- `COPY --from=builder /app/dist /usr/share/nginx/html` — copy built static assets into Nginx default folder.
- `EXPOSE 80` and `CMD ["nginx", "-g", "daemon off;"]` — serve content.

4) How to set environment variables for containers
- For the backend we use `server/.env` referenced by `docker-compose.yml` (`env_file: ./server/.env`).
- For production deployments (cloud), prefer using the cloud provider's secret/configuration system (Azure App Settings, Azure Container Instances environment variables, etc.).

5) Inspecting containers and logs
- Docker Desktop: open the Docker Desktop UI, view Images and Containers, click a container to see logs, inspect mounted volumes and resource usage.
- CLI: see logs and running containers

```bash
docker ps
docker-compose logs -f backend
docker-compose logs -f frontend
docker inspect <container_id>
docker exec -it <container_id> /bin/sh   # open shell (alpine/nginx) or /bin/bash for Node image
```

6) Verifying runtime behavior
- Backend health: `curl http://localhost:3000/api/health`
- Static frontend: open `http://localhost/`
- Uploads: if using local uploads (not GCS), check the `/app/uploads` folder inside the backend container:

```bash
docker exec -it $(docker ps -qf "name=rosetta_backend") ls -la /app/uploads
```

7) Common troubleshooting
- If build fails due to network or npm errors, run `docker-compose build` without `--no-cache` to use cache, or inspect build logs.
- If the backend cannot connect to MongoDB, verify `MONGODB_URI` and network access (Atlas allows IP whitelist).
- If uploads are missing, ensure `GCS_ENABLED` is `true` and `GCS_CREDENTIALS_BASE64` is correctly set and decodable by the application.

8) Useful Docker commands reference

```bash
# Build images
docker-compose build
# Start (foreground)
docker-compose up
# Start (detached)
docker-compose up -d
# Stop
docker-compose down
# Remove images
docker-compose down --rmi all --volumes
```

9) Development with live-reload (optional)
- Create `docker-compose.override.yml` that mounts code into containers and runs `npm run dev` for `client` and `nodemon` for `server` so you can iterate locally. This is outside the scope of the production files included here but recommended for dev.

