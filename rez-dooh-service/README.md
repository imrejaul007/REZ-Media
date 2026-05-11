# REZ DOOH SERVICE - Unified DOOH + AdOS

**Version:** 2.0
**Date:** May 6, 2026
**GitHub:** [imrejaul007/rez-dooh-service](https://github.com/imrejaul007/rez-dooh-service)

---

## WHAT IT DOES

```
Screen Management + AdOS Brain + Area Intelligence
```

### Features

| Feature | Description |
|---------|-------------|
| Screen Management | Register, health, heartbeat |
| AdOS Brain | Decision engine for ads |
| Area Intelligence | Demographics, time, intents |
| 1:1 Personalization | User-specific ads |
| DOOH Analytics | Impressions, QR, attribution |

---

## ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED DOOH SERVICE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SCREENS                                                                  │
│  ├── Register/Remove                                                       │
│  ├── Health monitoring                                                    │
│  └── Heartbeat                                                            │
│                                                                              │
│  ADOS BRAIN                                                               │
│  ├── Ad decision engine                                                    │
│  ├── Campaign scoring                                                     │
│  └── ROI calculation                                                      │
│                                                                              │
│  AREA INTELLIGENCE                                                        │
│  ├── Demographics analysis                                                 │
│  ├── Time context                                                         │
│  └── Intent aggregation                                                   │
│                                                                              │
│  PERSONALIZATION                                                          │
│  ├── 1:1 targeting                                                       │
│  └── User profiles                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SCREEN TYPES

| Type | Targeting | Example |
|------|-----------|---------|
| 1:1 | Personalized | User walks in, see their preference |
| Mass | Area-based | Billboard, transit screens |

---

## APIS

### Screens

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/screens/register` | POST | Register screen |
| `/api/screens` | GET | List screens |
| `/api/screens/:id` | GET | Get screen |
| `/api/screens/:id/health` | GET | Health status |
| `/api/screens/:id/heartbeat` | POST | Send heartbeat |

### Ads

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ads/deliver` | POST | Get ads for screen |
| `/api/ads/decide` | POST | Make ad decision |
| `/api/ads/campaigns` | POST | Create campaign |
| `/api/ads/roi/:id` | POST | Calculate ROI |

### Analytics

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analytics/impressions` | POST | Record impression |
| `/api/analytics/interactions` | POST | Record interaction |
| `/api/analytics/qr/generate` | POST | Generate QR |
| `/api/analytics/qr/scan` | POST | Record scan |

---

## INTEGRATIONS

| Service | Purpose |
|---------|---------|
| ReZ Mind | Intent aggregation, user signals |
| Lead Intelligence | 1:1 targeting |
| Merchant Service | Campaign management |
| AdQR | Attribution |

---

## DEPLOYMENT

### Render

```
1. Connect GitHub repo
2. Add env vars
3. Deploy
```

### Environment Variables

```bash
PORT=4107
MONGODB_URI=mongodb://...
REDIS_URL=redis://...
REZMIND_URL=http://localhost:4010
```

---

## STATUS

| Component | Status |
|-----------|--------|
| Screen Management | ✅ Built |
| AdOS Brain | ✅ Built |
| Area Intelligence | ✅ Built |
| 1:1 Personalization | ✅ Built |
| DOOH Analytics | ✅ Built |
| Deployment Ready | ✅ Ready |

---

**Built for scale, designed for growth.**
