# REZ SDK Host

Monorepo for REZ SDK packages that 3rd party applications can install.

## Available SDKs

| SDK | Package Name | Description |
|-----|--------------|-------------|
| **Ads SDK** | `@rez-app/ads-sdk` | Advertising services, ad placements, targeting |
| **Loyalty SDK** | `@rez-app/loyalty-sdk` | Points, rewards, offers, tier management |
| **Analytics SDK** | `@rez-app/analytics-sdk` | Event tracking, funnels, A/B testing |
| **Payments SDK** | `@rez-app/payments-sdk` | Payments, refunds, wallet, subscriptions |

## Installation

Install individual SDKs based on your needs:

```bash
# Install only what you need
npm install @rez-app/ads-sdk
npm install @rez-app/loyalty-sdk
npm install @rez-app/analytics-sdk
npm install @rez-app/payments-sdk
```

Or install all at once:

```bash
npm install @rez-app/ads-sdk @rez-app/loyalty-sdk @rez-app/analytics-sdk @rez-app/payments-sdk
```

## Quick Start

```typescript
import { init as initAds, trackEvent, showAd, setUser } from '@rez-app/ads-sdk';
import { init as initLoyalty, getLoyaltyProfile, earnPoints } from '@rez-app/loyalty-sdk';
import { init as initAnalytics, trackScreenView, trackPurchase } from '@rez-app/analytics-sdk';
import { init as initPayments, createPayment, getWalletBalance } from '@rez-app/payments-sdk';

// Initialize all SDKs
await Promise.all([
  initAds({ apiBaseUrl: 'https://api.rez-media.com' }),
  initLoyalty({ apiBaseUrl: 'https://api.rez-media.com/loyalty' }),
  initAnalytics({ apiBaseUrl: 'https://api.rez-media.com/analytics' }),
  initPayments({ apiBaseUrl: 'https://api.rez-media.com/payments' }),
]);

// Set user for all SDKs
const user = { id: 'user-123', email: 'user@example.com' };
setUser(user); // For ads
// Call setUser for other SDKs similarly

// Track events
await trackEvent('page_view', { page: 'home' });
```

## Shared Features

All SDKs provide these common functions:

### init(config?)
Initialize the SDK with optional configuration.

```typescript
await init({
  apiBaseUrl: 'https://api.rez-media.com',
  environment: 'production',
  timeout: 30000,
});
```

### getUser()
Get the current user object.

### setUser(user)
Set the current authenticated user.

### clearUser()
Clear user data on logout.

### trackEvent(eventName, data?)
Track custom events for analytics.

## TypeScript Support

All SDKs are written in TypeScript and include full type definitions. No additional `@types` packages required.

## Build & Development

```bash
# Install dependencies
npm install

# Build all SDKs
npm run build

# Build individual SDK
npm run build:ads
npm run build:loyalty
npm run build:analytics
npm run build:payments

# Development mode (watch)
npm run dev
```

## Architecture

Each SDK is a standalone package with:
- **Core module**: Main SDK functionality
- **Types module**: TypeScript type definitions
- **Package manifest**: npm package configuration
- **Build config**: tsup configuration for bundling

## License

MIT
