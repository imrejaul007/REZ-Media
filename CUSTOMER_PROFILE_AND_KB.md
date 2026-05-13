# REZ Universal Customer Profile + Knowledge Graph

**Date:** May 13, 2026

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REZ CONSUMER OS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              CONSUMER 360 PROFILE                                  │ │
│  │                                                                  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │ │
│  │  │ Identity │  │ Devices │  │   Apps   │  │ Wallets  │      │ │
│  │  │ Phone    │  │ iOS      │  │ Hotel    │  │ Cash     │      │ │
│  │  │ Email    │  │ Android  │  │ Food     │  │ Coins    │      │ │
│  │  │ WhatsApp │  │ Web      │  │ Retail   │  │ Points   │      │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │ │
│  │                                                                  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │ │
│  │  │ Tastes   │  │ Intent   │  │ Loyalty  │  │  AI KB   │      │ │
│  │  │ Cuisine  │  │ Browse   │  │ Tier     │  │ Memory   │      │ │
│  │  │ Price    │  │ Search   │  │ Points   │  │ Prefs    │      │ │
│  │  │ Style    │  │ Bookings │  │ History  │  │ Context  │      │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                    │                                    │
│                                    │ connected to                      │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    KNOWLEDGE GRAPH                               │ │
│  │                                                                  │ │
│  │  Consumer ────> Merchant ────> Product                         │ │
│  │      │               │               │                           │ │
│  │      │               │               │                           │ │
│  │      ▼               ▼               ▼                           │ │
│  │   Visit          Category         Brand                          │ │
│  │   Transaction    Location        Price                          │ │
│  │   Rating         Tag             Tag                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## CONSUMER 360 Profile

### What It Is

Unified customer profile that links:
- All phone numbers (WhatsApp, phone, SMS)
- All devices (iOS, Android, Web, Kiosk)
- All apps (Hotel, Food, Retail, Wasil)
- All wallets (Cash, Coins, Points, Gift Card)
- All transactions across merchants
- All browsing behavior
- All intent signals
- AI memory and preferences

### Data Model

```typescript
interface Consumer360 {
  // Identity (link all identifiers)
  identity: {
    user_id: string;
    primary_phone: string;
    primary_email: string;
    whatsapp?: string;
    linked_phones: string[];
    linked_emails: string[];
  };

  // Devices
  devices: {
    device_id: string;
    type: 'ios' | 'android' | 'web' | 'tablet' | 'kiosk';
    fingerprint: string;
    first_seen: Date;
    last_active: Date;
  }[];

  // Apps
  apps: {
    app_id: 'hotel' | 'food' | 'retail' | 'wasil' | 'admin';
    user_id_in_app: string;
    linked_at: Date;
  }[];

  // Wallets
  wallets: {
    type: 'cash' | 'coins' | 'points' | 'gift_card';
    balance: number;
    linked: boolean;
  }[];

  // Behavior
  behavior: {
    total_orders: number;
    total_spend: number;
    avg_order_value: number;
    favorite_categories: string[];
    preferred_payment: string;
    peak_hours: number[];
    favorite_locations: string[];
  };

  // Taste Profile
  tastes: {
    preferred_cuisines: string[];
    dietary_restrictions: string[];
    price_sensitivity: 'low' | 'medium' | 'high';
    style_preferences: string[];
  };

  // AI Knowledge Base
  ai_kb: {
    memory: string[];           // Important context
    preferences: Record<string, any>;  // Personal preferences
    goals: string[];           // User goals
    context: Record<string, any>;  // Current context
    last_updated: Date;
  };
}
```

---

## KNOWLEDGE GRAPH

### What It Is

Graph database connecting:
- Consumers to Merchants
- Merchants to Products
- Products to Categories
- Locations to Events
- Users to Intent

