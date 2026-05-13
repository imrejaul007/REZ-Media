# REZ-Media vs GoKwik Feature Audit

**Date:** May 13, 2026

---

## Executive Summary

GoKwik = "Commerce Conversion Optimization SaaS"
ReZ = "AI-Powered Commerce Operating System"

ReZ is LARGER in scope - combining offline + online, consumer + merchant, ads + loyalty + payments.

---

## Feature Comparison Matrix

| Category | GoKwik | REZ-Media | Status |
|----------|--------|-----------|--------|
| **CHECKOUT** |
| One-click checkout | ✅ | ⚠️ Partial | BUILD |
| Address autofill | ✅ | ❌ | BUILD |
| Saved shopper identity | ✅ | ⚠️ REZ-Identity | BUILD |
| One-click reorder | ✅ | ❌ | BUILD |
| COD intelligence | ✅ | ⚠️ REZ-Fraud | BUILD |
| Payment optimization | ✅ | ⚠️ REZ-Payment | DONE |
| Cart abandonment | ✅ | ✅ REZ-Auto | DONE |
| **FRAUD/RISK** |
| ML risk scoring | ✅ | ⚠️ Basic | BUILD |
| COD verification | ✅ | ⚠️ Basic | BUILD |
| Device fingerprinting | ✅ | ⚠️ Basic | BUILD |
| Address validation | ✅ | ❌ | BUILD |
| Behavioral scoring | ✅ | ⚠️ Basic | BUILD |
| RTO engine | ✅ | ❌ | BUILD |
| **IDENTITY** |
| Universal login | ✅ | ⚠️ REZ-Auth | DONE |
| Phone identity | ✅ | ✅ REZ-Identity | DONE |
| Cross-brand identity | ✅ | ⚠️ Merchant Graph | BUILD |
| **WHATSAPP** |
| Abandoned cart recovery | ✅ | ✅ REZ-Marketing | DONE |
| COD confirmation | ✅ | ✅ REZ-Comm | DONE |
| Shipping updates | ✅ | ✅ REZ-Comm | DONE |
| Chatbot flows | ✅ | ⚠️ REZ-Chatbot | BUILD |
| Catalog commerce | ✅ | ✅ REZ-Commerce | DONE |
| WhatsApp checkout | ✅ | ⚠️ Basic | BUILD |
| **ADS/MEDIA** |
| Kwik Ads | ✅ | ✅ AdBazaar | DONE |
| Meta optimization | ✅ | ✅ REZ-Ads | DONE |
| Audience intelligence | ✅ | ✅ REZ-Audiences | DONE |
| Hyperlocal ads | ❌ | ✅ DOOH/QR | DONE |
| Offline attribution | ❌ | ✅ adsqr | DONE |
| Creator ads | ❌ | ✅ creators | DONE |
| **LOYALTY** |
| Coin rewards | ❌ | ✅ REZ-Wallet | DONE |
| Tier system | ❌ | ✅ REZ-Gamification | DONE |
| Points economy | ❌ | ✅ REZ-Economy | DONE |
| Cashback | ❌ | ✅ REZ-Cashback | DONE |
| Gamification | ❌ | ✅ REZ-Games | DONE |
| **RETAIN/MARKETING** |
| Retention engine | ✅ | ✅ REZ-Auto | DONE |
| Drip campaigns | ✅ | ✅ REZ-Marketing | DONE |
| Win-back flows | ✅ | ✅ REZ-Auto | DONE |
| Segment engine | ✅ | ✅ REZ-Audiences | DONE |
| AI recommendations | ✅ | ⚠️ REZ-Decision | BUILD |
| **SHIPPING** |
| Courier aggregation | ✅ | ❌ | LATER |
| AI shipping | ✅ | ❌ | LATER |
| Return management | ✅ | ❌ | LATER |

---

## WHAT WE HAVE (BUILT)

### Core Services

| Service | GoKwik Equivalent |
|---------|------------------|
| REZ-ads-service | Kwik Ads |
| REZ-pricing-engine | Dynamic pricing |
| REZ-marketing | Marketing automation |
| REZ-communications | WhatsApp/SMS/Email |
| REZ-gamification | Loyalty engine |
| REZ-lead-intelligence | Audience segmentation |
| REZ-decision-service | AI recommendations |
| adsqr | QR campaigns + tracking |
| adBazaar | Ad marketplace |
| dooh | DOOH exchange |
| REZ-wallet | Coins + rewards |

### Merchant Onboarding

| Service | Status |
|---------|--------|
| REZ-merchant-onboarding | DONE |
| KYC verification | DONE |
| Admin approval | DONE |

### Payments

| Service | Status |
|---------|--------|
| REZ-payment-gateway | DONE |
| Razorpay integration | DONE |
| Wallet top-up | DONE |
| Payouts | DONE |

