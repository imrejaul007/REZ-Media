# REZ Engagement Platform

**Version:** 1.0
**Date:** May 11, 2026

---

## Overview

Customer engagement platform for managing user interactions, loyalty programs, and retention campaigns.

---

## Features

| Feature | Description |
|---------|-------------|
| Engagement Tracking | Track user engagement across channels |
| Loyalty Programs | Manage loyalty points and rewards |
| Retention Campaigns | Automated retention interventions |
| User Segmentation | Segment users by engagement level |
| Rewards Management | Handle rewards and incentives |

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
PORT=4012
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rez-engagement
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/engagement` | GET/POST | Manage engagement data |
| `/api/loyalty` | GET/POST | Manage loyalty programs |
| `/api/rewards` | GET/POST | Handle rewards |
| `/api/segments` | GET/POST | Manage user segments |
| `/health` | GET | Health check |

---

## Deployment

### Render

```
1. Connect GitHub repo
2. Add env vars
3. Deploy
```

---

**Built for scale, designed for growth.**
