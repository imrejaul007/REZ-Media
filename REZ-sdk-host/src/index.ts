/**
 * REZ SDK Host - Package SDKs for 3rd party apps
 * npm packages: @rez-app/ads-sdk, @rez-app/loyalty-sdk, @rez-app/analytics-sdk
 */

// REZ Ads SDK - npm install @rez-app/ads-sdk
// REZ Loyalty SDK - npm install @rez-app/loyalty-sdk
// REZ Analytics SDK - npm install @rez-app/analytics-sdk
// REZ Payments SDK - npm install @rez-app/payments-sdk

// Register as npm packages:
export const SDK_HOST = process.env.SDK_HOST || 'https://sdk.rezapp.com';

// Supported SDKs
export const SDKs = {
  ads: '@rez-app/ads-sdk',
  loyalty: '@rez-app/loyalty-sdk',
  analytics: '@rez-app/analytics-sdk',
  payments: '@rez-app/payments-sdk',
  attribution: '@rez-app/attribution-sdk',
  chat: '@rez-app/chat-sdk',
};
