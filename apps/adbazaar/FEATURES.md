# AdBazaar — Feature Documentation

**Last Updated:** 2026-05-01
**Status:** Live at https://ad-bazaar.vercel.app

---

## What is AdBazaar?

> **"AdBazaar is not an ad marketplace. It is a real-world performance marketing platform powered by ReZ."**

AdBazaar is India's first **closed-loop offline advertising marketplace**. It connects brands (buyers) who want to advertise with physical ad spaces (vendors) who have advertising inventory.

**The Loop:** Every booked ad gets a unique QR code. Users scan it, earn REZ loyalty coins, visit the merchant, and make purchases. Vendors see the full scan → visit → purchase funnel.

---

## Strategic Positioning

### The ReZ Ad Ecosystem

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REZ AD ECOSYSTEM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                        AdOS                                 │   │
│   │              (Intelligence Layer)                          │   │
│   │                                                               │   │
│   │   • Smart Campaign Planner    • ROI Prediction               │   │
│   │   • Budget Optimizer        • Audience Intelligence        │   │
│   │   • Attribution Engine       • Recommendations             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│         ┌───────────────────┼───────────────────┐                  │
│         │                   │                   │                    │
│         ▼                   ▼                   ▼                    │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │  AdBazaar  │    │   AdsQr    │    │   ReZ Mind  │        │
│   │             │    │             │    │             │        │
│   │ Marketplace │    │ Quick QR   │    │   Intent    │        │
│   │ + Bookings │    │ Campaigns  │    │  Analysis   │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│          │                   │                   │                  │
│          │                   │                   │                  │
│          └───────────────────┴───────────────────┘                  │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                              │
│                    │      ReZ       │                              │
│                    │  (Ecosystem)   │                              │
│                    │                 │                              │
│                    │ • User Data    │                              │
│                    │ • Wallet       │                              │
│                    │ • Ride Data    │                              │
│                    │ • Food/Hotel   │                              │
│                    └─────────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Platform Comparison

| Platform | Measures | Audience | Advantage |
|----------|----------|---------|----------|
| **Google Ads** | Clicks, Impressions | Online only | Scale |
| **Meta Ads** | Reach, Engagement | Social | Demographics |
| **AdBazaar** | **Scans, Visits, Purchases** | **Real-world** | **Proof of ROI** |

---

## Why AdBazaar is Different

Most platforms measure digital signals. We measure **real-world impact**:

```
OTHER PLATFORMS:
├── "User clicked ad"
├── "User visited website"
└── "User might buy" (inferred)

ADBBAZAAR:
├── "User scanned QR"
├── "User visited store" (GPS verified)
└── "User made purchase" (confirmed)
```

---

## Ecosystem Flywheel

```
AdsQr → Acquires merchants (easy entry, low commitment)
    │
    └── ₹500 to start, 5 minutes to launch
    │
    ▼
AdBazaar → Upsells to inventory campaigns
    │
    └── Book billboards, transit, venues
    │
    ▼
ReZ → Acquires users
    │
    └── Users earn coins, use ecosystem
    │
    ▼
AdOS → Optimizes everything
    │
    └── AI recommendations, budget optimization
    │
    ▼
Back to AdBazaar
    │
    └── More effective campaigns → better results → more brands
```

---

## User Roles

### 1. Vendor (Ad Space Owner)
Owners of physical advertising inventory.

| Feature | Description |
|---------|-------------|
| **Listing Management** | Create, edit, pause, delete ad space listings |
| **Bulk Upload** | CSV upload for multiple listings |
| **Availability Calendar** | Set available dates/slots |
| **Pricing Models** | Fixed price, quote-based, or both |
| **QR Code Generation** | Auto-generated QR per booking |
| **Inquiry Handling** | Receive and respond to buyer inquiries |
| **Quote Sending** | Send custom quotes with validity period |
| **Proof Upload** | Upload execution proof for completed bookings |
| **Earnings Dashboard** | View revenue, pending payouts |
| **Payout Request** | Request withdrawal to bank/UPI |
| **Analytics** | QR scans, attribution, ROI metrics |
| **REZ Connect** | Link REZ merchant ID for loyalty coins |
| **KYC Verification** | Submit documents for verification |
| **2FA Security** | Two-factor authentication |

### 2. Buyer (Brand/Advertiser)
Brands looking to advertise on physical spaces.

| Feature | Description |
|---------|-------------|
| **Browse Listings** | Search and filter ad inventory |
| **Map View** | View listings on interactive map |
| **Instant Booking** | Book fixed-price listings directly |
| **Inquiries** | Send quote requests to vendors |
| **Quote Acceptance** | Accept vendor quotes |
| **Cart** | Multi-booking checkout |
| **Campaigns** | Group bookings for tracking |
| **Payment** | Razorpay checkout |
| **Proof Review** | Review/approve vendor execution proof |
| **Attribution Tracking** | See scans → visits → purchases |
| **Reviews** | Rate completed bookings |
| **QR Scanning** | Scan QR codes to earn coins |

### 3. Admin
Platform moderators.

| Feature | Description |
|---------|-------------|
| **Listing Moderation** | Approve/reject new listings |
| **User Management** | View all users, KYC status |
| **KYC Verification** | Review submitted documents |
| **Booking Management** | View all platform bookings |
| **QR Scan Monitoring** | Real-time scan events |
| **Dispute Resolution** | Handle buyer/vendor disputes |
| **Platform Stats** | GMV, active listings, scans |

---

## Core Features

### Booking Flow

