# REZ Media Events Service

**Version:** 1.0
**Date:** May 11, 2026

---

## Overview

Media events processing service for handling image uploads, event streaming, and media analytics.

---

## Features

| Feature | Description |
|---------|-------------|
| Image Processing | Upload and transform images via Cloudinary |
| Event Streaming | Process media-related events |
| Analytics | Track media engagement metrics |
| Asset Management | Manage digital media assets |

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Build
npm run build

# Start worker
npm start
```

---

## Environment Variables

```bash
HEALTH_PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rez-media-events
REDIS_URL=redis://localhost:6379
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## Health Check

| Endpoint | Purpose |
|----------|---------|
| GET /health | Service health status |

---

## Deployment

### Render

```
1. Connect GitHub repo
2. Add environment variables
3. Deploy as worker
```

---

**Built for scale, designed for growth.**
