# REZ Decision Service

**Version:** 1.0
**Date:** May 11, 2026

---

## Overview

Real-time decision engine (RDE) for the ReZ ecosystem. Handles ad decisions, campaign management, and auction processing.

---

## Features

| Feature | Description |
|---------|-------------|
| Ad Decision Engine | Real-time ad selection and ranking |
| Campaign Management | Create and manage advertising campaigns |
| Auction Engine | Bid-based ad auction system |
| Sampling Engine | A/B testing and campaign sampling |
| Attribution Engine | Track and attribute conversions |
| Dynamic Pricing | Real-time pricing optimization |
| Auto Campaign | Automated campaign optimization |
| Smart Coin Allocation | Intelligent budget allocation |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REZ Decision Service                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    Ad       │  │  Campaign    │  │   Auction    │    │
│  │  Decision   │  │   Engine     │  │    Engine    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Sampling    │  │ Attribution  │  │   Dynamic    │    │
│  │   Engine    │  │   Engine     │  │   Pricing    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Build
npm run build

# Start development
npm run dev

# Start production
npm start
```

---

## Environment Variables

```bash
PORT=4027
NODE_ENV=development
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/rez-decision
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/decide` | POST | Make ad decision |
| `/api/campaigns` | GET/POST | Manage campaigns |
| `/api/auction` | POST | Process auction |
| `/api/analytics` | GET | Get analytics |
| `/health` | GET | Health check |

---

## Engine Flags

| Engine | Environment Variable | Default |
|--------|---------------------|---------|
| Sampling | SAMPLING_ENGINE_ENABLED | true |
| Attribution | ATTRIBUTION_ENGINE_ENABLED | true |
| Dynamic Pricing | DYNAMIC_PRICING_ENABLED | true |
| Auto Campaign | AUTO_CAMPAIGN_ENABLED | true |
| Smart Coin | SMART_COIN_ALLOCATION_ENABLED | true |
| DOOH Analytics | DOOH_ANALYTICS_ENABLED | true |

---

## Deployment

### Render

```
1. Connect GitHub repo
2. Add environment variables
3. Deploy with Docker
```

### Docker

```bash
docker build -t rez-decision-service .
docker run -p 4027:4027 rez-decision-service
```

---

**Built for scale, designed for growth.**
