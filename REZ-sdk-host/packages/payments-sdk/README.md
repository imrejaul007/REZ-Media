# @rez-app/payments-sdk

REZ Payments SDK for integrating payment services into 3rd party applications.

## Installation

```bash
npm install @rez-app/payments-sdk
```

## Quick Start

```typescript
import {
  init,
  setUser,
  createPayment,
  getPaymentStatus,
  getWalletBalance,
  trackEvent,
} from '@rez-app/payments-sdk';

// Initialize the SDK
await init({
  apiBaseUrl: 'https://api.rez-media.com/payments',
  environment: 'production',
  timeout: 60000,
});

// Set user after authentication
setUser({
  id: 'user-123',
  email: 'user@example.com',
  phone: '+919876543210',
});

// Create a payment
const payment = await createPayment({
  amount: 50000, // Amount in paisa (INR)
  method: 'upi',
  orderId: 'order-456',
  description: 'Premium Subscription',
  customer: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+919876543210',
  },
  metadata: {
    plan: 'premium',
    duration: 'monthly',
  },
});

console.log(`Payment ID: ${payment.paymentId}`);
console.log(`Status: ${payment.status}`);

// For redirect-based payments
if (payment.paymentUrl) {
  // Redirect user to payment.paymentUrl
}

// Check payment status
const status = await getPaymentStatus(payment.paymentId);
console.log(`Updated Status: ${status.status}`);
```

## Features

- **Multiple Payment Methods**: Cards, UPI, Netbanking, Wallet, Bank Transfer
- **Payment Lifecycle**: Create, confirm, track, and cancel payments
- **Refunds**: Full and partial refunds
- **Wallet**: Balance checks, top-ups, withdrawals
- **Subscriptions**: Recurring payment management
- **Saved Methods**: Store payment methods for faster checkout
- **Transaction History**: Complete payment history

## API Reference

### Core Functions

#### init(config?)
Initialize the SDK.

```typescript
await init({
  apiBaseUrl: 'https://api.rez-media.com/payments',
  environment: 'production',
  timeout: 60000,
});
```

#### getUser() / setUser(user) / clearUser()
Manage the current user.

#### trackEvent(eventName, data?)
Track payment-related events.

### Payment Methods

#### getPaymentMethods()
Get all available payment methods.

```typescript
const methods = await getPaymentMethods();
// [{ id: 'upi', type: 'upi', name: 'UPI', ... }, ...]
```

#### getSavedPaymentMethods()
Get user's saved payment methods.

```typescript
const saved = await getSavedPaymentMethods();
```

#### savePaymentMethod(paymentMethodId, metadata?)
Save a payment method for future use.

```typescript
await savePaymentMethod('card-123', {
  nickname: 'Work Card',
});
```

#### removePaymentMethod(paymentMethodId)
Remove a saved payment method.

```typescript
await removePaymentMethod('card-123');
```

### Payments

#### createPayment(request)
Create and initiate a payment.

```typescript
const payment = await createPayment({
  amount: 50000, // in smallest currency unit (paisa for INR)
  currency: 'INR',
  method: 'upi',
  paymentMethodId: 'upi-123',
  orderId: 'order-456',
  idempotencyKey: 'unique-key-123',
  description: 'Premium Subscription',
  customer: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+919876543210',
  },
  receipt: {
    notes: ['Thank you for your purchase'],
    softCopy: true,
  },
  metadata: {
    plan: 'premium',
  },
});
```

#### confirmPayment(paymentId, confirmationData?)
Confirm a payment (for methods requiring confirmation).

```typescript
const confirmed = await confirmPayment(paymentId, {
  // Method-specific confirmation data
});
```

#### getPaymentStatus(paymentId)
Get current payment status.

```typescript
const status = await getPaymentStatus('pay-123');
// {
//   paymentId: 'pay-123',
//   status: 'captured',
//   amount: 50000,
//   currency: 'INR',
//   history: [...],
// }
```

#### cancelPayment(paymentId, reason?)
Cancel a pending payment.

```typescript
await cancelPayment('pay-123', 'Customer requested cancellation');
```

