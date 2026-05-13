# Wallet API Documentation

The Wallet API provides comprehensive management of merchant funds, including deposits, reservations, deductions, and transaction history.

## Overview

The ReZ merchant wallet system enables:

- **Fund Management**: Add and withdraw funds
- **Campaign Budgeting**: Reserve funds for campaigns
- **Automatic Deduction**: Real-time billing as campaigns run
- **Transaction Tracking**: Complete audit trail

## Wallet Structure

```
Merchant Wallet
  |
  +-- Available Balance (spendable)
  |
  +-- Reserved Balance (locked for campaigns)
  |     |
  |     +-- Campaign A: 10,000
  |     +-- Campaign B: 5,000
  |
  +-- Pending Transactions
```

## Endpoints

### GET /wallet/balance - Get Wallet Balance

Retrieve the current wallet balance and breakdown.

**Request:**

```bash
curl -X GET "https://api.rez.money/v1/wallet/balance?merchantId=merchant_xyz789" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "merchantId": "merchant_xyz789",
  "balance": 50000.00,
  "available": 35000.00,
  "reserved": 15000.00,
  "pending": 0.00,
  "currency": "INR",
  "lastUpdated": "2026-05-13T10:30:00Z"
}
```

### POST /wallet/deposit - Add Funds

Add funds to the merchant wallet.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/wallet/deposit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_xyz789",
    "amount": 50000,
    "paymentMethod": "upi",
    "reference": "order_abc123"
  }'
```

**Payment Methods:**

| Method | Description |
|--------|-------------|
| `upi` | UPI transfer |
| `card` | Credit/Debit card |
| `netbanking` | Net banking |
| `bank_transfer` | Bank transfer (NEFT/RTGS) |

**Response:**

```json
{
  "success": true,
  "data": {
    "transactionId": "txn_def456",
    "amount": 50000.00,
    "newBalance": 100000.00,
    "timestamp": "2026-05-13T10:30:00Z"
  }
}
```

### POST /wallet/reserve - Reserve Funds

Reserve funds from wallet for a campaign.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/wallet/reserve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_xyz789",
    "amount": 10000,
    "campaignId": "camp_abc123",
    "purpose": "ad_campaign"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "reservationId": "res_ghi789",
    "amount": 10000.00,
    "remainingBalance": 40000.00,
    "expiresAt": "2026-05-20T10:30:00Z"
  }
}
```

**Purpose Types:**

| Purpose | Description |
|---------|-------------|
| `ad_campaign` | Reserved for ad campaign spend |
| `feature_highlight` | Feature spotlight promotion |
| `sponsored_content` | Sponsored content placement |

### POST /wallet/deduct - Deduct Funds

Deduct funds from reserved balance (called by billing services).

**Request:**

```bash
curl -X POST https://api.rez.money/v1/wallet/deduct \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_xyz789",
    "amount": 100,
    "campaignId": "camp_abc123",
    "reason": "impression_charge",
    "eventId": "evt_unique123"
  }'
```

**Reason Types:**

| Reason | Description |
|--------|-------------|
| `impression_charge` | CPM charge |
| `click_charge` | CPC charge |
| `conversion_charge` | CPA charge |
| `visit_charge` | CPV charge (footfall) |
| `scan_charge` | CPS charge (QR scans) |

**Response:**

```json
{
  "success": true,
  "data": {
    "transactionId": "txn_jkl012",
    "amount": 100.00,
    "remainingReserved": 9900.00,
    "remainingAvailable": 40000.00
  }
}
```

**Idempotency:** The `eventId` field is used for deduplication. Duplicate requests with the same `eventId` will return the original response without making changes.

### POST /wallet/release - Release Reservation

Release unused reserved funds back to available balance.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/wallet/release \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_xyz789",
    "reservationId": "res_ghi789"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "releasedAmount": 4500.00,
    "newAvailableBalance": 44500.00,
    "transactionId": "txn_mno345"
  }
}
```

### GET /wallet/transactions - List Transactions

Retrieve a paginated list of wallet transactions.

**Request:**

```bash
curl -X GET "https://api.rez.money/v1/wallet/transactions?merchantId=merchant_xyz789&page=1&limit=20&type=deduction" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| merchantId | string | Merchant ID (required) |
| page | integer | Page number (default: 1) |
| limit | integer | Items per page (default: 20) |
| type | string | Filter by transaction type |
| startDate | string | Start date filter (ISO 8601) |
| endDate | string | End date filter (ISO 8601) |

**Transaction Types:**

| Type | Description |
|------|-------------|
| `deposit` | Funds added to wallet |
| `withdrawal` | Funds withdrawn from wallet |
| `reservation` | Funds reserved for campaign |
| `deduction` | Funds deducted for charges |
| `release` | Unused reservation released |
| `refund` | Refund to wallet |

