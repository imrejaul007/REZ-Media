# REZ-discovery-platform/ Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build 2>/dev/null || true
EXPOSE 
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3   CMD wget --no-verbose --tries=1 --spider http://localhost:/health 2>/dev/null || exit 1
CMD ["node", "dist/index.js"]
