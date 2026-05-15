# REZ Business AI - Complete Documentation

**Version:** 1.0.0  
**Date:** 2026-05-16  
**Port:** 4059

---

## What Is REZ Business AI

REZ Business AI is an autonomous AI operating system for merchants that:
- Monitors business health continuously
- Predicts demand patterns
- Creates and executes marketing campaigns
- Adjusts pricing dynamically
- Manages customer retention
- Learns from every action

---

## Architecture

```
MERCHANT OPENS APP
    ↓
┌─────────────────────────────────────────────────────────────┐
│                  REZ BUSINESS AI (Port 4059)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Goal  │ │ Playbook│ │  Risk  │ │ Memory │   │
│  │ Engine │ │ Engine  │ │ Engine │ │ Layer  │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐              │
│  │Campaigns│ │ Ads Hub │ │ Attribution│              │
│  │ Bundles │ │         │ │ Engine    │              │
│  └─────────┘ └─────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────┘
    │
    ├─► REZ-Merchant (Products, Orders, Customers)
    ├─► REZ-Intelligence (Demand, Trends, Weather)
    ├─► REZ-Media (Campaigns, Ads, Engagement)
    └─► RABTUL (Notifications, Wallet, Payments)
```

---

## How It Works

### 1. MONITOR
```typescript
// Continuous monitoring
- Weather API → Rain, temperature, humidity
- Events API → Festivals, sports, holidays
- Demand API → Traffic, searches
- Customer API → Segments, churn signals
- Competitor API → Pricing, offers
```

### 2. ANALYZE
```typescript
// AI analyzes patterns
- Pattern matching → Playbooks triggered
- Risk assessment → Margin, fraud checks
- Memory lookup → Past campaign results
- Attribution → Channel ROI
```

### 3. SUGGEST
```typescript
// Merchant sees in app
{
  title: "Weekend Rush Campaign",
  reasoning: "Historical +40% traffic on weekends",
  confidence: 85,
  estimatedImpact: {
    revenue: 8000,
    customers: 40,
    roi: 2.5
  }
}
```

### 4. EXECUTE
```typescript
// One tap launches everything
await approve("suggestion-id");
// Automatically:
// - Creates campaign in REZ-Media
// - Sends notifications via RABTUL
// - Updates pricing in Merchant Service
// - Tracks attribution
// - Records to memory
```

### 5. LEARN
```typescript
// AI remembers outcome
memory.record({
  campaign: "Weekend Rush",
  result: { revenue: 9200, customers: 52 },
  learn: "Weekend campaigns work +15% better than expected"
});
```

---

## Core Engines

### Goal Engine
| Goal | Purpose |
|------|----------|
| Revenue | Track daily/weekly/monthly targets |
| Customers | Acquisition goals |
| Retention | Churn prevention |
| Orders | Volume targets |

### Playbook Engine
| Industry | Playbooks |
|----------|----------|
| Restaurant | Lunch Rush, Dinner Peak, Rainy Day, IPL |
| Salon | Weekday Slots, Wedding Season |
| Hotel | Check-in Welcome, Occupancy Boost |
| Gym | January Rush, Member Retention |

### Risk Engine
| Check | Action |
|-------|--------|
| Margin < 10% | Block |
| Budget > Cashflow | Reject |
| Discount > 40% | Review required |

### Memory Layer
| Remembers | Learns |
|-----------|--------|
| Campaign results | What worked |
| Merchant preferences | Tone, channels |
| Seasonal patterns | Timing |
| Failed actions | What to avoid |

---

## One-Click Campaigns

| Bundle | Impact | Time |
|--------|--------|------|
| Weekend Rush | +₹8,000 | 2 hours |
| Happy Hour | +₹5,000 | 1 hour |
| Win-Back | +₹5,000 | 30 min |
| Festival Boost | +₹25,000 | 1 day |
| Rainy Day | +₹10,000 | 30 min |
| VIP Treatment | +₹12,000 | 1 hour |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/health` | GET | Service health |
| `/config` | GET/PUT | Merchant config |
| `/suggestions` | GET | AI suggestions |
| `/actions/:id/approve` | POST | Approve action |
| `/actions/:id/reject` | POST | Dismiss action |
| `/execute-all` | POST | Run approved actions |
| `/integrations/status` | GET | Check connections |
| `/bundles` | GET | Available campaigns |
| `/bundles/:id/execute` | POST | Launch bundle |

---

## Connected Services

### REZ Ecosystem
```typescript
MERCHANT_SERVICE_URL=http://localhost:3001
MERCHANT_INTELLIGENCE_URL=http://localhost:4041
AD_AI_URL=http://localhost:4021
ENGAGEMENT_URL=http://localhost:4017
```

### RABTUL Services
```typescript
AUTH_SERVICE_URL=https://rez-auth.onrender.com
NOTIFICATION_SERVICE_URL=https://rez-notifications.onrender.com
WALLET_SERVICE_URL=https://rez-wallet.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment.onrender.com
```

---

## Environment Variables

```bash
PORT=4059
NODE_ENV=production

# REZ Services
MERCHANT_SERVICE_URL=https://rez-merchant.onrender.com
MERCHANT_INTELLIGENCE_URL=https://rez-intelligence.onrender.com
AD_AI_URL=https://rez-adai.onrender.com

# RABTUL
AUTH_SERVICE_URL=https://rez-auth.onrender.com
NOTIFICATION_SERVICE_URL=https://rez-notifications.onrender.com
WALLET_SERVICE_URL=https://rez-wallet.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment.onrender.com

# Database
MONGODB_URI=mongodb://localhost:27017/rez-business-ai
REDIS_URL=redis://localhost:6379
```

---

## Deploy

### Render.com
```yaml
# render.yaml
services:
  - type: web
    name: rez-business-ai
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: PORT
        value: '4059'
```

---

## Example Flow

```typescript
// 1. Weather rain detected
eventBus.publish({
  type: 'weather.rain_detected',
  source: 'weather-api',
  payload: { location: 'mumbai', intensity: 'heavy' }
});

// 2. Business AI receives event
eventBus.subscribe('weather.rain_detected', async (event) => {
  const suggestions = playbookEngine.trigger('rainy_day');
  // Creates: Free delivery campaign
  // Target: Delivery customers
  // Offer: Free delivery above ₹200
});

// 3. Merchant sees in app
// "Rainy Day Delivery Campaign
// Est. Impact: +₹10,000
// [Dismiss] [Launch]

// 4. Merchant taps Launch
// AI creates campaign, sends notifications, tracks results
```

---

## Competitive Advantage

| vs | Advantage |
|----|------------|
| Toast/Square POS | Full AI automation + Consumer network |
| Capillary/MoEngage | Direct commerce execution |
| Zomato/Swiggy | Merchant owns data + AI |
| HubSpot | Real-world behavior + offline |
| Shopify | Offline + local + AI |

---

*Version 1.0.0 - May 2026*
