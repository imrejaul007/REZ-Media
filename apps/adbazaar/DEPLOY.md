# AdBazaar Deployment Guide

## Vercel Setup

### 1. Create New Vercel Project

```bash
cd apps/adbazaar
vercel
```

### 2. Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `NEXT_PUBLIC_APP_URL` | Production URL (e.g., https://ad-bazaar.vercel.app) | ✅ |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key | ✅ |
| `RAZORPAY_KEY_ID` | Razorpay live/test key | ✅ |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | ✅ |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Public Razorpay key | ✅ |
| `RESEND_API_KEY` | Resend email API key | ✅ |
| `REZ_ADS_SERVICE_URL` | REZ Ads service URL | ✅ |
| `REZ_WALLET_SERVICE_URL` | REZ Wallet service URL | ✅ |
| `REZ_PAYMENT_SERVICE_URL` | REZ Payment service URL | ✅ |
| `ADBAZAAR_WEBHOOK_SECRET` | Webhook verification secret | ✅ |

### 3. GitHub Actions Secrets (for CI/CD)

Add these in GitHub repo Settings > Secrets:

- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID

Add these in GitHub repo Settings > Variables:

- `VERCEL_ADBAZAAR_PROJECT_ID` - Vercel project ID

### 4. Deploy

```bash
# Manual deploy
vercel --prod

# Via GitHub Actions (auto-deploys on push to main)
git push origin main
```

## Owner Service Deployment (Render)

### 1. Create Render Blueprint

Connect Render to GitHub and create from `rez-owner-service/render.yaml`

### 2. Required Environment Variables

| Variable | Description |
|----------|-------------|
| `CORS_ORIGIN` | Vercel app URL |
| `JWT_SECRET` | JWT signing secret |
| `REDIS_URL` | Redis connection URL |

### 3. GitHub Actions Secrets

- `RENDER_DEPLOY_TOKEN` - Render API token
- `RENDER_OWNER_SERVICE_ID` - Render service ID
