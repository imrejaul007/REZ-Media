# Merchant Onboarding Checklist

## Pre-Requisites

- [ ] Supabase project created
- [ ] Migrations run
- [ ] Environment variables set

---

## Setup Steps

### 1. Supabase Setup

- [ ] Create project at supabase.com
- [ ] Run SETUP.sql migration
- [ ] Copy URL + keys to .env.local
- [ ] Test connection

### 2. Vercel Deployment

- [ ] Push to GitHub
- [ ] Connect to Vercel
- [ ] Set environment variables
- [ ] Redeploy
- [ ] Verify build passes

### 3. Domain (Optional)

- [ ] Add custom domain
- [ ] DNS configured
- [ ] SSL working

---

## Campaign Creation Flow

1. **Register/Login** → Auth with email
2. **Create Campaign** → Name + Rewards + Budget
3. **Generate QR** → Single or Bulk
4. **Download QR Codes** → Print & Place
5. **Monitor** → Dashboard → Scans → Analytics

---

## QR Code Placement

- [ ] Print QR codes
- [ ] Place at physical location
- [ ] Test scan
- [ ] Verify coins credited

---

## Attribution Testing

- [ ] Test scan flow
- [ ] Test visit recording
- [ ] Verify coin credits
- [ ] Check analytics dashboard
