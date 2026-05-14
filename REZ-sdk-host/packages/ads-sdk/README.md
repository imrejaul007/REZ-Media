# @rez-app/ads-sdk

REZ Ads SDK for integrating advertising services into 3rd party applications.

## Installation

```bash
npm install @rez-app/ads-sdk
```

## Quick Start

```typescript
import { init, showAd, trackEvent, getUser, setUser } from '@rez-app/ads-sdk';

// Initialize the SDK
await init({
  apiBaseUrl: 'https://api.rez-media.com',
  environment: 'production',
});

// Set user after authentication
setUser({
  id: 'user-123',
  email: 'user@example.com',
  name: 'John Doe',
  age: 28,
  gender: 'male',
  location: {
    country: 'India',
    city: 'Mumbai',
  },
});

// Track user events
await trackEvent('page_view', {
  page: 'home',
  referrer: 'direct',
});

// Show an ad
const ad = await showAd({
  placement: 'home',
  size: '320x50',
  targeting: {
    categories: ['technology', 'gaming'],
    adType: 'banner',
  },
});

console.log('Ad loaded:', ad.adId);
```

## Features

- **Banner Ads**: Standard banner advertisements
- **Interstitial Ads**: Full-screen ads between content
- **Rewarded Ads**: Ads users can watch for rewards
- **Native Ads**: Ads that blend with app content
- **Event Tracking**: Track user interactions and ad performance
- **Targeting**: Custom targeting based on user attributes

## API Reference

### init(config?)

Initialize the SDK. Must be called before any other SDK functions.

```typescript
await init({
  apiBaseUrl: 'https://api.rez-media.com',
  environment: 'production',
  timeout: 30000,
  retries: 3,
});
```

### getUser()

Returns the current user object.

```typescript
const user = getUser();
```

### setUser(user)

Set the current user for tracking and targeting.

```typescript
setUser({
  id: 'user-123',
  name: 'John Doe',
});
```

### trackEvent(eventName, data?, options?)

Track a custom event.

```typescript
await trackEvent('purchase', {
  itemId: 'item-456',
  amount: 99.99,
  currency: 'INR',
});
```

### showAd(config)

Display an ad to the user.

```typescript
const ad = await showAd({
  placement: 'home',
  size: '320x50',
  targeting: {
    adType: 'banner',
  },
});
```

### preloadAd(placement)

Preload an ad without showing it.

```typescript
const ad = await preloadAd('home');
```

### requestAd(placement, adType)

Request a specific type of ad.

```typescript
const ad = await requestAd('rewarded_video', 'rewarded');
```

### dismissAd(adId)

Dismiss a currently displayed ad.

```typescript
await dismissAd(adId);
```

### reportAdInteraction(adId, interactionType)

Report an ad interaction.

```typescript
await reportAdInteraction(adId, 'click');
await reportAdInteraction(adId, 'complete');
```

### isAdReady(placement)

Check if an ad is ready for the given placement.

```typescript
const ready = await isAdReady('interstitial');
```

### updateTargetingAttributes(attributes)

Update user targeting attributes.

```typescript
await updateTargetingAttributes({
  interests: ['gaming', 'sports'],
  purchaseHistory: ['electronics'],
});
```

### getAdPreferences()

Get user's ad preferences.

```typescript
const prefs = await getAdPreferences();
// { optedOut: false, categories: ['tech', 'fashion'] }
```

### setAdPreferences(preferences)

Set user's ad preferences.

```typescript
await setAdPreferences({
  optedOut: false,
  categories: ['tech', 'food'],
});
```

## Ad Sizes

| Size | Description |
|------|-------------|
| `320x50` | Banner |
| `320x100` | Large Banner |
| `300x250` | Medium Rectangle |
| `728x90` | Leaderboard |
| `full` | Full screen interstitial |
| `native` | Native ad format |

## Ad Placements

| Placement | Description |
|-----------|-------------|
| `home` | Home screen |
| `search` | Search results |
| `product` | Product detail page |
| `cart` | Shopping cart |
| `checkout` | Checkout flow |
| `profile` | User profile |
| `settings` | Settings page |
| `splash` | App splash screen |
| `between_levels` | Between game levels |
| `rewarded_video` | Rewarded video placement |
| `interstitial` | Interstitial placement |

## TypeScript

This SDK is written in TypeScript and includes full type definitions. No additional `@types` package is required.

## License

MIT
