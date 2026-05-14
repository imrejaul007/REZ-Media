# @rez-app/loyalty-sdk

REZ Loyalty SDK for integrating loyalty and rewards services into 3rd party applications.

## Installation

```bash
npm install @rez-app/loyalty-sdk
```

## Quick Start

```typescript
import {
  init,
  setUser,
  getLoyaltyProfile,
  getPointsBalance,
  earnPoints,
  redeemPoints,
  getRewards,
  trackEvent,
} from '@rez-app/loyalty-sdk';

// Initialize the SDK
await init({
  apiBaseUrl: 'https://api.rez-media.com/loyalty',
  environment: 'production',
});

// Set user after authentication
setUser({
  id: 'user-123',
  email: 'user@example.com',
  name: 'John Doe',
});

// Get loyalty profile
const profile = await getLoyaltyProfile();
console.log(`Points: ${profile.points}, Tier: ${profile.tier.name}`);

// Earn points for an action
const transaction = await earnPoints('purchase', {
  referenceId: 'order-456',
  referenceType: 'order',
  metadata: { orderValue: 500 },
});

// Get available rewards
const rewards = await getRewards({ category: 'vouchers', limit: 10 });

// Redeem a reward
const redemption = await redeemPoints('reward-789', {
  quantity: 1,
});
console.log(`Redeemed: ${redemption.reward.name}`);
```

## Features

- **Points Management**: Earn, redeem, and track points
- **Tier System**: Multi-tier loyalty programs
- **Rewards Catalog**: Browse and redeem rewards
- **Offers**: Limited-time promotional offers
- **Referrals**: Referral code generation and application
- **Event Tracking**: Track loyalty-related user actions

## API Reference

### Core Functions

#### init(config?)
Initialize the SDK.

```typescript
await init({
  apiBaseUrl: 'https://api.rez-media.com/loyalty',
  environment: 'production',
  timeout: 30000,
});
```

#### getUser() / setUser(user) / clearUser()
Manage the current user.

#### trackEvent(eventName, data?)
Track loyalty-related events.

### Loyalty Profile

#### getLoyaltyProfile()
Get the user's complete loyalty profile.

```typescript
const profile = await getLoyaltyProfile();
// {
//   userId: 'user-123',
//   points: 5000,
//   pendingPoints: 200,
//   lifetimePoints: 25000,
//   tier: { name: 'Gold', level: 2, benefits: [...] },
//   memberSince: 1700000000000,
//   ...
// }
```

#### getPointsBalance()
Get user's points balance.

```typescript
const balance = await getPointsBalance();
// { points: 5000, pendingPoints: 200, lifetimePoints: 25000, currency: 'points' }
```

### Points Operations

#### earnPoints(action, options?)
Earn points for a user action.

```typescript
await earnPoints('review_submitted', {
  points: 50,
  referenceId: 'review-123',
  referenceType: 'review',
  metadata: { rating: 5 },
});
```

#### redeemPoints(rewardId, options?)
Redeem points for a reward.

```typescript
const result = await redeemPoints('reward-456', {
  quantity: 1,
});
// { success: true, transaction: {...}, reward: {...} }
```

#### getPointsHistory(options?)
Get points transaction history.

```typescript
const history = await getPointsHistory({
  limit: 20,
  offset: 0,
  type: 'earned', // 'earned' | 'redeemed' | 'expired' | 'all'
});
```

### Rewards

#### getRewards(options?)
Get available rewards.

```typescript
const rewards = await getRewards({
  category: 'vouchers',
  pointsMin: 100,
  pointsMax: 5000,
  limit: 20,
});
```

#### getRewardDetails(rewardId)
Get detailed information about a specific reward.

#### canRedeem(rewardId)
Check if the user can redeem a specific reward.

```typescript
const eligibility = await canRedeem('reward-789');
// { canRedeem: true } or { canRedeem: false, reason: 'Insufficient points', pointsNeeded: 500 }
```

### Offers

#### getOffers(options?)
Get available offers for the user.

```typescript
const offers = await getOffers({
  featured: true,
  limit: 10,
});
```

#### claimOffer(offerId)
Claim an available offer.

```typescript
const claim = await claimOffer('offer-123');
// { success: true, claimCode: 'SAVE20', expiresAt: 1700500000000 }
```

### Tier System

#### getTierInfo()
Get current tier and progress to next tier.

```typescript
const tierInfo = await getTierInfo();
// {
//   currentTier: { name: 'Silver', level: 2, ... },
//   nextTier: { name: 'Gold', level: 3, ... },
//   progress: 0.65,
//   pointsToNextTier: 2500
// }
```

#### getTierBenefits()
Get all tier levels and their benefits.

### Referral

#### getReferralCode()
Get user's referral code and share URL.

```typescript
const referral = await getReferralCode();
// { code: 'USER123', shareUrl: 'https://app.rez.com/r/USER123', rewards: { referrerPoints: 100, refereePoints: 50 } }
```

#### applyReferralCode(code)
Apply a referral code.

```typescript
const result = await applyReferralCode('FRIEND456');
// { success: true, bonusAwarded: 50 }
```

## Event Tracking

The SDK automatically tracks these events:
- `loyalty_profile_viewed`
- `points_earned`
- `points_redeemed`
- `reward_viewed`
- `offer_claimed`
- `referral_applied`
- `tier_upgraded`

Track custom events:

```typescript
await trackEvent('custom_action', {
  actionType: 'game_played',
  gameId: 'game-123',
  score: 1000,
});
```

## TypeScript

This SDK is written in TypeScript with full type definitions.

```typescript
import type {
  LoyaltyProfile,
  PointsTransaction,
  Reward,
  Offer,
  Tier,
} from '@rez-app/loyalty-sdk';

const profile: LoyaltyProfile = await getLoyaltyProfile();
```

## License

MIT