### UIs

| App | Status |
|-----|--------|
| REZ-marketing-dashboard | DONE |
| REZ-admin-dashboard | DONE |
| REZ-ai-campaign-builder | DONE |
| rez-chatbot-builder | PARTIAL |
| rez-crm-ui | PARTIAL |

---

## MISSING LAYERS (PRIORITY)

### Priority 1: Checkout Infrastructure

| Feature | Description | Effort |
|---------|-------------|--------|
| **ReZ Checkout SDK** | One-click checkout for any merchant | HIGH |
| **Address Intelligence** | Autofill, validation, saving | MEDIUM |
| **Identity Graph** | Universal customer profile | HIGH |
| **Quick Reorder** | One-tap repeat purchase | MEDIUM |

### Priority 2: Fraud/Risk Engine

| Feature | Description | Effort |
|---------|-------------|--------|
| **RTO Engine** | COD risk scoring | HIGH |
| **Device Fingerprint** | Device intelligence | MEDIUM |
| **Behavioral Score** | User risk profile | HIGH |
| **Merchant Risk** | Vendor risk scoring | MEDIUM |
| **Partial Payment** | Partial COD option | MEDIUM |

### Priority 3: Conversational Commerce

| Feature | Description | Effort |
|---------|-------------|--------|
| **WhatsApp Checkout** | Buy directly in WA | HIGH |
| **Instagram Commerce** | Shop in IG | MEDIUM |
| **AI Sales Agent** | Autonomous seller | HIGH |
| **AI Support Agent** | 24/7 support | MEDIUM |

### Priority 4: Ecommerce SDK

| Feature | Description | Effort |
|---------|-------------|--------|
| **Universal Login** | One login any store | MEDIUM |
| **Cross-brand Identity** | Shared customer data | HIGH |
| **SDK Embed** | Embed loyalty anywhere | HIGH |

---

## WHAT WE HAVE THAT GOKWIK DOESN'T

This is ReZ's MOAT:

| Feature | GoKwik | REZ |
|---------|--------|-----|
| **Hyperlocal commerce** | ❌ | ✅ |
| **Offline merchants** | Limited | ✅ |
| **Multi-app ecosystem** | ❌ | ✅ |
| **POS integration** | ❌ | ✅ |
| **Booking ecosystem** | ❌ | ✅ |
| **Creator economy** | Limited | ✅ |
| **Coin economy** | ❌ | ✅ |
| **Visit-based loyalty** | ❌ | ✅ |
| **QR campaigns** | ❌ | ✅ |
| **DOOH ads** | ❌ | ✅ |
| **Gamification** | ❌ | ✅ |
| **B2B marketplace** | ❌ | ✅ |
| **Finance ecosystem** | ❌ | ✅ |

---

## STRATEGIC POSITIONING

```
GoKwik = "Commerce SaaS for Shopify brands"
       = Checkout + Conversion + Retention

ReZ = "AI Commerce Operating System"
    = Offline + Online + Ads + Loyalty + Payments + CRM + AI
    = Hyperlocal + Ecommerce + Creator + Booking
```

**ReZ is 10x larger in vision.**

---

## RECOMMENDED BUILD ORDER

### Phase 1 (This Week)

1. **ReZ Checkout SDK** - Universal one-click checkout
2. **Identity Graph** - Universal customer profile
3. **WhatsApp Checkout** - Buy in WhatsApp

### Phase 2 (Next Week)

4. **RTO Engine** - COD risk scoring
5. **Device Fingerprint** - Device intelligence
6. **AI Sales Agent** - Autonomous seller

### Phase 3 (This Month)

7. **Cross-brand Identity** - Shared customer data
8. **Instagram Commerce** - Shop in IG
9. **Merchant Risk Engine** - Vendor risk

---

## FINAL COMPARISON

| Aspect | GoKwik | REZ |
|--------|--------|-----|
| Scope | SaaS | Ecosystem |
| Target | D2C brands | Everyone |
| Data | Online only | Online + Offline |
| Commerce | Checkout focus | Full stack |
| Loyalty | Basic | Advanced |
| Ads | Basic | Advanced |
| AI | Partial | Full |
| Scale | India D2C | Global Hyperlocal |

**ReZ wins long-term because:**
1. Combines offline + online data
2. Has consumer apps + merchant apps
3. Has ad network built-in
4. Has loyalty + payments + CRM
5. Has creator ecosystem
6. Has booking ecosystem

---

## WHAT TO BUILD NEXT

1. **ReZ Checkout SDK** - #1 priority
2. **Identity Graph** - #2 priority
3. **RTO Engine** - #3 priority
4. **WhatsApp Checkout** - Revenue driver
5. **AI Sales Agent** - Competitive moat

---

*End of Audit*
