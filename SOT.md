# REZ Media - Source of Truth

**Version:** 2.0  
**Date:** 2026-05-15  
**Status:** AUTHORITATIVE

---

## Overview

REZ-Media handles advertising, engagement, and impact economy (Karma) services.

**Git:** `github.com/imrejaul007/REZ-Media`  
**Local Path:** `REZ-Media/`

---

## Apps & Services

### Karma - Impact Economy Platform

| App | Description | Tech Stack |
|-----|-------------|------------|
| `karma/` | Karma web dashboard | Next.js |
| `karma-mobile/` | Karma mobile app | React Native/Expo |
| `karma-service/` | Karma backend | Node.js/Express |

### DOOH - Digital Out of Home

| App | Description | Tech Stack |
|-----|-------------|------------|
| `dooh-screen-app/` | DOOH display management | Next.js |
| `dooh-mobile/` | DOOH owner app | React Native/Expo |
| `rez-dooh-service/` | DOOH backend | Node.js (Port 4018) |

### Advertising Platform

| Service | Description | Port |
|---------|-------------|------|
| `REZ-ad-ai/` | Intent signal derivation | 4021 |
| `REZ-ai-campaign-builder/` | AI campaign generation | 4009 |
| `REZ-discovery-platform/` | Product discovery & ranking | 3000 |
| `REZ-economic-engine/` | Economic modeling | 4016 |
| `REZ-engagement-platform/` | Loyalty, offers, referrals | 4017 |
| `REZ-journey-service/` | User journey tracking | 4019 |
| `REZ-media-events/` | Media event tracking | 4029 |
| `REZ-pricing-engine/` | Dynamic pricing | 4015 |
| `reks-whatsapp-commerce/` | WhatsApp commerce | 4030 |
| `rez-automation-service/` | Workflow automation | 4028 |
| `rez-instagram-sales-agent/` | Instagram sales | 4032 |
| `rez-business-ai/` | Autonomous AI for merchants | 4059 |

### REZ Business AI Services

| Service | Description | Port |
|---------|-------------|------|
| `rez-business-ai/` | Business AI - Main service | 4059 |

### E-Commerce Connectors

| Service | Port | Description |
|---------|------|-------------|
| `rez-shopify-connector/` | 4050 | Shopify OAuth, webhooks, sync |
| `rez-woocommerce-connector/` | 4051 | WooCommerce REST API, webhooks, sync |

### AI Marketing

| Service | Port | Description |
|---------|------|-------------|
| `REZ-prompt-workflow-ai/` | 4054 | Natural language → workflow |
| `REZ-crm-hub/` | 4056 | HubSpot + Zoho CRM |
| `REZ-support-tools-hub/` | 4057 | Zendesk + Freshdesk + Intercom |

### Voice & Commerce

| Service | Port | Description |
|---------|------|-------------|
| `rez-voice-cart-recovery/` | 4053 | AI voice calls, cart recovery |

---

## Integrations

### RABTUL Services

| Service | Status | Usage |
|---------|--------|-------|
| Payment | ✅ | `razorpay.ts`, `razorpayService.ts` |
| Notifications | ✅ | `notification.service.ts` |
| Auth | ✅ | JWT authentication |

---

## Quick Links

| Document | Location |
|----------|----------|
| **Master SOT** | `RABTUL-Technologies/SOT.md` |
| RAP (Services) | `RABTUL-Technologies/RAP.md` |
| Governance | `RABTUL-Technologies/SERVICE-GOVERNANCE.md` |
| Architecture | `ARCHITECTURE.md` |

---

**Last Updated:** May 15, 2026
