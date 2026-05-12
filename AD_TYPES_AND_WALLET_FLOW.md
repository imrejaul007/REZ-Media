# REZ-Media Ad Types & Merchant Wallet Flow

**Date:** May 12, 2026

---

## COMPLETE AD TYPES AUDIT

### 1. IN-APP ADS (Digital)

| Ad Type | Placement | Pricing | Status |
|---------|-----------|---------|--------|
| Home Banner | Homepage hero | CPM/CPC | Built |
| Explore Feed | Browse/Discovery | CPM/CPC | Built |
| Store Listing | Product pages | CPM/CPC | Built |
| Search Results | Search page | CPM/CPC | Built |
| Splash Screen | App launch | CPM | Planned |
| Interstitial | Between screens | CPM | Planned |

### 2. DOOH (Digital Out-of-Home)

| Ad Type | Description | Pricing | Status |
|---------|-------------|---------|--------|
| Mall LED | Shopping mall screens | Daily rate | Built |
| Restaurant TV | Dining area screens | Daily rate | Built |
| Gym Screens | Fitness centers | Daily rate | Built |
| Office Lobby | Corporate buildings | Daily rate | Built |
| Transit Screens | Bus/metro stations | Daily rate | Built |
| Taxi Top | Vehicle top displays | Daily rate | Planned |
| Gas Station | Fuel pump screens | Daily rate | Planned |

### 3. OFFLINE ADS (Static)

| Ad Type | Description | Pricing | Status |
|---------|-------------|---------|--------|
| Standees | Floor stands | Weekly | Built |
| Posters | Wall prints | Weekly | Built |
| Table Tents | Restaurant tables | Weekly | Built |
| Lift Wraps | Elevator interiors | Monthly | Built |
| Wall Branding | Large wall murals | Monthly | Built |
| Kiosk Ads | Info kiosks | Daily | Planned |
| Vehicle Wrap | Car/bus branding | Monthly | Planned |
| Billboards | Large outdoor | Monthly | Built |

### 4. QR ADS (Hybrid)

| Ad Type | Description | Pricing | Status |
|---------|-------------|---------|--------|
| QR Poster | Scannable posters | CPS/CPV | Built |
| QR Table Tent | Restaurant QR | CPS | Built |
| QR Standee | Floor QR displays | CPS | Built |
| QR Window | Storefront QR | CPS | Built |
| QR Receipt | Transaction QR | CPS | Built |
| QR Product | Product label QR | CPS | Planned |

### 5. BROADCAST ADS (Messaging)

| Ad Type | Channel | Pricing | Status |
|---------|---------|---------|--------|
| Push Notification | FCM | Per user | Built |
| WhatsApp Message | Twilio | Per message | Built |
| SMS Campaign | Twilio/MSG91 | Per SMS | Built |
| Email Campaign | SendGrid | Per email | Built |
| In-App Message | Database | Free | Built |

### 6. INFLUENCER ADS

| Ad Type | Description | Pricing | Status |
|---------|-------------|---------|--------|
| Instagram Story | Story mention | Per post | Built |
| Instagram Post | Feed post | Per post | Built |
| Reel | Video content | Per reel | Built |
| YouTube | Video review | Per video | Built |
| TikTok | Short video | Per video | Planned |

### 7. SEARCH ADS

| Ad Type | Description | Pricing | Status |
|---------|-------------|---------|--------|
| Text Search | Search results | CPC | Built |
| Product Search | Product listings | CPC | Built |
| Category Search | Category pages | CPC | Built |

---

## MERCHANT WALLET CAMPAIGN FLOW

### Current System (REZ-Wallet-Service)

```
Merchant Wallet
 │
 ├── Prepaid Balance
 ├── Reserved for Campaigns
 └── Auto-recharge setting
 │
 ▼
Campaign Creates
 │
 ├── Check wallet balance
 ├── Reserve budget
 └── Start campaign
 │
 ▼
Ad Serves
 │
 ├── User sees ad
 ├── Record impression/click
 └── Deduct from reserved
 │
 ▼
Wallet Deduction Types
 │
 ├── CPM: Deduct per 1000 impressions
 ├── CPC: Deduct per click
 ├── CPA: Deduct per conversion
 ├── CPV: Deduct per visit
 └── CPS: Deduct per scan
```

