FROM node:20-alpine AS base

# Install dependencies stage
FROM base AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Install all dependencies for build
FROM base AS build-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build stage
FROM build-deps AS builder
WORKDIR /app
COPY . .
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package*.json ./

# Copy built files
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Set environment
ENV NODE_ENV=production
ENV PORT=4010

# Expose port
EXPOSE 4010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4010/health/live || exit 1

# Switch to non-root user
USER nodejs

# Start the application
CMD ["node", "dist/index.js"]