```
BUYER                          VENDOR
   │                              │
   │  Browse listings              │
   │─────── Instant Book ─────────▶│
   │                              │
   │  OR: Send Inquiry            │
   │─────── Inquiry ─────────────▶│
   │                              │  Receive inquiry
   │                              │──── Review details
   │                              │──── Send Quote
   │◀───── Quote Received ────────│
   │                              │
   │  Accept Quote                │
   │─────── Accept ───────────────▶│
   │                              │
   │  Payment (Razorpay)         │
   │  ◀───────────────────────────▶│
   │                              │
   │  QR Code Generated           │
   │                              │
   │                              │──── Execute ad placement
   │                              │──── Upload proof
   │◀───── Review Proof ───────────│
   │                              │
   │  Approve Proof               │
   │─────── Approve ──────────────▶│
   │                              │
   │                              │──── Payout Initiated
```

### Pricing Models

| Model | Description |
|-------|-------------|
| **Fixed** | Buyer pays listed price directly |
| **Quote** | Vendor sends custom quote, buyer accepts |
| **Both** | Vendor offers fixed price but also accepts quote requests |

### Commission Rates

| Category | Rate |
|----------|------|
| Outdoor OOH | 12% |
| Transit Infrastructure | 12% |
| Property Spaces | 12% |
| Local Business | 15% |
| Print Broadcast | 10% |
| Influencer | 20% |
| Digital | 18% |
| Unconventional | 15% |

---

## QR Code System

### How It Works

1. **Booking Created** → QR code auto-generated
2. **QR Displayed** → Physical placement with QR code
3. **User Scans** → Records scan event
4. **Coins Credited** → Authenticated user earns REZ coins
5. **Attribution** → Links scan to visit/purchase

### Coin Rewards

| Reward Type | Default | Configurable |
|------------|---------|--------------|
| Per Scan | 20 coins | Yes (per QR) |
| Visit Bonus | 100 coins | Yes (per QR) |
| Purchase Bonus | 5% | Yes (per QR) |

### Anti-Gaming

- IP-based duplicate prevention (24h cooldown)
- Rate limiting via Redis
- Unique constraint on (QR, IP)
- Authenticated credit via POST endpoint

---

## Attribution Funnel

```
┌─────────┐     ┌────────┐     ┌──────────┐     ┌──────────┐
│  SCAN   │────▶│ VISIT  │────▶│ PURCHASE │────▶│ REVENUE  │
│         │     │        │     │          │     │          │
│ User    │     │ User   │     │ User     │     │ Merchant  │
│ scanned │     │ visited│     │ bought   │     │ revenue   │
│ QR code │     │ store  │     │ something │     │ attributed│
└─────────┘     └────────┘     └──────────┘     └──────────┘
    │
    └── REZ Coins credited to user
```

---

## AdOS Integration (Future)

See [AdOS Documentation](../ados/ADOS-SPEC.md) for the intelligence layer.

### What AdOS Adds

| Capability | Without AdOS | With AdOS |
|------------|--------------|-----------|
| Campaign Planning | Manual selection | AI suggestions |
| Budget Allocation | Arbitrary | ROI-optimized |
| Performance Prediction | None | 85%+ accuracy |
| Attribution | Basic | Multi-touch models |
| Recommendations | None | Real-time suggestions |

---

## Integrations

### Payment Flow

```
Buyer Checkout
      │
      ▼
┌─────────────┐
│  Razorpay   │
│  (UPI/Card) │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────────┐
│ REZ Payment │────▶│ REZ Wallet     │
│ Service     │     │ (MongoDB)      │
└──────┬──────┘     └─────────────────┘
       │
       ▼
┌─────────────┐
│  AdBazaar  │─── Commission deducted
│ (Supabase) │─── Vendor payout
└─────────────┘
```

### External Services

| Service | Purpose |
|---------|---------|
| **Supabase** | Database, Auth, Storage |
| **Razorpay** | Payment gateway |
| **Twilio** | SMS notifications |
| **Resend** | Transactional email |
| **OneSignal** | Push notifications |
| **Google Maps** | Location/maps |
| **Upstash Redis** | Rate limiting |
| **REZ Auth** | SSO for partners |
| **REZ Wallet** | Coin credits, payouts |
| **REZ Marketing** | Broadcast campaigns |

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (React) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Payments | Razorpay |
| Email | Resend |
| SMS | Twilio |
| Push | OneSignal |
| Maps | Google Maps API |
| Hosting | Vercel |
| Rate Limiting | Upstash Redis |

---

## Listing Categories

1. **Outdoor OOH** — Billboards, hoardings, transit
2. **Transit Infrastructure** — Airport, metro, bus stands
3. **Property Spaces** — Building facades, rooftop
4. **Local Business** — Shops, restaurants, cafes
5. **Print Broadcast** — Newspapers, magazines
6. **Influencer**
7. **Digital** — Screens, kiosks
8. **Unconventional** — Creative/unique spaces

---

## API Summary

| Category | Endpoints |
|----------|-----------|
| Auth | 2FA, SSO, Login, Logout |
| Listings | CRUD, Availability, Views |
| Bookings | Create, Pay, Proof, Approve |
| Inquiries | Create, Quote, Accept, Decline |
| QR Codes | Scan, Image Upload |
| Campaigns | CRUD, Link Bookings |
| Attribution | Analytics |
| Vendor | Earnings, Payouts, Analytics |
| Admin | KYC, Moderation, Disputes |
| Webhooks | Razorpay, REZ visit/purchase |
| Cron | Freshness, Budget alerts, DLQ |

---

## Roadmap

### Phase 1: AdsQr Integration
- Quick campaign creation
- Multi-step rewards
- Template landing pages

### Phase 2: AdOS Foundation
- Smart campaign planner
- ROI predictions
- Budget optimization

### Phase 3: Full Intelligence
- Real-time optimization
- Multi-touch attribution
- Predictive bidding