**Response:**

```json
{
  "data": [
    {
      "id": "txn_mno345",
      "type": "release",
      "amount": 4500.00,
      "balance": 44500.00,
      "description": "Unused reservation released",
      "campaignId": "camp_abc123",
      "reference": "res_ghi789",
      "timestamp": "2026-05-13T10:30:00Z"
    },
    {
      "id": "txn_jkl012",
      "type": "deduction",
      "amount": 100.00,
      "balance": 40000.00,
      "description": "Impression charges",
      "campaignId": "camp_abc123",
      "reference": "evt_unique123",
      "timestamp": "2026-05-13T10:00:00Z"
    },
    {
      "id": "txn_ghi789",
      "type": "reservation",
      "amount": 10000.00,
      "balance": 40100.00,
      "description": "Funds reserved for campaign",
      "campaignId": "camp_abc123",
      "timestamp": "2026-05-13T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

## Wallet Flow Examples

### Example 1: Complete Campaign Lifecycle

```javascript
async function runCampaign(merchantId, campaignId, budget) {
  // Step 1: Check balance
  const balance = await api.get(`/wallet/balance?merchantId=${merchantId}`);

  if (balance.available < budget) {
    throw new Error('Insufficient balance');
  }

  // Step 2: Reserve funds
  const reservation = await api.post('/wallet/reserve', {
    merchantId,
    amount: budget,
    campaignId,
    purpose: 'ad_campaign'
  });

  console.log(`Reserved: ${reservation.amount}`);

  // Step 3: Track spend (simulated)
  let spent = 0;
  const maxIterations = 100;

  while (spent < budget && maxIterations > 0) {
    const charge = Math.random() * 50; // Simulated charge
    spent += charge;

    await api.post('/wallet/deduct', {
      merchantId,
      amount: charge,
      campaignId,
      reason: 'impression_charge',
      eventId: `evt_${Date.now()}_${Math.random()}`
    });

    // Check every 10%
    if (Math.floor(spent / budget * 100) % 10 === 0) {
      console.log(`Spent: ${spent.toFixed(2)} / ${budget}`);
    }
  }

  // Step 4: Release unused
  const released = budget - spent;
  if (released > 0) {
    await api.post('/wallet/release', {
      merchantId,
      reservationId: reservation.reservationId
    });
    console.log(`Released unused: ${released.toFixed(2)}`);
  }

  return { spent, released };
}
```

### Example 2: Deposit with Multiple Payment Methods

```javascript
async function depositFunds(merchantId, amount, method, reference) {
  const paymentMethods = {
    upi: {
      endpoint: '/wallet/deposit',
      data: { paymentMethod: 'upi' }
    },
    card: {
      endpoint: '/wallet/deposit',
      data: { paymentMethod: 'card' }
    },
    netbanking: {
      endpoint: '/wallet/deposit',
      data: { paymentMethod: 'netbanking' }
    }
  };

  const config = paymentMethods[method];

  const result = await api.post(config.endpoint, {
    merchantId,
    amount,
    ...config.data,
    reference
  });

  console.log(`Deposited ${amount} via ${method}`);
  console.log(`New balance: ${result.newBalance}`);

  return result;
}

// Usage
await depositFunds('merchant_xyz789', 50000, 'upi', 'order_abc123');
```

### Example 3: Real-time Balance Monitoring

```javascript
class WalletMonitor {
  constructor(merchantId) {
    this.merchantId = merchantId;
    this.lastBalance = null;
  }

  async checkBalance() {
    const balance = await api.get(`/wallet/balance?merchantId=${this.merchantId}`);

    if (this.lastBalance !== null) {
      const change = balance.available - this.lastBalance;

      if (change < -100) {
        this.onSignificantDeduction(change);
      }
    }

    this.lastBalance = balance.available;
    return balance;
  }

  onSignificantDeduction(amount) {
    console.warn(`Significant deduction detected: ${amount}`);
    // Send alert, notify dashboard, etc.
  }
}

// Usage
const monitor = new WalletMonitor('merchant_xyz789');

// Check every minute
setInterval(() => monitor.checkBalance(), 60000);
```

### Example 4: Transaction History Export

```javascript
async function exportTransactions(merchantId, startDate, endDate) {
  const transactions = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await api.get('/wallet/transactions', {
      params: {
        merchantId,
        startDate,
        endDate,
        page,
        limit: 100
      }
    });

    transactions.push(...response.data);

    if (response.data.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }

  // Convert to CSV
  const csv = [
    ['ID', 'Type', 'Amount', 'Balance', 'Campaign', 'Timestamp'].join(','),
    ...transactions.map(t => [
      t.id,
      t.type,
      t.amount,
      t.balance,
      t.campaignId || '',
      t.timestamp
    ].join(','))
  ].join('\n');

  return csv;
}

