FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript (if needed)
RUN npm run build 2>/dev/null || true

EXPOSE ${PORT:-3000}

CMD ["node", "dist/index.js"]
