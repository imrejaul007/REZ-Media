# REZ Ad AI Service

**Version:** 1.0
**Date:** May 11, 2026

---

## Overview

Intent prediction service for ad targeting. Uses AI to predict user intent and optimize ad delivery.

---

## Features

| Feature | Description |
|---------|-------------|
| Intent Prediction | Predict user intent from behavior signals |
| Ad Targeting | AI-powered ad targeting based on predictions |
| Personalization | 1:1 ad personalization |
| Performance Optimization | Auto-optimize campaigns based on performance |

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
PORT=4021
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rez-ad-ai
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/predict` | POST | Predict user intent |
| `/api/target` | POST | Get ad targeting recommendations |
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
