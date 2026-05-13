# Webhooks Documentation

Webhooks allow your application to receive real-time notifications when events occur in the ReZ platform.

## Overview

Instead of polling the API for updates, webhooks push notifications to your server when important events happen. This enables:

- **Real-time updates**: Receive notifications within seconds of events
- **Reduced API calls**: No need to continuously poll endpoints
- **Automated workflows**: Trigger actions based on campaign events
- **Event audit trail**: Complete history of campaign changes

## Supported Events

### Campaign Events

| Event | Description |
|-------|-------------|
| `campaign.created` | New campaign created |
| `campaign.status_changed` | Campaign status changed |
| `campaign.paused` | Campaign was paused |
| `campaign.resumed` | Campaign was resumed |
| `campaign.cancelled` | Campaign was cancelled |
| `campaign.completed` | Campaign ended naturally |

### Wallet Events

| Event | Description |
|-------|-------------|
| `wallet.reserved` | Funds reserved for campaign |
| `wallet.deducted` | Funds deducted from wallet |
| `wallet.released` | Unused funds released |
| `wallet.deposited` | Funds added to wallet |

### Payment Events

| Event | Description |
|-------|-------------|
| `payment.initiated` | Payment process started |
| `payment.completed` | Payment successful |
| `payment.failed` | Payment failed |

### Conversion Events

| Event | Description |
|-------|-------------|
| `conversion.created` | New conversion recorded |
| `conversion.attributed` | Conversion attributed to campaign |

## Endpoints

### GET /webhooks - List Webhooks

Retrieve all configured webhooks.

**Request:**

```bash
curl -X GET https://api.rez.money/v1/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "data": [
    {
      "id": "wh_abc123",
      "url": "https://merchant.example.com/webhooks/rez",
      "events": [
        "campaign.status_changed",
        "campaign.completed",
        "wallet.transaction"
      ],
      "active": true,
      "createdAt": "2026-04-15T10:00:00Z",
      "lastDeliveryAt": "2026-05-13T09:45:00Z",
      "successRate": 98.5
    }
  ]
}
```

### POST /webhooks - Register Webhook

Register a new webhook endpoint.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://merchant.example.com/webhooks/rez",
    "events": [
      "campaign.status_changed",
      "campaign.paused",
      "campaign.resumed",
      "campaign.cancelled",
      "campaign.completed"
    ],
    "secret": "whsec_your_secret_here",
    "active": true
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "wh_def456",
    "url": "https://merchant.example.com/webhooks/rez",
    "events": [
      "campaign.status_changed",
      "campaign.paused",
      "campaign.resumed",
      "campaign.cancelled",
      "campaign.completed"
    ],
    "active": true,
    "createdAt": "2026-05-13T10:30:00Z",
    "lastDeliveryAt": null,
    "successRate": null
  }
}
```

### GET /webhooks/{id} - Get Webhook

Retrieve details of a specific webhook.

**Request:**

```bash
curl -X GET https://api.rez.money/v1/webhooks/wh_def456 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### PATCH /webhooks/{id} - Update Webhook

Update webhook configuration.

**Request:**

```bash
curl -X PATCH https://api.rez.money/v1/webhooks/wh_def456 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      "campaign.created",
      "campaign.status_changed",
      "campaign.completed"
    ],
    "active": true
  }'
```

### DELETE /webhooks/{id} - Delete Webhook

Delete a webhook registration.

**Request:**

