# ============================================
# REZ Marketing Platform - Production Dockerfile
# Multi-stage build for minimal image size
# ============================================

# ── Stage 1: Dependencies ─────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package*.json ./

# Install production deps only
RUN npm ci --only=production && npm cache clean --force

# ── Stage 2: Development dependencies (for build) ──────────────
FROM node:20-alpine AS dev-deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── Stage 3: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy node_modules from dep stages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=dev-deps /app/node_modules ./node_modules_dev

# Copy source and config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript with optimizations
RUN npx tsc --optimize

# Strip source maps in production
RUN if [ -f "dist/index.js" ]; then sed -i 's/\.js:\(.*\)\.map/\.js/g' dist/index.js 2>/dev/null || true; fi

# ── Stage 4: Production image ─────────────────────────────────
FROM node:20-alpine AS production

# Security: Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs -h /home/nodejs

WORKDIR /app

# Install tini for proper signal handling
RUN apk add --no-cache tini && \
    chmod +x /usr/bin/tini

# Copy only production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Copy environment config script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Security: Switch to non-root user
USER nodejs

# Set Node.js security settings
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=768 --enable-source-maps=false"

# Health check - use exec form to avoid shell wrapping
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/usr/bin/tini", "-t", "--", "node", "-e", "require('http').get('http://localhost:${PORT:-4000}/healthz', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]

# Expose port (Render uses PORT env var, default to 4000 for local)
EXPOSE ${PORT:-4000}

# Use entrypoint for startup validation
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