### Graph Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        GRAPH NODES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PERSON ─────────> PHONE ─────────> EMAIL                      │
│      │                │                │                       │
│      │                │                │                       │
│      ▼                ▼                ▼                       │
│  DEVICE ────────> APP ──────────> ACCOUNT                     │
│      │                                                    │
│      │              ┌──────────────────┐                    │
│      └─────────────►│   TRANSACTION    │                    │
│                     │   order_id      │                    │
│                     │   merchant_id   │                    │
│                     │   amount        │                    │
│                     │   items[]      │                    │
│                     │   timestamp    │                    │
│                     └────────┬─────────┘                    │
│                              │                              │
│                              ▼                              │
│                     ┌──────────────────┐                    │
│                     │    MERCHANT     │                    │
│                     │   merchant_id   │                    │
│                     │   category     │                    │
│                     │   location     │                    │
│                     └────────┬─────────┘                    │
│                              │                              │
│                              ▼                              │
│                     ┌──────────────────┐                    │
│                     │    PRODUCT      │                    │
│                     │   product_id   │                    │
│                     │   brand        │                    │
│                     │   category     │                    │
│                     │   price        │                    │
│                     └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## CONNECTIONS: Profile ↔ Knowledge Graph

Every consumer profile is connected to their KB (Knowledge Base):

```typescript
interface ConsumerProfileWithKB {
  // Standard profile
  profile: Consumer360;

  // Knowledge Base (unique per consumer)
  knowledge_base: {
    // Conversation history
    conversations: {
      app: string;
      messages: Message[];
      last_conversation: Date;
    }[];

    // Explicit preferences (told us)
    explicit_prefs: {
      allergies: string[];
      dietary: string[];
      favorites: string[];
      dislikes: string[];
    };

    // Inferred preferences (learned)
    inferred_prefs: {
      cuisine_scores: Record<string, number>;
      brand_affinity: Record<string, number>;
      price_range: { min: number; max: number };
      location_preferences: string[];
    };

    // Goals (from conversations)
    goals: {
      text: string;
      context: string;
      stated_at: Date;
      status: 'active' | 'completed' | 'abandoned';
    }[];

    // Context (current situation)
    context: {
      current_location?: string;
      occasion?: string;
      party_size?: number;
      dietary_today?: string[];
      mood?: string;
    };
  };
}
```

---

## SERVICES THAT USE THIS

### REZ-Intelligence

| Service | Purpose |
|---------|---------|
| REZ-consumer-graph | Consumer 360 profile |
| REZ-identity-graph | Identity resolution |
| REZ-universal-user-graph | Cross-app linking |
| REZ-merchant-360 | Merchant profile |
| REZ-knowledge-graph | Knowledge DB |
| REZ-intent-graph | Intent signals |

### REZ-Media

| Service | Uses |
|---------|------|
| REZ-lead-intelligence | Audience segments from KB |
| REZ-decision-service | Personalization from KB |
| REZ-marketing | Targeted broadcasts from KB |
| REZ-gamification | Loyalty from KB |

### RABTUL

| Service | Uses |
|---------|------|
| REZ-cross-wallet-identity | Wallet linking |
| REZ-wallet-service | Coin balance |
| REZ-auth-service | Identity |

---

## WHAT'S BUILT

### Consumer Graph

```
REZ-consumer-graph/
├── src/
│   ├── ConsumerProfile.ts      # 360 profile model
│   ├── ConsumerGraph.ts        # Graph operations
│   ├── IdentityResolver.ts      # Link identities
│   ├── graph/
│   │   ├── GraphEngine.ts     # Graph DB
│   │   └── RelationshipMapper.ts
│   ├── identity/
│   │   ├── CrossPlatformLinker.ts
│   │   └── DeviceResolver.ts
│   └── modules/
│       └── PaymentModule.ts
└── README.md
```

### Merchant 360

```
REZ-merchant-360/
├── src/
│   ├── MerchantProfile.ts      # Merchant model
│   ├── MerchantGraph.ts       # Graph operations
│   ├── AddressSchema.ts
│   ├── BusinessHoursSchema.ts
│   ├── FinancesSchema.ts
│   └── ...
└── README.md
```

