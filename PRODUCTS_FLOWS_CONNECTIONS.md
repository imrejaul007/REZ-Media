# REZ-Media: Complete Products, Flows & Company Connections

**Last Updated:** May 12, 2026

---

## TABLE OF CONTENTS

1. [Products & Applications](#1-products--applications)
2. [Backend Services](#2-backend-services)
3. [Data Flows](#3-data-flows)
4. [Company Connections](#4-company-connections)
5. [Architecture Diagrams](#5-architecture-diagrams)

---

## 1. PRODUCTS & APPLICATIONS

### Consumer-Facing Products

| Product | Type | Platform | Purpose |
|---------|------|---------|---------|
| **adBazaar** | Web App | Next.js | Ad marketplace for consumers to browse and buy ad placements |
| **rez.money** | Web App | React | Main commerce platform (connects to REZ-Full-App) |
| **Hotel OTA App** | Mobile App | React Native | Hotel booking integration |
| **Rendez App** | Mobile App | React Native | Restaurant reservations |
| **Food Delivery App** | Mobile App | React Native | Food ordering |
| **dooh-screen-app** | Web App | Next.js | DOOH screen management and content display |
| **dooh-mobile** | Mobile App | React Native | DOOH mobile companion for screen owners |

### Admin/Merchant Products

| Product | Type | Purpose |
|---------|------|---------|
| **Merchant Portal** | Web | Self-serve ad campaign management |
| **Admin Dashboard** | Web | System administration, ad review |
| **Analytics Dashboard** | Web | Performance monitoring and reports |

---

## 2. BACKEND SERVICES

### Core Services (REZ-Media)

| Service | Port | Purpose | Key Features |
|---------|------|---------|-------------|
| **REZ-ads-service** | 4007 | Ad serving & campaign management | Campaign CRUD, fraud detection, rate limiting, click tracking |
| **REZ-decision-service** | 4027 | ML-powered targeting & decisions | User segments, A/B testing, frequency caps, attribution |
| **REZ-gamification-service** | 3004 | Points, badges, streaks | Achievements, leaderboards, karma, wallet credits |
| **REZ-automation-service** | 4020 | Email/SMS campaigns | Drip sequences, click tracking, unsubscribes |
| **REZ-media-events** | 3008 | Event processing & image handling | Image variants, CDN invalidation, event forwarding |
| **REZ-marketing** | 4000 | Audience & campaign management | Segments, cross-channel campaigns, A/B testing |
| **REZ-lead-intelligence** | - | Lead scoring | ML-based qualification, enrichment |

### Platform Services (REZ-Media)

| Service | Purpose | Key Features |
|---------|---------|-------------|
| **adBazaar** | Consumer marketplace | Campaign browsing, real-time pricing, analytics |
| **adsqr** | QR advertising | QR generation, offline tracking |
| **dooh** | Digital Out-of-Home backend | Screen inventory, scheduling, dynamic content |
| **dooh-screen-app** | DOOH screen display | Next.js app for digital screens |
| **dooh-mobile** | DOOH screen owner app | Mobile app for screen management |
| **rez-dooh-service** | DOOH bidding engine | Real-time auction and bidding |
| **creators** | Creator partnerships | Profile management, campaign matching |
| **REZ-engagement-platform** | Unified loyalty | Offers, referrals, tier management |
| **REZ-discovery-platform** | Discovery | Search, recommendations, trending |
| **REZ-communications-platform** | Notifications | Push, in-app, webhooks |
| **REZ-feedback-service** | Feedback | NPS, sentiment analysis |
| **REZ-economic-engine** | Pricing | Dynamic pricing, promotions |
| **REZ-abandonment-tracker** | Recovery | Cart detection, recovery campaigns |

---

## 3. DATA FLOWS

### Flow 1: Ad Campaign Creation

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌────────────────┐
│   Merchant  │────▶│  Merchant Portal │────▶│ REZ-ads-service │────▶│    MongoDB     │
│   creates   │     │    (adBazaar)    │     │   (validate)    │     │ (adcampaigns)  │
│   campaign  │     └──────────────────┘     └────────┬────────┘     └────────────────┘
└─────────────┘                                      │
                                                     │ Admin review
                                                     ▼
                                            ┌─────────────────┐
                                            │   Admin Panel   │
                                            │  (approve/reject)│
                                            └─────────────────┘
```

### Flow 2: Ad Serving to Consumer

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌────────────────┐
│  Consumer   │────▶│    rez.money     │────▶│REZ-decision-    │────▶│  User segments │
│  opens app  │     │  (main app)      │     │   service       │     │  (from Redis) │
└─────────────┘     └────────┬─────────┘     └────────┬────────┘     └────────────────┘
                             │                              │
                             │                              │ Get campaigns
                             ▼                              ▼
                    ┌──────────────────┐     ┌─────────────────┐
                    │ REZ-intent-graph  │◀────│ REZ-ads-service │
                    │  (user history)  │     │  (active ads)   │
                    └──────────────────┘     └────────┬────────┘
                                                       │
                               ┌───────────────────────┼───────────────────────┐
                               │                       │                       │
                               ▼                       ▼                       ▼
                      ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
                      │  Impression   │         │   Display    │         │   Track      │
                      │   recorded   │         │    ad        │         │   intent     │
                      └──────────────┘         └──────────────┘         └──────────────┘
```

### Flow 3: Click → Conversion Attribution

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌────────────────┐
│  Consumer   │────▶│  REZ-ads-service │────▶│REZ-decision-    │────▶│  Attribution   │
│  clicks ad  │     │  (record click)  │     │   service       │     │   tracked     │
└─────────────┘     └────────┬────────┘     └────────┬────────┘     └────────────────┘
                              │                              │
                              │ Fraud check                  │ 24hr window
                              ▼                              ▼
                     ┌─────────────────┐         ┌─────────────────┐
                     │ clickFraudService│         │ REZ-intent-graph │
                     │ (Redis tracking)│         │ (store journey) │
                     └─────────────────┘         └────────┬────────┘
                                                          │
                    ┌─────────────────────────────────────┼─────────────────────┐
                    │                                     │                     │
                    ▼                                     ▼                     ▼
           ┌──────────────┐                    ┌──────────────┐     ┌──────────────┐
           │  User makes  │                    │    Order      │     │   Revenue    │
           │   purchase   │──────▶│  REZ-order-service │──────▶│  attributed   │
           └──────────────┘        └────────┬──────────┘     └──────────────┘
                                            │
                                            │ Conversion event
                                            ▼
                                   ┌─────────────────┐
                                   │REZ-ads-service  │
                                   │(attribution calc)│
                                   └─────────────────┘
```

### Flow 4: Gamification & Loyalty

```
┌─────────────┐     ┌─────────────────────┐     ┌────────────────────┐
│   Consumer  │────▶│   Store/Restaurant  │────▶│ REZ-gamification   │
│   visits    │     │   (scan QR/visit)    │     │    service         │
└─────────────┘     └─────────────────────┘     └─────────┬──────────┘
                                                            │
                        ┌────────────────────────────────────┼────────────────────┐
                        │                                    │                    │
                        ▼                                    ▼                    ▼
               ┌───────────────┐                  ┌───────────────┐     ┌───────────────┐
               │  Points/Coins │                  │  Achievement  │     │    Streak     │
               │   awarded     │                  │   unlocked   │     │   updated    │
               └───────┬───────┘                  └───────┬───────┘     └───────┬───────┘
                       │                                  │                    │
                       ▼                                  ▼                    ▼
              ┌───────────────┐                  ┌───────────────┐     ┌───────────────┐
              │REZ-wallet-   │                  │  Badge earned │     │  Loyalty       │
              │   service    │                  │  (displayed)  │     │  tier update   │
              └───────────────┘                  └───────────────┘     └───────────────┘
```

### Flow 5: Marketing Automation

```
┌─────────────┐     ┌─────────────────────┐     ┌────────────────────┐
│   User      │────▶│   REZ-automation-   │────▶│   Email/SMS       │
│   action    │     │      service         │     │   sent            │
└─────────────┘     └─────────┬───────────┘     └────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Trigger:       │   │  Trigger:       │   │  Trigger:       │
│  Welcome series │   │  Abandoned cart │   │  Re-engagement  │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Email:        │   │  Email:        │   │  Email:        │
│  "Welcome!"    │   │  "You left..." │   │  "We miss you!" │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 4. COMPANY CONNECTIONS

### REZ-Media Ecosystem Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              REZ-MEDIA                                          │
│                                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  adBazaar   │  │   adsqr     │  │    dooh     │  │  creators    │       │
│  │   (Web)     │  │   (QR)      │  │   (DOOH)    │  │  (Creator)   │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                  │                  │                  │               │
│  ┌──────┴──────────────────┴──────────────────┴──────────────────┴──────┐     │
│  │                         BACKEND SERVICES                                 │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │     │
│  │  │ REZ-ads-     │  │ REZ-gamifi- │  │ REZ-marketi-│              │     │
│  │  │  service     │  │  cation     │  │  ng         │              │     │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │     │
│  └─────────┼──────────────────┼──────────────────┼──────────────────────┘     │
│            │                  │                  │                              │
│            └──────────────────┴────────┬─────────┴──────────────────────────┘     │
│                                       │                                        │
└───────────────────────────────────────┼──────────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  REZ-          │         │    RABTUL      │         │  REZ-          │
│  Intelligence  │         │  Technologies   │         │  Consumer       │
│  (ML & AI)     │         │  (Core Infra)  │         │  (Mobile Apps)  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

---

### Connection 1: REZ-Media → REZ-Intelligence

| REZ-Media Service | Connects To | Purpose | Protocol |
|-------------------|-------------|---------|----------|
| REZ-ads-service | REZ-intent-graph | User intent tracking | HTTP REST |
| REZ-ads-service | REZ-event-platform | Analytics events | HTTP REST |
| REZ-decision-service | REZ-intelligence-hub | ML targeting models | HTTP REST |
| REZ-decision-service | REZ-intent-graph | User segment evaluation | HTTP REST |
| REZ-gamification | REZ-intent-graph | Gamification events | HTTP REST |
| REZ-gamification | REZ-event-platform | Achievement unlocks | HTTP REST |
| REZ-marketing | REZ-intent-graph | Audience enrichment | HTTP REST |

**Authentication:** `x-internal-token` header with shared secret

---

### Connection 2: REZ-Media → RABTUL Technologies

| REZ-Media Service | Connects To | Purpose | Protocol |
|-------------------|-------------|---------|----------|
| REZ-ads-service | rez-order-service | Revenue attribution | HTTP REST |
| REZ-ads-service | rez-payment-service | Ad purchase payments | HTTP REST |
| REZ-gamification | rez-wallet-service | Coin credits | HTTP REST |
| REZ-gamification | rez-notifications-service | Push notifications | BullMQ |
| REZ-marketing | rez-notifications-service | Campaign notifications | BullMQ |
| REZ-automation | rez-notifications-service | Email/SMS | BullMQ |
| ALL | rez-auth-service | User authentication | JWT |
| ALL | REZ-observability-platform | Monitoring/Logging | HTTP |
| ALL | REZ-secrets-manager | Secret management | HTTP |
| ALL | REZ-circuit-breaker | Resilience | Library |

**RABTUL Services Available:**

| Service | Purpose | Status |
|---------|---------|--------|
| `rez-auth-service` | User authentication & sessions | Available |
| `rez-order-service` | Order management | Available |
| `rez-payment-service` | Payment processing | Available |
| `rez-wallet-service` | Digital wallet/coins | Available |
| `rez-notifications-service` | Push/Email/SMS | Available |
| `rez-catalog-service` | Product catalog | Available |
| `rez-profile-service` | User profiles | Available |
| `rez-booking-service` | Reservations | Available |
| `rez-delivery-service` | Delivery tracking | Available |
| `rez-analytics-service` | Analytics pipeline | Available |
| `rez-audit-service` | Audit logging | Available |
| `rez-search-service` | Search functionality | Available |
| `REZ-observability-platform` | Monitoring & logging | Available |
| `REZ-notifications-hub` | Notification routing | Available |
| `REZ-secrets-manager` | Secret storage | Available |
| `REZ-circuit-breaker` | Fault tolerance | Available |
| `REZ-idempotency-service` | Duplicate prevention | Available |
| `REZ-retry-service` | Retry logic | Available |
| `REZ-dlq-service` | Dead letter queue | Available |
| `REZ-policy-engine` | Policy evaluation | Available |

---

### Connection 3: REZ-Media → REZ-Consumer (Mobile Apps)

| REZ-Media Service | REZ-Consumer App | Purpose |
|-------------------|------------------|---------|
| REZ-ads-service | Hotel OTA | Display ads in hotel booking |
| REZ-ads-service | AdBazaar | Browse ad marketplace |
| REZ-ads-service | Rendez | Show ads in restaurant |
| REZ-gamification | All apps | Points & achievements |
| REZ-marketing | All apps | Push notifications |
| REZ-automation | All apps | Email campaigns |

**REZ-Consumer Apps:**

| App | Features Connected |
|-----|------------------|
| **Hotel OTA** | Ad display, booking rewards, loyalty |
| **AdBazaar** | Ad marketplace, campaign management |
| **Rendez** | Restaurant ads, reservation rewards |
| **Food Delivery** | Restaurant ads, delivery tracking |

---

## 5. ARCHITECTURE DIAGRAMS

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Web App  │  │  Mobile   │  │  Merchant │  │   Admin    │  │  Partner   │ │
│  │  Browser  │  │   Apps    │  │   Portal  │  │   Panel    │  │   APIs     │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘ │
└────────┼───────────────┼───────────────┼───────────────┼───────────────┼────────┘
         │               │               │               │               │
         └───────────────┴───────┬───────┴───────────────┴───────────────┘
                                 │
┌────────────────────────────────┼─────────────────────────────────────────────────┐
│                           API GATEWAY                                         │
│                         (rez-api-gateway)                                       │
│                   ┌────────────────────────────────────┐                        │
│                   │ • Authentication                    │                        │
│                   │ • Rate Limiting                    │                        │
│                   │ • Request Routing                 │                        │
│                   │ • Load Balancing                   │                        │
│                   └────────────────────────────────────┘                        │
└────────────────────────────────┬────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   REZ-Media    │   │    RABTUL      │   │  REZ-Intelli-  │
│   Services     │   │   Technologies  │   │     gence       │
│                 │   │                 │   │                 │
│ • ads-service  │   │ • auth-service  │   │ • intent-graph  │
│ • gamification │   │ • order-service │   │ • event-platform│
│ • marketing    │   │ • payment-svc  │   │ • insights-svc  │
│ • automation   │   │ • wallet-svc   │   │ • ml-models    │
│ • decision     │   │ • catalog-svc  │   │                 │
│ • media-events │   │ • notifications│   │                 │
└────────┬────────┘   └───────┬───────┘   └────────┬────────┘
         │                     │                     │
         │            ┌────────┴────────┐          │
         │            │                 │          │
         ▼            ▼                 ▼          ▼
┌─────────────────┐ ┌───────┐ ┌───────────┐ ┌───────────┐
│     Redis       │ │MongoDB│ │ PostgreSQL │ │  External │
│   (Cache/Queues)│ │       │ │ (Supabase)│ │   APIs    │
└─────────────────┘ └───────┘ └───────────┘ └───────────┘
```

### Queue Architecture (BullMQ)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BullMQ Queues                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │notification-    │    │gamification-    │    │   media-        │           │
│  │    events       │    │    events       │    │   events        │           │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘           │
│           │                      │                      │                      │
│           ▼                      ▼                      ▼                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │ Notification    │    │  Gamification   │    │   Media        │           │
│  │    Worker       │    │    Worker       │    │   Worker       │           │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘           │
│           │                      │                      │                      │
│           ▼                      ▼                      ▼                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │ Push/Email/SMS  │    │ Achievement     │    │ Image Process   │           │
│  │    Services     │    │ Processing      │    │ & CDN Update   │           │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘           │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │action:approval  │    │re-engagement   │    │   intent-      │           │
│  │    :queue      │    │                │    │   events       │           │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘           │
│           │                      │                      │                      │
│           ▼                      ▼                      ▼                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │   Admin         │    │   Engagement    │    │  Intent        │           │
│  │   Approval      │    │   Campaigns    │    │  Processing    │           │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASES                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐         │
│  │                         MongoDB                                   │         │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │         │
│  │  │  REZ-Media   │  │   RABTUL     │  │    REZ-      │        │         │
│  │  │  adcampaigns  │  │   orders     │  │  Intelligence │        │         │
│  │  │  interactions │  │   payments   │  │   user_events │        │         │
│  │  │  achievements │  │   profiles   │  │   ml_features │        │         │
│  │  │  streaks     │  │   catalog    │  │              │        │         │
│  │  │  campaigns   │  │   wallets    │  │              │        │         │
│  │  │  automations│  │              │  │              │        │         │
│  │  └───────────────┘  └───────────────┘  └───────────────┘        │         │
│  └─────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐         │
│  │                     Redis (All Services)                          │         │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │         │
│  │  │   Caching    │  │  BullMQ      │  │   Session    │          │         │
│  │  │  user:ltv:*  │  │   Queues     │  │   Store      │          │         │
│  │  │  freq:{user} │  │  Connections │  │              │          │         │
│  │  │  sampling:*  │  │              │  │              │          │         │
│  │  └───────────────┘  └───────────────┘  └───────────────┘          │         │
│  └─────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐         │
│  │                   PostgreSQL (Supabase)                           │         │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │         │
│  │  │    adBazaar   │  │   Creator    │  │   DOOH       │          │         │
│  │  │  marketplace  │  │   profiles   │  │   screens    │          │         │
│  │  │  campaigns    │  │   contracts  │  │   schedules   │          │         │
│  │  └───────────────┘  └───────────────┘  └───────────────┘          │         │
│  └─────────────────────────────────────────────────────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## QUICK REFERENCE

### Service URLs (Environment Variables)

| Service | Env Variable | Default URL |
|---------|-------------|-------------|
| REZ-intent-graph | `INTENT_CAPTURE_URL` | https://rez-intent-graph.onrender.com |
| REZ-event-platform | `EVENT_PLATFORM_URL` | https://rez-event-platform.onrender.com |
| REZ-intelligence-hub | `INTELLIGENCE_HUB_URL` | https://rez-intelligence-hub.onrender.com |
| REZ-insights | `INSIGHTS_SERVICE_URL` | https://rez-insights-service.onrender.com |
| rez-order-service | `ORDER_SERVICE_URL` | - |
| rez-auth-service | `AUTH_SERVICE_URL` | - |
| rez-notifications | `NOTIFICATIONS_SERVICE_URL` | - |

### Shared Secrets

All inter-service communication uses `INTERNAL_SERVICE_TOKEN` (or `INTERNAL_SERVICE_TOKENS_JSON` for scoped tokens).

### Ports

| Service | Port |
|---------|------|
| REZ-ads-service | 4007 |
| REZ-decision-service | 4027 |
| REZ-gamification | 3004 |
| REZ-automation | 4020 |
| REZ-media-events | 3008 |
| adBazaar | 3000 |
| REZ-lead-intelligence | varies |

---

*End of Document*
