# REZ ADS - ADVERTISING & SPONSORED COMMERCE PLATFORM

**Version:** 1.0
**Date:** May 6, 2026

---

## WHAT IS REZ ADS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REZ ADS                                             │
│              ADVERTISING & SPONSORED COMMERCE PLATFORM                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  An umbrella platform containing all advertising and sponsored commerce        │
│  services for the ReZ ecosystem.                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## STRUCTURE

```
rez-ads/
├── README.md              ← This file
├── SETUP.md              ← Setup instructions
├── frontend/             ← Frontend applications
│   ├── adBazaar/       ← Marketplace for ad placements
│   ├── adsqr/          ← QR codes - scan → try → get coins
│   └── dooh/           ← Digital Out of Home screens
└── services/            ← Backend services
    ├── rez-uce/         ← Unified Campaign Engine
    ├── rez-ad-campaigns/ ← Campaign management
    ├── rez-ad-ai/      ← AI copilot
    ├── rez-marketing/    ← Multi-channel (WhatsApp/SMS/Push)
    ├── rez-decision-service/ ← RDE Core
    └── rez-unified-messaging/ ← Unified Messaging
```

---

## PRODUCTS

| Product | Type | Purpose |
|---------|------|---------|
| **adBazaar** | Frontend | Marketplace for ad placements |
| **adsqr** | Frontend | QR codes - scan → try → get branded coins |
| **dooh** | Frontend | Digital Out of Home screens |

---

## SERVICES

| Service | Purpose |
|---------|---------|
| **rez-uce** | Campaign management hub |
| **rez-ad-campaigns** | Ad campaign management |
| **rez-ad-ai** | AI optimization |
| **rez-marketing** | Multi-channel (WhatsApp/SMS/Push/Email) |
| **rez-decision-service** | RDE Core (18+ engines) |
| **rez-unified-messaging** | Unified messaging platform |

---

## CORE COMPONENTS

### RDE (Real-time Decision Engine)

```
RULE: NOTHING happens without RDE approval

Components:
├── Supreme Controller
├── Real-Time Triggers (< 100ms)
└── Auction Engine
```

### Sponsored Commerce

```
Ranking = relevance(35%) + bid(25%) + quality(20%) + offer(15%) + affinity(5%)

Slots: Search, Feed, QR, Chat, Location (30% max)
```

### Merchant WhatsApp OS

```
Each merchant gets:
├── Dedicated WhatsApp Business number
├── AI-powered responses
├── Campaign integration
└── Analytics dashboard
```

---

## DATA FLOW

```
MERCHANT creates campaign
        │
        ▼
REZ UCE (campaign hub)
        │
        ▼
RDE DECIDES
        │
        ├── Supreme Controller
        ├── Real-Time Triggers
        └── Auction Engine
        │
        ▼
CHANNELS
        │
        ├── WhatsApp ─── rez-marketing
        ├── QR ───────── adsqr
        ├── DOOH ─────── dooh
        └── Marketplace ── adBazaar
        │
        ▼
CUSTOMER ACTION
        │
        ▼
ATTRIBUTION → REZ MIND LEARNS
```

---

## SETUP

```bash
# Services are linked via symlinks
cd rez-ads

# Frontend
cd frontend && ls -la  # Shows: adBazaar, adsqr, dooh

# Backend
cd services && ls -la  # Shows all services

# Deploy
kubectl apply -f services/*/k8s/
```

---

## STATUS

| Component | Status |
|-----------|--------|
| Structure | ✅ Complete |
| Frontend | ✅ Complete |
| Backend | ✅ Complete |
| RDE Core | ✅ Complete |
| Sponsored Commerce | ✅ Complete |
| Merchant WhatsApp | ✅ Complete |
| Unified Messaging | ✅ Complete |

---

**Built for scale, designed for growth.**