// Usage
const csv = await exportTransactions(
  'merchant_xyz789',
  '2026-05-01',
  '2026-05-13'
);

// Save to file
require('fs').writeFileSync('transactions.csv', csv);
```

### Example 5: Auto-Recharge Setup

```javascript
class AutoRecharge {
  constructor(merchantId, threshold, amount) {
    this.merchantId = merchantId;
    this.threshold = threshold;
    this.amount = amount;
  }

  async checkAndRecharge() {
    const balance = await api.get(`/wallet/balance?merchantId=${this.merchantId}`);

    if (balance.available < this.threshold) {
      console.log(`Balance below threshold (${balance.available} < ${this.threshold})`);

      const result = await api.post('/wallet/deposit', {
        merchantId: this.merchantId,
        amount: this.amount,
        paymentMethod: 'upi',
        reference: `autorecharge_${Date.now()}`
      });

      console.log(`Auto-recharged ${this.amount}. New balance: ${result.newBalance}`);
      return result;
    }

    return null;
  }
}

// Usage
const autoRecharge = new AutoRecharge(
  'merchant_xyz789',
  threshold: 5000,  // Recharge when below 5000
  amount: 10000     // Add 10000 each time
);

// Check every 5 minutes
setInterval(() => autoRecharge.checkAndRecharge(), 5 * 60 * 1000);
```

## Error Codes

| Code | Description |
|------|-------------|
| `WALLET_NOT_FOUND` | Merchant wallet does not exist |
| `INSUFFICIENT_BALANCE` | Not enough available funds |
| `INSUFFICIENT_RESERVED` | Not enough reserved funds |
| `INVALID_AMOUNT` | Amount must be positive |
| `INVALID_RESERVATION` | Reservation does not exist |
| `ALREADY_RELEASED` | Reservation already released |
| `DUPLICATE_EVENT` | Event ID already processed |

## Best Practices

### 1. Always Check Balance Before Campaigns

```javascript
async function ensureBalance(merchantId, requiredAmount) {
  const { available } = await api.get(`/wallet/balance?merchantId=${merchantId}`);

  if (available < requiredAmount) {
    const shortfall = requiredAmount - available;
    throw new Error(`Insufficient balance. Need ${shortfall} more.`);
  }

  return true;
}
```

### 2. Use Event IDs for Idempotency

```javascript
function generateEventId(prefix, data) {
  // Create deterministic event ID based on campaign and unique occurrence
  const hash = crypto
    .createHash('sha256')
    .update(`${prefix}_${data.campaignId}_${data.timestamp}_${data.sequence}`)
    .digest('hex')
    .substring(0, 16);

  return `evt_${hash}`;
}

// Usage
await api.post('/wallet/deduct', {
  merchantId,
  amount: charge,
  campaignId,
  reason: 'impression_charge',
  eventId: generateEventId('imp', {
    campaignId,
    timestamp: Date.now(),
    sequence: counter++
  })
});
```

### 3. Handle Concurrent Deductions

```javascript
async function safeDeduct(merchantId, amount, campaignId, reason) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    return await api.post('/wallet/deduct', {
      merchantId,
      amount,
      campaignId,
      reason,
      eventId
    });
  } catch (error) {
    if (error.code === 'INSUFFICIENT_RESERVED') {
      // Campaign budget exhausted
      await api.post(`/campaigns/${campaignId}/pause`);
      return null;
    }
    throw error;
  }
}
```

### 4. Monitor Wallet Health

```javascript
async function getWalletHealth(merchantId) {
  const balance = await api.get(`/wallet/balance?merchantId=${merchantId}`);
  const transactions = await api.get('/wallet/transactions', {
    params: { merchantId, limit: 1 }
  });

  const lastTransaction = transactions.data[0];

  return {
    health: {
      available: balance.available,
      reserved: balance.reserved,
      utilization: balance.reserved / balance.balance,
      lastActivity: lastTransaction?.timestamp,
      age: lastTransaction
        ? Date.now() - new Date(lastTransaction.timestamp).getTime()
        : null
    },
    alerts: []
  };
}
```

## Minimum Balance Requirements

| Campaign Type | Minimum Balance |
|--------------|-----------------|
| In-App Ads | 500 |
| DOOH | 3,000 |
| Broadcast | 1,000 |
| QR Campaign | 500 |
| Influencer | 5,000 |
| Offline | 5,000 |
