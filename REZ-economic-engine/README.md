# ReZ Economic Engine (REE)

**Single Source of Truth for All Business Rules**

---

## Overview

The ReZ Economic Engine is the **economic brain** of the ReZ ecosystem. It provides:

- Unified business rule management
- Karma scoring (300-900 system)
- Fraud detection
- Cashback calculations
- Coin economics

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Start production
npm start
```

---

## API Endpoints

### Admin Routes (Rule Management)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/rules` | List all rules |
| GET | `/api/admin/rules/:id` | Get rule by ID |
| POST | `/api/admin/rules` | Create rule |
| PUT | `/api/admin/rules/:id` | Update rule |
| DELETE | `/api/admin/rules/:id` | Delete rule |
| POST | `/api/admin/rules/:id/activate` | Activate rule |
| POST | `/api/admin/rules/:id/deactivate` | Deactivate rule |
| GET | `/api/admin/rules/:id/history` | Get version history |
| POST | `/api/admin/rules/:id/clone` | Clone rule |
| POST | `/api/admin/rules/bulk` | Bulk create/update |

### Query Routes (For Services)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/query/evaluate` | Evaluate rules |
| POST | `/api/query/cashback` | Calculate cashback |
| POST | `/api/query/karma` | Calculate karma |
| POST | `/api/query/fraud` | Check fraud |
| POST | `/api/query/commission` | Calculate commission |

---

## Karma Scoring (300-900 System)

```
KarmaScore = 300 (Base) + Impact(0-250) + RelativeRank(0-180) + Trust(0-100) + Momentum(0-70)

Total Max = 900
```

### Tiers

| Score | Tier | Color |
|-------|------|-------|
| 300-499 | Starter | Gray |
| 500-649 | Active | Green |
| 650-749 | Performer | Blue |
| 750-819 | Leader | Purple |
| 820-879 | Elite | Orange |
| 880-899 | Legend | Red |
| 900 | Pinnacle | Gold |

---

## Coin Types

| Coin | Expiry |
|------|--------|
| REZ | Never |
| BRANDED | 180 days |
| CASHBACK | 365 days |
| PROMO | 90 days |
| PRIVE | 365 days |
| REFERRAL | 180 days |

---

## Project Structure

```
rez-economic-engine/
├── src/
│ ├── config/           # Configuration
│ ├── types/            # TypeScript types
│ ├── models/           # MongoDB models
│ ├── engines/          # Core engines
│ │ ├── ruleEngine.ts   # Rule evaluation
│ │ ├── karmaEngine.ts  # Karma scoring
│ │ └── fraudEngine.ts  # Fraud detection
│ ├── services/         # Business services
│ ├── routes/           # API routes
│ └── index.ts          # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

---

## Environment Variables

```env
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rez-economic-engine
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret
SERVICE_API_KEY=your-api-key
```

---

## License

Proprietary - ReZ Platform
