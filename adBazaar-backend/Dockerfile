FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Environment
ENV NODE_ENV=production
ENV PORT=4085

# Expose port
EXPOSE 4085

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4085/health || exit 1

# Start
CMD ["node", "dist/index.js"]
