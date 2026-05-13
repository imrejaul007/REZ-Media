# REZ Payment Gateway

Razorpay integration for wallet top-ups, ad payments, and merchant payouts.

## Features

- Wallet top-up via UPI, Card, NetBanking
- Ad payment processing
- Automatic refunds
- Merchant payouts
- Webhook handling

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallet/topup` | POST | Initiate wallet top-up |
| `/api/wallet/verify` | POST | Verify & credit wallet |
| `/api/ads/pay` | POST | Initiate ad payment |
| `/api/ads/verify` | POST | Verify ad payment |
| `/api/ads/refund` | POST | Request refund |
| `/api/payouts/request` | POST | Request payout |
| `/api/webhooks/razorpay` | POST | Razorpay webhooks |

## Setup

```bash
npm install
cp .env.example .env
# Add Razorpay credentials
npm run dev
```

## Razorpay Setup

1. Create account at [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Get API Key ID and Secret
3. Set webhook URL: `https://your-domain.com/api/webhooks/razorpay`
4. Add webhook secret

## Environment Variables

```bash
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```
