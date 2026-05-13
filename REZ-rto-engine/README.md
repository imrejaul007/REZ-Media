# REZ RTO Engine

COD (Cash on Delivery) fraud prevention and RTO (Return To Origin) risk engine for the ReZ commerce platform.

## Overview

The RTO Engine analyzes orders in real-time to determine the risk level and make COD decisions. It combines device fingerprinting, address validation, behavioral analysis, and ML-based scoring to prevent fraud and reduce return rates.

## Features

- **Device Fingerprinting**: Identifies devices, detects proxies/VPNs, and tracks device trust history
- **Address Validation**: Validates shipping addresses, detects suspicious patterns, and checks deliverability
- **Behavioral Analysis**: Analyzes user order history, return patterns, and COD behavior
- **Risk Scoring**: ML-based composite risk score (0-100) with tier classification
- **COD Decision Engine**: Automated decisions - APPROVED, BLOCKED, PARTIAL_ADVANCE, REVIEW

## Risk Tiers

| Tier | Score Range | Action |
|------|-------------|--------|
| LOW | 0-30 | Approve COD |
| MEDIUM | 31-60 | Require partial advance |
| HIGH | 61-100 | Block COD |

## Risk Factors

The risk engine considers the following factors:

- **New Device**: First time ordering from this device
- **New Address**: First time shipping to this address
- **First COD Order**: User switching from prepaid to COD
- **High Value Order**: Order significantly above average
- **Unusual Location**: Order from unexpected country/city
- **Device Fingerprint Mismatch**: Device fingerprint doesn't match history
- **Address Quality Score**: Low quality or incomplete address
- **Return Rate**: High historical return rate
- **COD Return Rate**: High return rate on COD orders
- **Proxy/VPN Detection**: Traffic from known proxy/VPN
- **Rapid Ordering**: Multiple orders in short time frame

## API Endpoints

### Health & Status

```
GET /health           - Health check
GET /ready            - Readiness check
```

### Risk Scoring

```
POST /api/v1/score    - Get risk score for an order
GET  /api/v1/score/:orderId - Get existing risk score
```

### Verification

```
POST /api/v1/verify   - Verify order with additional checks
GET  /api/v1/verify/:orderId - Get verification status
```

### COD Decision

```
POST /api/v1/decision - Get COD decision for an order
GET  /api/v1/decision/:orderId - Get existing decision
POST /api/v1/decision/:orderId/override - Override decision (admin)
```

## Usage

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## API Request/Response Examples

### Get Risk Score

```bash
curl -X POST http://localhost:3008/api/v1/score \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "orderId": "ORD-123456",
    "userId": "USR-789",
    "orderValue": 2500,
    "codAmount": 2500,
    "itemCount": 2,
    "itemCategories": ["electronics", "accessories"],
    "shippingAddress": {
      "street": "123 Main Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India",
      "landmark": "Near Metro Station"
    },
    "fingerprintData": {
      "screenResolution": "1920x1080",
      "timezone": "Asia/Kolkata",
      "language": "en-IN",
      "platform": "Win32",
      "canvasHash": "abc123...",
      "webglHash": "def456..."
    }
  }'
```

### Response

```json
{
  "success": true,
  "data": {
    "orderId": "ORD-123456",
    "userId": "USR-789",
    "riskScore": 35,
    "riskTier": "MEDIUM",
    "factors": [
      {
        "name": "device_trust",
        "weight": 0.25,
        "score": 85,
        "description": "Device trust score: 85/100"
      },
      {
        "name": "address_quality",
        "weight": 0.25,
        "score": 90,
        "description": "Address quality score: 90/100"
      },
      {
        "name": "behavior_pattern",
        "weight": 0.3,
        "score": 75,
        "description": "Established customer (> 20 orders); Normal return rate: 5%"
      },
      {
        "name": "order_characteristics",
        "weight": 0.2,
        "score": 95,
        "description": "Normal order characteristics"
      }
    ],
    "signals": [
      {
        "type": "FIRST_COD_ORDER",
        "severity": "LOW",
        "description": "User switching from prepaid to COD",
        "value": true
      }
    ],
    "deviceScore": 85,
    "addressScore": 90,
    "behaviorScore": 75,
    "orderScore": 95,
    "recommendations": [
      "Allow COD with partial advance",
      "Set partial advance percentage based on risk score",
      "Enhanced monitoring enabled"
    ],
    "analyzedAt": "2026-05-13T12:00:00.000Z"
  }
}
```