```bash
curl -X DELETE https://api.rez.money/v1/webhooks/wh_def456 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:** `204 No Content`

## Webhook Payload Structure

All webhook events follow a consistent structure:

```json
{
  "id": "evt_abc123",
  "event": "campaign.status_changed",
  "timestamp": "2026-05-13T10:30:00Z",
  "merchantId": "merchant_xyz789",
  "campaignId": "camp_abc123",
  "data": {
    "campaign": {
      "id": "camp_abc123",
      "name": "Summer Sale 2026",
      "status": "completed",
      "previousStatus": "active",
      "spent": 25000.00,
      "budget": 25000.00
    },
    "changes": {
      "status": {
        "from": "active",
        "to": "completed"
      }
    }
  }
}
```

## Event Payloads

### campaign.created

```json
{
  "id": "evt_001",
  "event": "campaign.created",
  "timestamp": "2026-05-13T10:30:00Z",
  "merchantId": "merchant_xyz789",
  "campaignId": "camp_new123",
  "data": {
    "campaign": {
      "id": "camp_new123",
      "name": "New Campaign",
      "adType": "whatsapp",
      "budget": 10000.00,
      "status": "draft"
    }
  }
}
```

### campaign.status_changed

```json
{
  "id": "evt_002",
  "event": "campaign.status_changed",
  "timestamp": "2026-05-13T11:00:00Z",
  "merchantId": "merchant_xyz789",
  "campaignId": "camp_abc123",
  "data": {
    "campaign": {
      "id": "camp_abc123",
      "name": "Summer Sale 2026",
      "status": "paused",
      "previousStatus": "active"
    },
    "changes": {
      "status": {
        "from": "active",
        "to": "paused"
      }
    }
  }
}
```

### wallet.deducted

```json
{
  "id": "evt_003",
  "event": "wallet.deducted",
  "timestamp": "2026-05-13T12:00:00Z",
  "merchantId": "merchant_xyz789",
  "campaignId": "camp_abc123",
  "data": {
    "transaction": {
      "id": "txn_xyz789",
      "amount": 50.00,
      "reason": "impression_charge"
    },
    "wallet": {
      "reserved": 9950.00,
      "available": 40000.00
    }
  }
}
```

### payment.completed

```json
{
  "id": "evt_004",
  "event": "payment.completed",
  "timestamp": "2026-05-13T13:00:00Z",
  "merchantId": "merchant_xyz789",
  "data": {
    "payment": {
      "id": "pay_abc456",
      "amount": 50000.00,
      "method": "upi",
      "reference": "order_xyz123"
    },
    "wallet": {
      "balance": 90000.00,
      "available": 40000.00
    }
  }
}
```

## Signature Verification

All webhook requests include a signature header for verification:

```
X-ReZ-Signature: sha256=abc123...
X-ReZ-Timestamp: 1622500000
```

### Verification Steps

1. Extract timestamp from `X-ReZ-Timestamp`
2. Create payload string: `${timestamp}.${rawBody}`
3. Compute HMAC-SHA256 with your webhook secret
4. Compare with `X-ReZ-Signature`

### Example Verification (Node.js)

```javascript
import crypto from 'crypto';

function verifyWebhookSignature(rawBody, timestamp, signature, secret) {
  // Check timestamp is within 5 minutes
  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (timestampAge > 300) {
    return false; // Replay attack
  }

  // Compute expected signature
  const payload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expectedSignature)
  );
}

// Express middleware
app.post('/webhooks/rez', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-rez-signature'];
  const timestamp = req.headers['x-rez-timestamp'];

  if (!verifyWebhookSignature(req.body, timestamp, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);
  handleWebhookEvent(event);

  res.status(200).json({ received: true });
});
```

### Example Verification (Python)

```python
import hmac
import hashlib
import time
from flask import request, jsonify

WEBHOOK_SECRET = 'your_webhook_secret'

def verify_signature(raw_body, timestamp, signature):
    # Check timestamp
    if time.time() - int(timestamp) > 300:
        return False

    # Compute expected signature
    payload = f"{timestamp}.{raw_body}"
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature.replace('sha256=', ''), expected)

@app.route('/webhooks/rez', methods=['POST'])
def webhook():
    raw_body = request.get_data()
    signature = request.headers.get('X-ReZ-Signature', '')
    timestamp = request.headers.get('X-ReZ-Timestamp', '')

    if not verify_signature(raw_body, timestamp, signature, WEBHOOK_SECRET):
        return jsonify({'error': 'Invalid signature'}), 401

    event = request.get_json()
    handle_webhook_event(event)

    return jsonify({'received': True})
