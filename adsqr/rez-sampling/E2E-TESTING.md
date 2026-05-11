# AdsQr — End-to-End Test Scenarios

## Test Environment Setup

```bash
# 1. Run migrations on test database
# 2. Set environment variables
# 3. Start dev server
npm run dev
```

---

## Core Flow Tests

### 1. Campaign Creation Flow

**Steps:**
1. Register/Login as brand
2. Go to dashboard
3. Click "New Campaign"
4. Fill form:
   - Name: "Summer Sale 2026"
   - Description: "Get 20% off"
   - Scan Reward: 10
   - Visit Reward: 25
   - Purchase Reward: 50
   - Coin Budget: 10000
5. Submit

**Expected:**
- Campaign created in Supabase
- Redirect to campaign detail page
- Stats show 0 scans, 0 coins used

---

### 2. QR Code Generation Flow

**Steps:**
1. Open campaign detail
2. Click "Add QR Code"
3. Enter:
   - Label: "Table 1"
   - Location: "Main Hall"
4. Submit

**Expected:**
- QR code created
- QR slug generated (8 chars)
- Image URL generated
- Listed in campaign QR codes

---

### 3. Bulk QR Generation Flow

**Steps:**
1. Open campaign detail
2. Click "Download QR Codes"
3. Or: Use bulk API

**Expected:**
- HTML/PDF generated
- All QR codes included
- Print-ready format

---

### 4. Scan Flow (Anonymous)

**Steps:**
1. Open scan URL: `/scan/[slug]`
2. (Don't login)

**Expected:**
- Landing page loads
- Offer displayed
- No coin credited (not logged in)
- Scan event recorded

---

### 5. Scan Flow (Logged In)

**Steps:**
1. Login as user
2. Open scan URL with auth header
3. Or: Use mobile app to scan

**Expected:**
- Landing page loads
- User identified
- Coins credited
- Scan event with user_id

---

### 6. Attribution Flow

**Steps:**
1. Scan QR
2. Visit location
3. Call `/api/visit` with GPS coordinates
4. Make purchase
5. Call `/api/purchase`

**Expected:**
- Visit event recorded
- Visit coins credited (if GPS verified)
- Purchase event recorded
- Purchase coins credited
- Attribution funnel shows conversion

---

## API Tests

### Campaign APIs

```bash
# Create campaign
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "scan_reward": 10}'

# Get campaign
curl http://localhost:3000/api/campaigns/[id]

# Update campaign
curl -X PATCH http://localhost:3000/api/campaigns/[id] \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

### QR APIs

```bash
# Generate QR
curl -X POST http://localhost:3000/api/campaigns/[id]/qr \
  -H "Content-Type: application/json" \
  -d '{"label": "Table 1"}'

# Bulk generate
curl -X POST http://localhost:3000/api/campaigns/[id]/qr/bulk \
  -H "Content-Type: application/json" \
  -d '{"locations": [{"label": "T1"}, {"label": "T2"}]}'
```

### Attribution APIs

```bash
# Record visit
curl -X POST http://localhost:3000/api/visit \
  -H "Content-Type: application/json" \
  -d '{"scan_event_id": "...", "lat": 19.07, "lng": 72.87}'

# Record purchase
curl -X POST http://localhost:3000/api/purchase \
  -H "Content-Type: application/json" \
  -d '{"campaign_id": "...", "amount": 500}'

# Get attribution analytics
curl http://localhost:3000/api/analytics/attribution
```

---

## User Acceptance Tests

### Brand User

| Test | Expected Result |
|------|-----------------|
| Login | Redirect to dashboard |
| Create campaign | Campaign visible in list |
| Generate QR | QR in list with image |
| View analytics | Scans, users, coins shown |
| Download QR codes | PDF/HTML opens |

### End User (Scanner)

| Test | Expected Result |
|------|-----------------|
| Scan QR | Landing page loads |
| View offer | Offer details shown |
| Earn coins | Coins added to wallet |
| Visit location | Visit credited |
| Make purchase | Purchase credited |

---

## Performance Tests

| Metric | Target |
|--------|--------|
| Page load | < 2s |
| API response | < 500ms |
| Build time | < 60s |

---

## Security Tests

| Test | Check |
|------|-------|
| Auth | Unauthenticated requests rejected |
| Ownership | Can only see own campaigns |
| Rate limiting | Too many scans blocked |
| Input validation | Invalid data rejected |
