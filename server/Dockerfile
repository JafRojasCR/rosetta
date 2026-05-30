FROM node:18-slim

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies
COPY package*.json ./
# Use `npm install` for wider compatibility when package-lock.json is not present
RUN npm install --production --no-audit --no-fund

# Copy application files
COPY . .

# Ensure uploads directory exists
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "src/server.js"]