### Wallet Preload Flow

```
Merchant logs in
 │
 ▼
Dashboard shows wallet balance
 │
 ▼
Merchant clicks "Add Funds"
 │
 ▼
Select amount:
 ├── ₹5,000 minimum
 ├── ₹10,000 recommended
 ├── ₹25,000 value pack
 └── Custom amount
 │
 ▼
Payment via:
 ├── UPI
 ├── Card
 └── Net Banking
 │
 ▼
Funds added to wallet
 │
 ▼
Merchant creates campaign
 │
 ▼
Budget reserved from wallet
 │
 ▼
Campaign runs, money deducted
```

---

## CAMPAIGN TYPES & WALLET INTEGRATION

### 1. IN-APP CAMPAIGN

```
Wallet Flow:
Merchant Balance: ₹50,000
Campaign Budget: ₹10,000
 │
 ▼
Reserve ₹10,000
Wallet Available: ₹40,000
Reserved: ₹10,000
 │
 ▼
Campaign runs:
Impressions: 100,000 @ ₹100 CPM = ₹10
Clicks: 500 @ ₹5 CPC = ₹2,500
Conversions: 25 @ ₹100 CPA = ₹2,500
 │
 ▼
Total Spent: ₹5,010
Remaining Budget: ₹4,990
 │
 ▼
Unreserve unused: ₹4,990
Wallet Available: ₹44,990
```

### 2. DOOH CAMPAIGN

```
Wallet Flow:
Merchant Balance: ₹50,000
DOOH Screen: Mall LED
Duration: 7 days
Daily Rate: ₹3,500
 │
 ▼
Reserve: ₹24,500 (7 × ₹3,500)
 │
 ▼
Campaign starts
Daily deduction: ₹3,500/day
 │
 ▼
Day 1: ₹3,500 deducted
Day 2: ₹3,500 deducted
...
Day 7: ₹3,500 deducted
 │
 ▼
Total: ₹24,500
Campaign ends
Unreserve remaining: ₹0
```

### 3. QR CAMPAIGN

```
Wallet Flow:
Merchant Balance: ₹50,000
Campaign: QR Standees at 50 locations
CPS: ₹2 per scan
Budget: ₹5,000
 │
 ▼
Reserve: ₹5,000
 │
 ▼
Week 1:
Scans: 1,200
Deduct: 1,200 × ₹2 = ₹2,400
Remaining budget: ₹2,600
 │
 ▼
Week 2:
Scans: 800
Deduct: 800 × ₹2 = ₹1,600
Remaining budget: ₹1,000
 │
 ▼
Budget exhausted
Campaign pauses
```

### 4. BROADCAST CAMPAIGN

```
Wallet Flow:
Merchant Balance: ₹50,000
Campaign: WhatsApp to 10,000 users
Price: ₹1.50 per message
Budget: ₹15,000
 │
 ▼
Reserve: ₹15,000
 │
 ▼
Send to 10,000 users
Deduct: 10,000 × ₹1.50 = ₹15,000
 │
 ▼
Budget exhausted
```

### 5. INFLUENCER CAMPAIGN

```
Wallet Flow:
Merchant Balance: ₹50,000
Campaign: 5 influencers
Fees:
├── Influencer 1: ₹25,000
├── Influencer 2: ₹15,000
├── Influencer 3: ₹10,000
├── Influencer 4: ₹8,000
└── Influencer 5: ₹5,000
 │
 ▼
Reserve: ₹63,000
Insufficient! Show error.
 │
 ▼
Or:
Merchant adds ₹20,000 to wallet
 │
 ▼
Reserve: ₹70,000
 │
 ▼
Campaign created
Influencers notified
 │
 ▼
Milestone payments:
├── On contract: ₹10,000
├── On deliverable 1: ₹20,000
├── On deliverable 2: ₹25,000
└── On final: Remaining
```

---

## WALLET INTEGRATION POINTS

### Services That Deduct From Wallet

| Service | Method | Status |
|---------|--------|--------|
| REZ-ads-service | billingService.chargeCampaign() | Built |
| REZ-marketing | broadcast deduction | Built |
| adsqr | scan tracking | Built |
| dooh-service | daily rate | Built |
| creators | influencer fees | Built |

