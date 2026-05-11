# AdsQR Service

**Version:** 1.0
**Date:** May 11, 2026

---

## Overview

QR code advertising service. Generate QR codes for ad campaigns that reward users with coins upon scanning.

---

## Features

| Feature | Description |
|---------|-------------|
| QR Generation | Generate unique QR codes for campaigns |
| Scan Tracking | Track QR code scans and conversions |
| Coin Rewards | Automatically award branded coins on scan |
| Campaign Management | Create and manage QR campaigns |
| Attribution | Track user journey from scan to conversion |

---

## How It Works

```
User Scans QR → Record Scan → Award Coins → Track Attribution
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Production build
npm run build

# Start production
npm start
```

---

## Environment Variables

```bash
PORT=3008
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/adsqr
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/qr/generate` | POST | Generate QR code |
| `/api/qr/scan` | POST | Record QR scan |
| `/api/campaigns` | GET/POST | Manage campaigns |
| `/api/rewards` | GET | Get reward history |
| `/health` | GET | Health check |

---

## Deployment

### Render

```
1. Connect GitHub repo
2. Add environment variables
3. Deploy
```

---

**Built for scale, designed for growth.**
