# DOOH - Digital Out of Home Advertising Network

> **"Turn every screen into a smart advertising channel."**

---

## What is DOOH?

DOOH connects **physical screens** to **AdOS intelligence** for real-time ad delivery.

---

## System Architecture

```
ReZ Mind (Context Signals)
        ↓
AdOS (Decision Engine)
        ↓
DOOH Services
        ↓
┌─────────────────────────────┐
│  Screen Network           │
│  ├── Cab Tablets         │
│  ├── Restaurant TVs     │
│  ├── Mall Kiosks        │
│  ├── Gym Screens        │
│  └── Digital Billboards │
└─────────────────────────────┘
        ↓
User Interaction (QR / Visit)
        ↓
Attribution → AdOS
```

---

## Screen Types Supported

| Type | Location | Audience | Best For |
|------|----------|----------|----------|
| `cab_tablet` | Cabs | Office workers | Fintech, Food |
| `restaurant_tv` | Restaurants | Foodies | Food, Delivery |
| `mall_kiosk` | Malls | Shoppers | Retail, Fashion |
| `gym_screen` | Gyms | Fitness enthusiasts | Health, Supplements |
| `salon_display` | Salons | Premium users | Beauty, Wellness |
| `hotel_lobby` | Hotels | Travelers | Travel, Tourism |
| `airport_display` | Airports | Business travelers | Premium brands |
| `office_lobby` | Offices | Office workers | B2B, Services |
| `bus_shelter` | Street | Commuters | Local businesses |
| `billboard_digital` | Outdoor | General | Brand awareness |

---

## Core Services

### 1. Screen Manager
```typescript
import { createScreenManager } from './services/screen.service'

const manager = createScreenManager()
manager.register(screen)
manager.updateStatus(screenId, 'active')
const screens = manager.query({ type: 'cab_tablet', city: 'Bangalore' })
```

### 2. Delivery Engine
```typescript
import { createDeliveryEngine } from './services/delivery.service'

const delivery = createDeliveryEngine()
const ads = delivery.getAdsForScreen(request, screen, campaigns)
```

### 3. Playlist Generator
```typescript
import { createPlaylistGenerator } from './services/playlist.service'

const generator = createPlaylistGenerator()
const playlist = generator.generatePlaylist(request, screen, campaigns)
```

---

## Ad Decision Flow

```
1. Screen requests ads
        ↓
2. Delivery Engine filters eligible campaigns
        ↓
3. Rank by: audience + time + context
        ↓
4. Select top ads for slots
        ↓
5. Return playlist
```

---

## Audience Targeting

| Segment | Typical Screens | Ad Categories |
|---------|----------------|---------------|
| Office workers | Cabs, Office lobbies | Fintech, Coffee, Delivery |
| Families | Mall, Restaurants | Kids, Shopping, Food |
| Fitness | Gym, Salon | Health, Supplements |
| Travelers | Airport, Hotel | Travel, Tourism |
| Foodies | Restaurants, Mall | Food, Delivery |

---

## Context Signals (from ReZ Mind)

```json
{
  "location_cluster": "IT workers",
  "time_pattern": "morning commute",
  "category_intent": ["food", "coffee"],
  "density": "dense"
}
```

---

## Ad Targeting by Context

| Context | Example | Ads Shown |
|---------|---------|-----------|
| Morning commute | 8-10 AM | Coffee, Breakfast, Transit |
| Lunch | 12-2 PM | Food, Restaurants |
| Evening commute | 5-7 PM | Entertainment, Delivery |
| Weekend | Sat/Sun | Shopping, Family |
| Rainy day | Weather signal | Indoor activities |

---

## Revenue Model

### CPM (Cost Per Mille)
```typescript
const cost = impressions * (cpmRate / 1000)
```

### Slot Pricing
| Slot Type | Time | Multiplier |
|-----------|------|------------|
| Prime | 6-9 AM, 12-2 PM, 6-9 PM | 2x |
| Standard | Other hours | 1x |
| Off-peak | Late night | 0.5x |

### Performance Add-on
- Cost per scan (₹2-5)
- Cost per visit (₹10-20)
- Cost per purchase (₹50-100)

---

## Screen Owner Revenue Share

| Model | Owner | Platform |
|-------|-------|----------|
| CPM | 60% | 40% |
| Performance | 70% | 30% |
| Hybrid | 65% | 35% |

---

## API Endpoints

### Screen Management
```
POST   /api/screens/register
GET    /api/screens
GET    /api/screens/:id
PATCH  /api/screens/:id/status
DELETE /api/screens/:id
```

### Delivery
```
POST   /api/delivery/request
GET    /api/delivery/ads/:screenId
```

### Playlist
```
POST   /api/playlist/generate
GET    /api/playlist/:screenId
```

### Reporting
```
POST   /api/heartbeat
POST   /api/impressions
GET    /api/screens/:id/stats
```

---

## Files

```
dooh/
├── src/
│ ├── index.ts              # Main orchestrator
│ ├── types.ts             # TypeScript interfaces
│ └── services/
│     ├── screen.service.ts     # Screen management
│     ├── delivery.service.ts   # Ad delivery
│     └── playlist.service.ts    # Playlist generation
├── package.json
└── README.md
```

---

## Integration with Ecosystem

```
DOOH
 ├── AdOS → Decision engine
 ├── AdBazaar → Campaign inventory
 ├── AdsQR → Attribution layer
 └── ReZ Mind → Context signals
```

---

## Quick Start

```typescript
import { createDOOHNetwork } from './src'

const dooh = createDOOHNetwork()

// Get ads for a screen
const ads = dooh.getAds(screenId, campaigns)

// Generate playlist
const playlist = dooh.generatePlaylist(screenId, campaigns)

// Get network stats
const stats = dooh.getStats()
```

---

## Next Steps

1. Connect to AdBazaar for campaign inventory
2. Integrate ReZ Mind for context signals
3. Build Screen OS player app
4. Deploy to test screens
5. Add real-time analytics

---

## Positioning

> **"DOOH turns every screen into a measurable advertising channel."**
