# REZ-Media Applications & Services

**Last Updated:** May 12, 2026

---

## WEB APPLICATIONS (Next.js)

| App | Framework | Purpose | Port/URL |
|-----|-----------|---------|-----------|
| **adBazaar** | Next.js 16.2.4 | Consumer ad marketplace | localhost:3000 |
| **creators** | Next.js 14.1.0 | Creator partnership platform | localhost:3000 |
| **dooh-screen-app** | Next.js 14.1.0 | DOOH screen display | localhost:3000 |

---

## MOBILE APPLICATIONS

| App | Framework | Purpose | Status |
|-----|-----------|---------|--------|
| **dooh-mobile** | React Native | DOOH screen owner companion | Moved from REZ-Consumer |
| **Hotel OTA** | React Native | Hotel booking | In REZ-Consumer |
| **Rendez** | React Native | Restaurant reservations | In REZ-Consumer |
| **Food Delivery** | React Native | Food ordering | In REZ-Consumer |

---

## BACKEND SERVICES

### Core Advertising

| Service | Port | Purpose |
|---------|------|---------|
| **ads-service** | 4007 | Ad serving, campaign management |
| **rez-ad-campaigns** | - | Campaign management |
| **rez-ad-ai** | - | AI ad optimization |
| **rez-dooh-service** | - | DOOH bidding engine |

### Gamification & Loyalty

| Service | Port | Purpose |
|---------|------|---------|
| **gamification-service** | 3004 | Points, badges, streaks |
| **engagement-platform** | - | Unified loyalty |

### Marketing & Automation

| Service | Port | Purpose |
|---------|------|---------|
| **marketing** | 4000 | Campaign management |
| **automation** | 4020 | Email/SMS campaigns |
| **lead-intelligence** | - | Lead scoring |
| **abandonment-tracker** | - | Cart recovery |

### Decision & Intelligence

| Service | Port | Purpose |
|---------|------|---------|
| **decision-service** | 4027 | Targeting, A/B testing |
| **economic-engine** | - | Dynamic pricing |
| **discovery-platform** | - | Search, recommendations |

### Communications & Events

| Service | Port | Purpose |
|---------|------|---------|
| **communications-platform** | 3009 | Email, SMS, WhatsApp, Push |
| **media-events** | 3008 | Image processing |
| **feedback-service** | - | NPS, surveys |
| **journey-service** | - | Customer journey |

---

## MESSAGING INTEGRATIONS

### Supported Channels

| Channel | Provider | Connected To |
|---------|----------|-------------|
| Email | SendGrid | REZ-communications-platform |
| SMS | Twilio | REZ-communications-platform |
| WhatsApp | Twilio | REZ-communications-platform |
| Push | Firebase | REZ-communications-platform |
| In-App | - | gamification-service |

### Notification Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MESSAGING FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ads-service ───────────▶ communications-platform ──▶ Email  │
│                          │                       │          │
│  gamification ─────────▶│                       ▼          │
│                          │              ┌───────────────┐   │
│  marketing ────────────▶│              │   Twilio     │   │
│                          │              │  (SMS/WA)   │   │
│  automation ───────────▶│              └──────┬───────┘   │
│                          │                     │            │
│                          └────────────────────▶│            │
│                                                ▼            │
│                                       ┌───────────────┐   │
│                                       │   Firebase   │   │
│                                       │   (Push)     │   │
│                                       └───────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## WHATSAPP MARKETING

### WhatsApp Integration Points

| App/Service | WhatsApp Usage | Status |
|-------------|----------------|--------|
| adBazaar | Campaign updates, receipts | ⚠️ Not wired |
| dooh-mobile | Screen alerts | ⚠️ Not wired |
| marketing | Lead campaigns | ⚠️ Partial |
| automation | Abandonment recovery | ⚠️ Not wired |

### WhatsApp Business Features

- Campaign notifications
- Order updates
- Abandonment recovery
- Lead qualification
- Appointment reminders

---

## DOOH (Digital Out-of-Home)

### DOOH Apps & Services

| Component | Type | Purpose |
|-----------|------|---------|
| **dooh-screen-app** | Web (Next.js) | Screen display for venues |
| **dooh-mobile** | Mobile | Screen owner companion app |
| **dooh** | Backend | Screen management |
| **rez-dooh-service** | Backend | Real-time bidding |

### DOOH Flow

```
Screen Owner               DOOH Network              Advertiser
     │                        │                        │
     ▼                        ▼                        ▼
┌─────────┐            ┌─────────┐            ┌─────────┐
│ dooh-   │            │  dooh   │            │ ads-    │
│ mobile   │──────────▶│ service │◀───────────│service  │
└─────────┘            └────┬────┘            └─────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │ dooh-screen│
                      │ -app       │
                      │ (display)  │
                      └─────────────┘
```

---

## CONNECTION SUMMARY

### REZ-Media → WhatsApp

```
adBazaar ────────▶ WhatsApp Business API ──▶ Customers
creators ───────▶ WhatsApp Business API ──▶ Creators
dooh-mobile ────▶ WhatsApp Business API ──▶ Screen Owners
marketing ─────▶ WhatsApp Business API ──▶ Leads
automation ────▶ WhatsApp Business API ──▶ Churned Users
```

### REZ-Media → Push Notifications

```
gamification ──▶ Firebase ──▶ Mobile Apps ──▶ Users
marketing ────▶ Firebase ──▶ Mobile Apps ──▶ Users
ads-service ──▶ Firebase ──▶ Mobile Apps ──▶ Users
```

---

## DEPLOYMENT STATUS

| App/Service | Deployed | URL |
|-------------|----------|-----|
| adBazaar | ⚠️ Check | vercel.app |
| creators | ⚠️ Check | vercel.app |
| dooh-screen-app | ⚠️ Check | vercel.app |
| ads-service | ⚠️ Check | render.com |
| gamification | ⚠️ Check | render.com |
| communications | ❌ Not deployed | - |

---

## NEEDS WORK

| Item | Priority | Status |
|------|----------|--------|
| WhatsApp Business API setup | HIGH | Not connected |
| Communications platform deployment | HIGH | Not deployed |
| Push notification wiring | HIGH | Partial |
| WhatsApp marketing campaigns | MEDIUM | Partial |
| In-app notifications | MEDIUM | Not complete |

---

*End of Document*