```

## Handling Webhooks

### Basic Event Handler

```javascript
async function handleWebhookEvent(event) {
  console.log(`Received event: ${event.event}`);

  switch (event.event) {
    case 'campaign.created':
      await handleCampaignCreated(event);
      break;

    case 'campaign.status_changed':
      await handleStatusChanged(event);
      break;

    case 'campaign.paused':
      await handleCampaignPaused(event);
      break;

    case 'campaign.resumed':
      await handleCampaignResumed(event);
      break;

    case 'campaign.cancelled':
      await handleCampaignCancelled(event);
      break;

    case 'campaign.completed':
      await handleCampaignCompleted(event);
      break;

    case 'wallet.deducted':
      await handleWalletDeducted(event);
      break;

    case 'payment.completed':
      await handlePaymentCompleted(event);
      break;

    default:
      console.log(`Unhandled event type: ${event.event}`);
  }
}
```

### Campaign Completion Handler

```javascript
async function handleCampaignCompleted(event) {
  const { campaign } = event.data;

  console.log(`Campaign ${campaign.id} completed`);

  // Generate performance report
  const stats = await api.get(`/campaigns/${campaign.id}/stats`);

  // Send notification
  await sendEmail({
    to: 'merchant@example.com',
    subject: `Campaign "${campaign.name}" Completed`,
    template: 'campaign-completed',
    data: {
      campaignName: campaign.name,
      budget: campaign.budget,
      spent: campaign.spent,
      impressions: stats.summary.impressions,
      clicks: stats.summary.clicks,
      conversions: stats.summary.conversions,
      ctr: stats.summary.ctr,
      cpa: stats.summary.cpa
    }
  });

  // Trigger follow-up campaign suggestion
  if (campaign.spent > 10000 && stats.summary.cpa < 50) {
    await suggestSimilarCampaign(campaign);
  }
}
```

### Wallet Alert Handler

```javascript
async function handleWalletDeducted(event) {
  const { transaction, wallet } = event.data;
  const { merchantId } = event;

  // Check if reserved balance is low
  const reservedRatio = wallet.reserved / (wallet.reserved + wallet.available);

  if (reservedRatio > 0.9) {
    // More than 90% is reserved
    await sendAlert({
      type: 'WALLET_RESERVED_HIGH',
      merchantId,
      message: `Wallet balance: ${wallet.reserved} reserved (${Math.round(reservedRatio * 100)}%)`
    });
  }

  // Log transaction for audit
  await logTransaction({
    merchantId,
    transactionId: transaction.id,
    amount: transaction.amount,
    type: 'deduction',
    eventId: event.id
  });
}
```

## Retry Policy

Failed webhook deliveries are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 8 hours |

After 6 failed attempts, the webhook is marked as failed and no further retries occur.

### Responding to Webhooks

Your endpoint must respond within **10 seconds**. Return a `2xx` status code to acknowledge receipt:

```javascript
// Fast acknowledgment
app.post('/webhooks/rez', (req, res) => {
  // Respond immediately
  res.status(200).json({ received: true });

  // Process asynchronously
  processWebhook(req.body).catch(console.error);
});
```

## Best Practices

### 1. Respond Quickly, Process Asynchronously

```javascript
app.post('/webhooks/rez', async (req, res) => {
  // Acknowledge immediately
  res.status(200).json({ received: true });

  // Queue for processing
  await webhookQueue.add('process', req.body);
});
```

### 2. Handle Duplicates

```javascript
const processedEvents = new Set();

async function processWebhook(event) {
  if (processedEvents.has(event.id)) {
    console.log(`Duplicate event: ${event.id}`);
    return;
  }

  processedEvents.add(event.id);

  try {
    await handleWebhookEvent(event);
  } catch (error) {
    console.error(`Failed to process event ${event.id}:`, error);
    // Event will be retried
    throw error;
  }
}

// Clean up old entries periodically
setInterval(() => {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id] of processedEvents) {
    if (parseTimestamp(id) < oneDayAgo) {
      processedEvents.delete(id);
    }
  }
}, 60 * 60 * 1000);
```

### 3. Use a Queue for Reliability

```javascript
import Bull from 'bull';

const webhookQueue = new Bull('webhooks', {
  redis: { host: 'localhost', port: 6379 }
});

webhookQueue.process(async (job) => {
  const event = job.data;
  await handleWebhookEvent(event);
});

// Retry failed jobs
webhookQueue.on('failed', (job, err) => {
  console.error(`Webhook job ${job.id} failed:`, err);
});

// Add to queue
app.post('/webhooks/rez', (req, res) => {
  res.status(200).json({ received: true });
  webhookQueue.add('process', req.body, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 60000
    }
  });
});
```

### 4. Monitor Webhook Health

```javascript
async function monitorWebhooks() {
  const webhooks = await api.get('/webhooks');

  for (const webhook of webhooks.data) {
    if (!webhook.active) {
      console.warn(`Webhook ${webhook.id} is inactive`);
      continue;
    }

    if (webhook.successRate < 90) {
      console.warn(`Webhook ${webhook.id} success rate: ${webhook.successRate}%`);
    }

    const lastDelivery = webhook.lastDeliveryAt;
    if (lastDelivery) {
      const hoursSince = (Date.now() - new Date(lastDelivery).getTime()) / 36e5;
      if (hoursSince > 24) {
        console.warn(`Webhook ${webhook.id} no deliveries in ${hoursSince.toFixed(1)} hours`);
      }
    }
  }
}
```

## Error Handling

| Error Code | Description |
|------------|-------------|
| `WEBHOOK_NOT_FOUND` | Webhook ID does not exist |
| `INVALID_URL` | URL must be HTTPS |
| `INVALID_EVENTS` | One or more event types are invalid |
| `DUPLICATE_WEBHOOK` | URL already registered for this merchant |
| `SIGNATURE_VERIFICATION_FAILED` | Webhook signature invalid |

## Testing Webhooks

### Local Testing with ngrok

```bash
# Install ngrok
brew install ngrok

# Start ngrok tunnel
ngrok http 3000

# Use the provided URL in your webhook registration
# https://abc123.ngrok.io/webhooks/rez
```

### Using ReZ CLI

```bash
# Test webhook delivery
rez-cli webhooks test wh_def456

# View recent deliveries
rez-cli webhooks deliveries wh_def456 --limit 10
```
