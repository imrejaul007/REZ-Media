# ============================================
# rez-decision-service Dockerfile
# Phase 3-5 Deployment Configuration
# ============================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# ============================================
# Production stage
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment variables
ENV NODE_ENV=production \
    PORT=4027 \
    # Redis Configuration
    REDIS_URL=redis://redis:6379 \
    # Phase 3-5 Engine Configuration
    SAMPLING_ENGINE_ENABLED=true \
    ATTRIBUTION_ENGINE_ENABLED=true \
    DYNAMIC_PRICING_ENABLED=true \
    AUTO_CAMPAIGN_ENABLED=true \
    SMART_COIN_ALLOCATION_ENABLED=true \
    AUTO_COIN_DISTRIBUTION_ENABLED=true \
    # Analytics Configuration
    MERCHANT_COIN_ANALYTICS_ENABLED=true \
    DOOH_ANALYTICS_ENABLED=true \
    # Performance Tuning
    REDIS_MAX_CONNECTIONS=50 \
    REQUEST_TIMEOUT_MS=30000 \
    # Logging
    LOG_LEVEL=info

# Expose port
EXPOSE 4027

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4027/health || exit 1

# Graceful shutdown handling
SHELL ["/bin/sh", "-c"]
CMD ["node", "--require", "./dist/shutdown.js", "dist/index.js"]