### Get COD Decision

```bash
curl -X POST http://localhost:3008/api/v1/decision \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "orderId": "ORD-123456",
    "userId": "USR-789",
    "orderValue": 2500,
    "codAmount": 2500
  }'
```

### Response

```json
{
  "success": true,
  "data": {
    "orderId": "ORD-123456",
    "userId": "USR-789",
    "decision": "PARTIAL_ADVANCE",
    "riskScore": 35,
    "riskTier": "MEDIUM",
    "partialAdvanceAmount": 500,
    "partialAdvancePercentage": 20,
    "reason": "Medium risk order (score: 35). Partial advance of 20% required.",
    "conditions": [
      "Collect ₹500 (20%) as advance",
      "Remaining ₹2000 on delivery",
      "Verify address and contact before shipping",
      "Enable tracking alerts"
    ],
    "expiresAt": "2026-05-13T12:30:00.000Z"
  }
}
```

## Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez_rto_engine

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Internal Service Authentication
INTERNAL_SERVICE_TOKENS_JSON={"checkout-service":"token1","payment-service":"token2"}

# Server
PORT=3008
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Risk Thresholds (optional, defaults provided)
RISK_THRESHOLD_LOW=30
RISK_THRESHOLD_MEDIUM=60
RISK_THRESHOLD_HIGH=100

# Device Fingerprint
FINGERPRINT_SECRET=your-secret-key

# Address Validation
GOOGLE_MAPS_API_KEY=your-google-api-key
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        REZ RTO Engine                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Score API  │  │ Verify API  │  │  Decision API        │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘   │
│         │                │                     │               │
│         └────────────────┼─────────────────────┘               │
│                          │                                      │
│                   ┌──────▼──────┐                               │
│                   │ Risk Scoring│                               │
│                   │   Service   │                               │
│                   └──────┬──────┘                               │
│                          │                                      │
│    ┌─────────────────────┼─────────────────────┐                 │
│    │                     │                     │                 │
│    ▼                     ▼                     ▼                 │
│ ┌──────────┐      ┌──────────────┐      ┌────────────────┐     │
│ │  Device  │      │   Address    │      │   Behavior     │     │
│ │Fingerprint│      │  Validation  │      │   Analysis     │     │
│ │ Service  │      │   Service    │      │    Service     │     │
│ └────┬─────┘      └──────┬───────┘      └───────┬────────┘     │
│      │                    │                      │               │
│      └────────────────────┼──────────────────────┘               │
│                           ▼                                      │
│                    ┌─────────────┐                               │
│                    │ COD Decision│                               │
│                    │  Service    │                               │
│                    └──────┬──────┘                               │
│                           │                                      │
│                           ▼                                      │
│                    ┌─────────────┐                               │
│                    │  MongoDB    │                               │
│                    │ RiskProfile │                               │
│                    │ OrderRisk   │                               │
│                    │   Device    │                               │
│                    └─────────────┘                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Models

### RiskProfile

Tracks user-level risk metrics and fraud signals.

```typescript
{
  userId: string;
  overallRiskScore: number;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  totalOrders: number;
  codOrders: number;
  codReturnRate: number;
  fraudSignals: FraudSignal[];
  trustedDevices: string[];
  trustedAddresses: string[];
}
```

### OrderRisk

Stores risk analysis for individual orders.

```typescript
{
  orderId: string;
  userId: string;
  riskScore: number;
  riskTier: string;
  codDecision: 'APPROVED' | 'BLOCKED' | 'PARTIAL_ADVANCE' | 'REVIEW';
  fraudSignals: FraudSignal[];
  verificationChecks: VerificationCheck[];
}
```

### Device

Tracks device fingerprints and trust history.

```typescript
{
  fingerprintId: string;
  userId: string;
  fingerprintHash: string;
  trustScore: number;
  isTrusted: boolean;
  totalOrders: number;
  codReturnRate: number;
  isProxy: boolean;
}
```

## Testing

```bash
npm test
```

## License

Proprietary - ReZ Commerce Platform
