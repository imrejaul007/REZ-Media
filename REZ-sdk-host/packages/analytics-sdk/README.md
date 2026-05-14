# @rez-app/analytics-sdk

REZ Analytics SDK for integrating analytics and tracking services into 3rd party applications.

## Installation

```bash
npm install @rez-app/analytics-sdk
```

## Quick Start

```typescript
import {
  init,
  setUser,
  trackEvent,
  trackScreenView,
  trackPurchase,
  trackConversion,
  setUserProperties,
  getABTestVariant,
  flush,
} from '@rez-app/analytics-sdk';

// Initialize the SDK
await init({
  apiBaseUrl: 'https://api.rez-media.com/analytics',
  environment: 'production',
  batchSize: 20,
  flushInterval: 5000,
});

// Set user after authentication
setUser({
  id: 'user-123',
  email: 'user@example.com',
  name: 'John Doe',
  userType: 'premium',
});

// Set user properties
await setUserProperties({
  language: 'en',
  country: 'India',
  city: 'Mumbai',
});

// Track events
await trackEvent('page_view', { page: 'home', referrer: 'direct' });
await trackEvent('button_click', { button: 'add_to_cart', productId: 'prod-456' });

// Track a purchase
await trackPurchase({
  transactionId: 'txn-789',
  revenue: 999,
  tax: 90,
  shipping: 50,
  currency: 'INR',
  items: [
    { itemId: 'prod-123', name: 'Widget', category: 'Electronics', price: 499, quantity: 2 },
  ],
});

// Track conversion
await trackConversion({
  id: 'conv-123',
  name: 'signup',
  value: 10,
  channel: 'organic',
});
```

## Features

- **Event Tracking**: Track any custom event with properties
- **Screen Tracking**: Track screen/session views
- **User Properties**: Set and update user attributes
- **Batch Processing**: Automatic batching and flushing
- **Conversions**: Track conversion events
- **Funnels**: Track funnel step completion
- **A/B Testing**: Get variant assignments and track conversions
- **Cohorts**: Add users to analysis cohorts
- **Purchase Tracking**: Track revenue and refunds

## API Reference

### Core Functions

#### init(config?)
Initialize the SDK with configuration.

```typescript
await init({
  apiBaseUrl: 'https://api.rez-media.com/analytics',
  environment: 'production',
  batchSize: 20,
  flushInterval: 5000,
  sessionTimeout: 1800000,
  trackPageViews: true,
  autoPageView: true,
});
```

#### getUser() / setUser(user) / clearUser()
Manage the current user.

### Event Tracking

#### trackEvent(eventName, data?, options?)
Track a custom event.

```typescript
await trackEvent('add_to_cart', {
  productId: 'prod-123',
  productName: 'Premium Widget',
  price: 499,
  quantity: 1,
  category: 'Electronics',
});
```

Options:
```typescript
{
  persist: true,    // Persist event
  priority: 'high', // 'low' | 'normal' | 'high'
  timestamp: Date.now(),
}
```

#### trackScreenView(screen)
Track a screen/page view.

```typescript
await trackScreenView({
  name: 'ProductDetail',
  className: 'ProductDetailScreen',
  previousScreen: 'ProductList',
  transitionType: 'push',
});
```

### User Properties

#### setUserProperties(properties)
Set user properties for segmentation.

```typescript
await setUserProperties({
  name: 'John Doe',
  email: 'john@example.com',
  age: 28,
  gender: 'male',
  language: 'en',
  country: 'India',
  userType: 'premium',
});
```

#### setUserProperty(key, value)
Set a single user property.

```typescript
await setUserProperty('lastPurchaseDate', Date.now());
```

#### incrementUserProperty(key, value?)
Increment a numeric property.

```typescript
await incrementUserProperty('loginCount', 1);
await incrementUserProperty('totalPurchases', 1);
```

### Session Management

#### startSession()
Start a new analytics session.

```typescript
const sessionId = await startSession();
```

#### endSession()
End the current session and flush all events.

```typescript
await endSession();
```

### Conversions

#### trackConversion(conversion)
Track a conversion event.

```typescript
await trackConversion({
  id: 'conv-123',
  name: 'signup',
  value: 10,
  currency: 'INR',
  campaignId: 'camp-456',
  channel: 'organic',
  attribution: {
    source: 'google',
    medium: 'cpc',
    campaign: 'summer_sale',
  },
});
```

#### trackPurchase(purchase)
Track a purchase transaction.

```typescript
await trackPurchase({
  transactionId: 'txn-789',
  revenue: 999,
  tax: 90,
  shipping: 50,
  currency: 'INR',
  items: [
    {
      itemId: 'prod-123',
      name: 'Widget',
      category: 'Electronics',
      price: 499,
      quantity: 2,
    },
  ],
});
```

#### trackRefund(refund)
Track a refund.

```typescript
await trackRefund({
  transactionId: 'txn-789',
  refundId: 'ref-123',
  amount: 999,
  reason: 'Wrong size',
});
```

### Funnels

#### trackFunnelStep(funnelName, step)
Track funnel progression.

```typescript
await trackFunnelStep('checkout', {
  name: 'cart_viewed',
  index: 0,
  value: 500,
});

await trackFunnelStep('checkout', {
  name: 'payment_entered',
  index: 1,
  timeSpent: 30000, // milliseconds
});

await trackFunnelStep('checkout', {
  name: 'purchase_complete',
  index: 2,
  completed: true,
});
```

### A/B Testing

#### getABTestVariant(testConfig)
Get user's A/B test variant assignment.

```typescript
const variant = await getABTestVariant({
  testId: 'test-123',
  testName: 'checkout_button_color',
  variants: ['red', 'blue', 'green'],
  distribution: [0.33, 0.34, 0.33],
});
// Returns: 'red' | 'blue' | 'green'
```

#### trackABTestConversion(testId, variant, value?)
Track A/B test conversion.

```typescript
await trackABTestConversion('test-123', variant, 100);
```

### Cohorts

#### addToCohort(cohortConfig)
Add user to a cohort.

```typescript
await addToCohort({
  cohortId: 'cohort-123',
  cohortName: 'early_adopters',
  metadata: {
    signupDate: '2024-01-01',
    referralSource: 'friend',
  },
});
```

### Debug & Utilities

#### setDebugMode(enabled)
Enable/disable debug logging.

```typescript
setDebugMode(true);
```

#### getQueuedEventCount()
Get number of events in queue.

```typescript
const count = getQueuedEventCount();
```

#### flush()
Force flush all queued events.

```typescript
await flush();
```

#### reset()
Reset SDK state.

```typescript
reset();
```

## Event Types

The SDK automatically tracks these events:
- `session_start`
- `session_end`
- `screen_view`
- `user_identity_change`
- `user_logout`
- `user_properties_updated`

## TypeScript

This SDK is written in TypeScript with full type definitions.

```typescript
import type {
  User,
  EventData,
  ScreenView,
  ConversionData,
  ABTestConfig,
} from '@rez-app/analytics-sdk';
```

## License

MIT
