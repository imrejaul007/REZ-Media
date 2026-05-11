# AdsQr — Deployment Guide

## Quick Start

```bash
cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/adsqr

# Install dependencies
npm install

# Run locally
npm run dev
```

---

## Environment Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note down:
   - Project URL
   - `anon` public key
   - `service_role` secret key (for admin operations)

### 2. Run Database Migrations

```bash
# Using Supabase CLI
supabase db push

# Or manually run in SQL Editor
# Copy contents of supabase/migrations/001_initial_schema.sql
```

### 3. Configure Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production (Vercel):
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_APP_URL
```

---

## Deployment Options

### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd adsqr
vercel

# Set environment variables in Vercel dashboard
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Option 3: Traditional VPS

```bash
# Build
npm run build

# Use PM2 to run
npm install -g pm2
pm2 start npm --name "adsqr" -- start
```

---

## Supabase Database Setup

### Tables Created

| Table | Purpose |
|-------|---------|
| `campaigns` | Brand campaigns with offers and rewards |
| `qr_codes` | Individual QR codes for campaigns |
| `scan_events` | Scan tracking with user/device info |
| `coin_transactions` | Coin credit/debit history |

### Row Level Security

Enable RLS on all tables. Default policies:

```sql
-- Campaigns: users can only see their own
CREATE POLICY "Users see own campaigns" ON campaigns
  FOR SELECT USING (auth.uid() = brand_id);

-- QR Codes: anyone can read
CREATE POLICY "Public read" ON qr_codes
  FOR SELECT USING (true);
```

---

## REZ Wallet Integration

### For Coin Credits

Add to `src/lib/coinService.ts`:

```typescript
export async function creditCoins(userId: string, amount: number, campaignId: string) {
  // Call REZ Wallet API
  const response = await fetch(`${REZ_WALLET_API}/credit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REZ_WALLET_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      amount,
      source: 'adsqr',
      campaignId,
      reason: 'scan'
    })
  })
  return response.json()
}
```

### Environment Variables Needed

```bash
REZ_WALLET_API=https://wallet.rezapp.com/api
REZ_WALLET_SECRET=your-secret-key
```

---

## Cron Jobs

### Required Cron Endpoints

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/stale-bookings` | Every 6 hours | Cancel stale bookings |
| `/api/cron/freshness` | Daily | Check campaign freshness |
| `/api/cron/process-coin-credits` | Every 5 min | Retry failed credits |

### Vercel Cron Setup

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/stale-bookings",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/process-coin-credits",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## Monitoring

### Key Metrics to Track

| Metric | Alert If |
|--------|----------|
| Failed coin credits | > 5% of total |
| Scan count drops | < 50% of average |
| API latency | > 500ms p95 |
| Error rate | > 1% |

### Log Aggregation

Add to your deployment:
- Vercel: Built-in logging
- Custom: Use services like LogRocket, Datadog

---

## Security Checklist

- [ ] Supabase RLS enabled on all tables
- [ ] Environment variables set in production
- [ ] Rate limiting on scan endpoint
- [ ] IP cooldown for anti-gaming
- [ ] Device fingerprint tracking enabled
- [ ] Admin endpoints protected

---

## Troubleshooting

### Build Fails

```bash
# Clear cache
rm -rf .next
npm run build
```

### Database Connection Issues

```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL

# Test connection
npx supabase db start
```

### Coin Credits Not Working

1. Check REZ Wallet API is accessible
2. Verify secret key is set
3. Check cron job is running

---

## Next Steps

1. Test locally
2. Deploy to staging
3. Run migrations on production
4. Configure cron jobs
5. Monitor for 24 hours
6. Deploy to production
