# ADSQR Deployment Checklist

## Pre-Deployment

- [ ] Create Supabase project
- [ ] Run database migrations
- [ ] Get API keys

## Environment Variables

Set these in Vercel:

| Variable | Value |
|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ukdhstoqhcplbvqikhro.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL |

## Supabase Setup

1. Go to https://supabase.com
2. Open SQL Editor
3. Run these migrations:

### 001_initial_schema.sql
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  offer JSONB DEFAULT '{}',
  scan_reward INTEGER DEFAULT 10,
  visit_reward INTEGER DEFAULT 25,
  purchase_reward INTEGER DEFAULT 50,
  coin_budget INTEGER DEFAULT 1000,
  coins_used INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  qr_enabled BOOLEAN DEFAULT true,
  brand_color TEXT DEFAULT '#6366F1',
  brand_name TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  qr_slug TEXT UNIQUE NOT NULL,
  qr_image_url TEXT,
  qr_label TEXT,
  location_name TEXT,
  location_address TEXT,
  scan_count INTEGER DEFAULT 0,
  unique_scans INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id UUID REFERENCES qr_codes(id),
  campaign_id UUID REFERENCES campaigns(id),
  user_id TEXT,
  device_id TEXT,
  ip_address TEXT,
  location JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE visit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_event_id UUID REFERENCES scan_events(id),
  qr_id UUID REFERENCES qr_codes(id),
  campaign_id UUID REFERENCES campaigns(id),
  user_id TEXT,
  location JSONB,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_event_id UUID REFERENCES scan_events(id),
  campaign_id UUID REFERENCES campaigns(id),
  user_id TEXT,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'INR',
  attributed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Deploy

```bash
cd adsqr
vercel --prod
```

## Post-Deployment

- [ ] Verify build passes
- [ ] Test login
- [ ] Create test campaign
- [ ] Generate QR code
- [ ] Test scan flow