### Refunds

#### requestRefund(refundRequest)
Request a refund.

```typescript
const refund = await requestRefund({
  paymentId: 'pay-123',
  amount: 25000, // Partial refund
  reason: 'requested_by_customer',
  notes: 'Customer satisfied with partial refund',
  idempotencyKey: 'refund-key-123',
});
```

#### getRefundStatus(refundId)
Get refund status.

```typescript
const status = await getRefundStatus('ref-123');
```

### Wallet

#### getWalletBalance()
Get user's wallet balance.

```typescript
const balance = await getWalletBalance();
// {
//   balance: 5000,
//   pendingBalance: 0,
//   currency: 'INR',
//   minBalance: 0,
//   maxBalance: 100000,
// }
```

#### addToWallet(amount, paymentMethodId, metadata?)
Add money to wallet.

```typescript
const topup = await addToWallet(1000, 'card-123', {
  source: 'bonus',
});
```

#### withdrawFromWallet(amount, method, accountDetails)
Withdraw from wallet.

```typescript
const withdrawal = await withdrawFromWallet(500, 'bank_account', {
  accountNumber: '1234567890',
  ifsc: 'HDFC0001234',
});
// { success: true, withdrawalId: 'wd-123', estimatedArrival: Date.now() + 86400000 }
```

### Transactions

#### getTransactionHistory(options?)
Get user's transaction history.

```typescript
const history = await getTransactionHistory({
  limit: 20,
  offset: 0,
  type: 'payment', // 'payment' | 'refund' | 'wallet' | 'all'
  status: 'success', // 'success' | 'failed' | 'pending' | 'all'
  startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
  endDate: Date.now(),
});
```

#### getTransaction(transactionId)
Get a specific transaction.

```typescript
const transaction = await getTransaction('txn-123');
```

### Subscriptions

#### createSubscription(subscription)
Create a recurring payment/subscription.

```typescript
const subscription = await createSubscription({
  planId: 'plan-premium-monthly',
  paymentMethodId: 'card-123',
  startDate: Date.now() + 24 * 60 * 60 * 1000, // Start tomorrow
  metadata: {
    trialDays: 7,
  },
});
// { success: true, subscriptionId: 'sub-123', nextBillingDate: ..., status: 'active' }
```

#### cancelSubscription(subscriptionId, reason?, immediate?)
Cancel a subscription.

```typescript
await cancelSubscription('sub-123', 'Not using service', false);
// false = cancel at end of billing period
// true = cancel immediately
```

## Payment Methods

Supported payment method types:

| Type | Description |
|------|-------------|
| `card` | Credit/Debit cards (Visa, Mastercard, Amex, RuPay) |
| `upi` | UPI payments |
| `netbanking` | Net banking |
| `bank_account` | Bank account (for withdrawals) |
| `wallet` | REZ Wallet |
| `emi` | EMI (Equated Monthly Installments) |
| `cod` | Cash on Delivery |
| `qr` | QR code payments |

## Error Handling

```typescript
try {
  const payment = await createPayment({
    amount: 50000,
    method: 'card',
  });
} catch (error) {
  if (error.message.includes('insufficient')) {
    // Handle insufficient funds
  } else if (error.message.includes('validation')) {
    // Handle validation errors
  }
}
```

## Webhook Integration

Configure webhook endpoints to receive payment status updates:

```typescript
// Your webhook handler
app.post('/webhooks/payment', async (req, res) => {
  const { paymentId, status, amount } = req.body;

  switch (status) {
    case 'captured':
      // Fulfill order
      break;
    case 'failed':
      // Handle failure
      break;
  }

  res.json({ received: true });
});
```

## TypeScript

This SDK is written in TypeScript with full type definitions.

```typescript
import type {
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  RefundRequest,
  RefundResponse,
  WalletBalance,
  PaymentMethod,
  Transaction,
} from '@rez-app/payments-sdk';
```

## Security

- All API calls use HTTPS
- Sensitive data is never stored in the SDK
- Payment method details are handled server-side
- Idempotency keys prevent duplicate charges

## License

MIT
