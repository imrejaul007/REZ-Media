# AdsQr

> **"Launch an ad anywhere. Track real results. In minutes."**

---

## Status

| Check | Status |
|-------|---------|
| MVP | ✅ Complete |
| Security Audit | ✅ Passed |
| TypeScript | ✅ Compiles |
| Deployment | ✅ Vercel ready |

---

## Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **New Project** → Name: `adsqr-db`
3. Wait 2 minutes for setup

### 2. Run Migrations

1. Open **SQL Editor** in Supabase
2. Copy `supabase/migrations/SETUP.sql`
3. Run
4. Copy `supabase/migrations/002_attribution_tracking.sql`
5. Run

### 3. Configure Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run

```bash
cd adsqr
npm run dev
```

---

## Features

| Feature | Description |
|---------|-------------|
| Campaign Management | Create, edit, pause campaigns |
| QR Generation | Single + bulk codes |
| Attribution | Scan → Visit → Purchase |
| Landing Pages | 3 templates |

---

## Architecture

```
User scans QR
         │
         ▼
┌────────────────────────────────────────────────┐
│              Supabase                         │
│  ┌────────────────────────────────────┐  │
│  │ campaigns, qr_codes, scan_events     │  │
│  └────────────────────────────────────┘  │
└────────────────────────────────────────────┘
         │
         ▼
   REZ Wallet (coins credited)
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns/[id]/qr | Generate QR |
| POST | `/api/scan/[slug]` | Record scan |
| POST | `/api/visit` | Record visit |
| POST | `/api/purchase` | Record purchase |
| GET | `/api/analytics/attribution` | ROI metrics |

---

## Project Structure

```
adsqr/
├── src/app/
│   ├── page.tsx          # Dashboard
│   ├── login/             # Auth
│   ├── campaigns/         # Campaign pages
│   └── api/              # Endpoints
├── supabase/migrations/   # DB schema
└── package.json
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `campaigns` | Campaign data |
| `qr_codes` | QR code records |
| `scan_events` | Attribution records |
| `visit_events` | GPS-verified visits |
| `purchase_events` | Transaction records |
| `coin_transactions` | Coin ledger |
| `attribution_funnel` | Analytics view |

---

## Next Steps

1. ✅ Supabase created
2. ⬜ Migrations run
3. ⬜ Environment configured
4. ⬜ First campaign created

---

## Resources

- [Supabase](https://supabase.com)
- [Vercel](https://vercel.com)
- [Documentation](SETUP.md)