### Knowledge Graph

```
REZ-knowledge-graph/
├── src/
│   ├── nodes/                 # Node types
│   ├── edges/                 # Edge types
│   ├── queries/               # Graph queries
│   └── services/             # Graph services
└── README.md
```

---

## MISSING PIECES

| Component | Status | Priority |
|-----------|--------|----------|
| **Consumer KB Service** | Build | HIGH |
| **Graph API** | Build | HIGH |
| **KB Sync Service** | Build | HIGH |
| **Intent Extraction** | Build | MEDIUM |
| **Preference Learning** | Build | MEDIUM |
| **RTO Scoring** | Build | HIGH |

---

## GRAPH QUERIES

### Find Consumer's Full Profile

```graphql
query GetConsumer360($phone: String!) {
  consumer(phone: $phone) {
    identity {
      user_id
      primary_phone
      linked_phones
    }
    devices {
      device_id
      type
    }
    wallets {
      type
      balance
    }
    behavior {
      total_orders
      total_spend
      favorite_categories
    }
    ai_kb {
      explicit_prefs
      inferred_prefs
      goals
    }
  }
}
```

### Find Similar Consumers

```graphql
query FindSimilarConsumers($consumer_id: ID!) {
  similarConsumers(consumerId: $consumer_id, limit: 10) {
    user_id
    similarity_score
    shared_preferences
    shared_merchants
  }
}
```

### Get Consumer Journey

```graphql
query GetConsumerJourney($consumer_id: ID!, $limit: Int) {
  consumerJourney(consumerId: $consumer_id, limit: $limit) {
    timestamp
    event_type
    merchant_id
    product_id
    location
    intent_signal
  }
}
```

---

## HOW TO USE

### 1. Create Profile on Signup

```typescript
// User signs up with phone
POST /api/consumers
{
  phone: "+919876543210",
  source: "hotel_app"
}

// Links to existing profile or creates new
```

### 2. Update KB from Interactions

```typescript
// User browses restaurants
POST /api/consumers/:id/kb
{
  action: "browse",
  data: {
    category: "biryani",
    merchant_id: "merchant_123",
    timestamp: "2026-05-13T12:00:00Z"
  }
}
```

### 3. Query for Personalization

```typescript
// Get personalized recommendations
GET /api/consumers/:id/recommendations
// Returns based on:
// - Explicit preferences
// - Inferred tastes
// - Recent browsing
// - Similar users
// - Context (location, time)
```

### 4. Link New Identity

```typescript
// User links WhatsApp
POST /api/consumers/:id/link
{
  type: "whatsapp",
  identifier: "+919876543210"
}
```

---

## FUTURE: RTO SCORE

Every consumer profile will include:

```typescript
interface RTOScore {
  consumer_id: string;
  score: number;           // 0-100
  factors: {
    order_count: number;
    return_rate: number;
    cod_rate: number;
    fraud_signals: string[];
    address_valid: boolean;
    device_trusted: boolean;
  };
  risk_level: 'low' | 'medium' | 'high';
  updated_at: Date;
}
```

---

## DATA FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  USER ACTION                                                      │
│  (order, browse, message)                                        │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐                                                │
│  │   Event     │                                                 │
│  │   Service   │                                                 │
│  └──────┬───────┘                                                │
│         │                                                         │
│         ▼                                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              CONSUMER 360 + KB UPDATE                       │  │
│  │                                                              │  │
│  │  1. Update behavior stats                                   │  │
│  │  2. Update taste profile                                    │  │
│  │  3. Add to intent signals                                   │  │
│  │  4. Update AI memory                                       │  │
│  │  5. Calculate RTO score                                     │  │
│  │  6. Link to graph nodes                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐                                                │
│  │   Graph DB   │                                                │
│  │  (Updates)   │                                                │
│  └──────────────┘                                                │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐                                                │
│  │  Available   │                                                │
│  │  for AI      │                                                │
│  └──────────────┘                                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

*End of Document*