### Required API Calls

```typescript
// 1. Check balance before campaign
GET /api/wallet/balance?merchantId=xxx

// 2. Reserve budget for campaign
POST /api/wallet/reserve
{
  "merchantId": "xxx",
  "amount": 10000,
  "campaignId": "yyy",
  "purpose": "ad_campaign"
}

// 3. Deduct from reserved
POST /api/wallet/deduct
{
  "merchantId": "xxx",
  "amount": 100,
  "campaignId": "yyy",
  "reason": "impression_charge"
}

// 4. Release unused reservation
POST /api/wallet/release
{
  "merchantId": "xxx",
  "reservationId": "zzz"
}

// 5. Add funds
POST /api/wallet/deposit
{
  "merchantId": "xxx",
  "amount": 10000,
  "paymentMethod": "upi"
}
```

---

## MINIMUM WALLET BALANCE

### By Campaign Type

| Campaign Type | Minimum Balance | Reason |
|--------------|-----------------|--------|
| In-App Ads | ₹500 | Quick spend |
| DOOH | ₹3,000 | Daily rate × 1 |
| Broadcast | ₹1,000 | 500-1000 messages |
| QR Campaign | ₹500 | 250 scans |
| Influencer | ₹5,000 | First milestone |
| Offline | ₹5,000 | Setup + 1 week |

### Auto-Recharge Options

| Option | Threshold | Amount |
|--------|-----------|--------|
| Auto | ₹2,000 | ₹5,000 |
| Auto | ₹5,000 | ₹10,000 |
| Manual | - | Custom |

---

## CAMPAIGN WORKFLOW

```
1. MERCHANT LOGIN
   │
   ▼
2. CHECK WALLET BALANCE
   │
   ├── Sufficient? → Continue
   └── Insufficient? → Prompt to add funds
   │
   ▼
3. CREATE CAMPAIGN
   │
   ├── Select type (In-App/DOOH/QR/Broadcast/Influencer)
   ├── Set budget
   ├── Select targeting
   └── Set duration
   │
   ▼
4. RESERVE FROM WALLET
   │
   ├── Check balance ≥ budget
   ├── Reserve budget
   └── Update available balance
   │
   ▼
5. CAMPAIGN REVIEW
   │
   ├── Admin review (if needed)
   └── Auto-approve (if configured)
   │
   ▼
6. CAMPAIGN RUNS
   │
   ├── Record impressions/clicks/scans
   ├── Calculate charges via REZ-pricing-engine
   ├── Deduct from reserved
   └── Update campaign metrics
   │
   ▼
7. CAMPAIGN ENDS
   │
   ├── Release unused reservation
   ├── Calculate final charges
   ├── Mark campaign complete
   └── Send report to merchant
```

---

## MISSING: UNIFIED CAMPAIGN CREATOR

Need to build:

```
Campaign Creator
 │
 ├── Step 1: Select Type
 │ ├── In-App Ads
 │ ├── DOOH
 │ ├── Offline
 │ ├── QR
 │ ├── Broadcast
 │ └── Influencer
 │
 ├── Step 2: Set Budget
 │ ├── Quick presets
 │ ├── Custom amount
 │ └── Minimum shown
 │
 ├── Step 3: Select Channels
 │ ├── Auto (AI recommended)
 │ └── Manual selection
 │
 ├── Step 4: Targeting
 │ ├── Location
 │ ├── Demographics
 │ ├── Interests
 │ └── Custom audience
 │
 ├── Step 5: Creative
 │ ├── Upload assets
 │ ├── Templates
 │ └── AI generate
 │
 └── Step 6: Review & Launch
   ├── Cost estimate
   ├── Estimated reach
   └── Wallet balance check
```

---

## SUMMARY

| Ad Type | Count | Wallet Integration |
|---------|-------|-------------------|
| In-App | 4 | Built |
| DOOH | 7 | Built |
| Offline | 8 | Built |
| QR | 6 | Built |
| Broadcast | 5 | Built |
| Influencer | 5 | Built |
| Search | 3 | Built |

**Total: 38 Ad Types**

---

*End of Audit*
