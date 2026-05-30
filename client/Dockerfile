# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Use `npm install` to support projects without a package-lock.json
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
