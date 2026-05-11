# AdsQr Supabase Setup

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **New Project**
3. Name: `adsqr-db`
4. Database Password: Copy this
5. Region: Select nearest
6. Click **Create new project**
7. Wait 2 minutes for setup

## Step 2: Get Credentials

1. Go to **Settings → API**
2. Copy:
   - Project URL
   - `anon/public` key (for frontend)
   - `service_role` key (for backend)

## Step 3: Run Migrations

1. Go to **SQL Editor**
2. Copy content from `supabase/migrations/SETUP.sql`
3. Paste and run

## Step 4: Update .env.local

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 5: Test Connection

```bash
npm run dev
```

## Tables Created

- `campaigns`
- `qr_codes`
- `scan_events`
- `visit_events`
- `purchase_events`
- `coin_transactions`
- `attribution_funnel` (view)
