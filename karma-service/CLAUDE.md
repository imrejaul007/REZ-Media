# CLAUDE.md

---

## Service Discovery

This service is registered in REZ-Master/services.json.

To discover related services:
```bash
# From REZ-Master directory
node rez-cli find <service-name>  # Find specific service
node rez-cli list --category <category>  # List by category
node rez-cli stats  # Platform statistics
```

Quick search:
- `node rez-cli list --search payment` - Find payment services
- `node rez-cli list --search auth` - Find auth services
- `node rez-cli list --search kds` - Find KDS services
- `node rez-cli list --search ai` - Find AI services

---



Karma microservice - backend for social impact tracking and karma gamification.

---

## Project Overview

**Version**: 1.0.0 | **Last Updated**: May 2026

### Tech Stack
- Node.js, Express, TypeScript
- MongoDB with Mongoose
- Redis for caching/sessions
- BullMQ for job queues

---

## Build & Test Commands

```bash
npm install           # Install dependencies
npm run dev          # Development server (port 3009)
npm run build        # Production build
npm start            # Start production server
npm test             # Run tests
```

---

## Project Structure

```
rez-karma-service/
├── src/
│   ├── routes/           # API route handlers
│   │   ├── karma.ts      # Karma points endpoints
│   │   ├── verification.ts # Check-in/check-out
│   │   ├── batch.ts      # Batch conversion
│   │   ├── initiatives.ts # Impact initiatives
│   │   └── impact.ts     # Analytics
│   ├── services/         # Business logic
│   ├── models/           # Mongoose models
│   ├── middleware/        # Auth, validation
│   ├── jobs/             # BullMQ job processors
│   └── utils/            # Helpers
├── docker-compose.yml
└── package.json
```

---

## Database Models

| Model | Purpose |
|-------|---------|
| `KarmaProfile` | User level, trust score, conversion history |
| `EarnRecord` | Per-event karma with verification signals |
| `Batch` | Weekly batch of pending conversions |
| `CSRPool` | Corporate CSR coin pool |
| `KarmaEvent` | Event config (karma/hour, verification mode) |

---

## API Endpoints

### Karma Points
```
GET  /api/karma/user/:userId    # Get user's karma balance
POST /api/karma/earn           # Earn karma points
```

### Verification
```
POST /api/karma/verify/checkin   # QR/GPS check-in
POST /api/karma/verify/checkout  # QR/GPS check-out
```

### Batch (Admin)
```
GET  /api/karma/batch                # List batches
POST /api/karma/batch/:id/preview   # Preview conversion
POST /api/karma/batch/:id/execute   # Execute conversion
POST /api/karma/batch/kill-switch   # Pause all batches
```

### Initiatives
```
GET  /api/initiatives              # List active initiatives
GET  /api/initiatives/:id          # Initiative details
POST /api/initiatives              # Create initiative
POST /api/initiatives/:id/donate   # Donate
```

### Impact Analytics
```
GET /api/impact/user/:userId   # User's impact summary
GET /api/impact/global         # Global metrics
```

### Health
```
GET /health     # Health check
GET /health/live # Liveness probe
GET /healthz    # K8s probe
GET /metrics    # Memory + uptime
```

---

## Level System

| Level | Active Karma | Conversion Rate |
|-------|-------------|-----------------|
| L1 | 0-999 | 25% |
| L2 | 1000-2999 | 50% |
| L3 | 3000-5999 | 75% |
| L4 | 6000+ | 100% |

---

## Batch Conversion Flow

```
Event Complete
      ↓
NGO Approves
      ↓
EarnRecord (APPROVED_PENDING_CONVERSION)
      ↓
Weekly Batch Cron (Sunday 23:59)
      ↓
Admin Preview
      ↓
Admin Execute → ReZ Wallet credited
```

---

## Environment Variables

```env
PORT=3009
MONGODB_URI=mongodb://localhost:27017/rez_karma
REDIS_URL=redis://localhost:6379
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
JWT_SECRET=your-secret
INTERNAL_SERVICE_TOKEN=your-token
BATCH_CRON_SCHEDULE=59 23 * * 0
```

---

## Related Services

| Service | Purpose |
|---------|---------|
| rez-auth-service | Authentication |
| rez-wallet-service | Karma balance |
| rez-merchant-service | NGO approvals |
| rez-intent-graph | Intent capture |

---

## Security Rules

- NEVER commit `.env` files
- Validate all JWTs from Auth Service
- Use parameterized MongoDB queries
- Log all conversion events for audit
- Implement idempotency keys for wallet credits
