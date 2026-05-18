# Service Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build 2>/dev/null || true
EXPOSE 4100
CMD ["node", "dist/index.js"]
