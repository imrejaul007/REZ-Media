# AdsQR Service

**Version:** 2.0
**QR code advertising service with coin rewards**

---

## Features (v2.0)

| Feature | Description |
|---------|-------------|
| QR Generation | Generate unique QR codes for campaigns |
| Scan Tracking | Track QR code scans and conversions |
| Coin Rewards | Award branded coins on scan |
| Campaign Management | Create and manage QR campaigns |
| Attribution | Track user journey from scan to conversion |
| ML Optimization | AI-powered campaign optimization |
| Fraud Detection | ML-based click fraud prevention |
| Analytics Dashboard | Comprehensive metrics and insights |
| Support Integration | REZ-Care ticket management |
| RABTUL Integration | Wallet, Intelligence, Mind |

---

## Architecture

```
AdsQR Ecosystem
├── QR Generation
├── Campaign Management
├── Scan Tracking
├── Coin Rewards
├── ML Optimization
├── Fraud Detection
├── Analytics Dashboard
└── RABTUL Integration
```

---

## API Reference

### Campaigns
```bash
GET  /api/campaigns              # List campaigns
POST /api/campaigns              # Create campaign
GET  /api/campaigns/:id         # Get campaign
POST /api/qr/generate           # Generate QR
POST /api/qr/scan                # Record scan
```

### Analytics
```bash
GET /api/analytics/dashboard    # Analytics dashboard
GET /api/campaigns/optimize/:id # ML optimization
GET /api/fraud/analytics        # Fraud analytics
```

### Fraud Detection
```bash
POST /api/fraud/check           # Check for fraud
GET  /api/fraud/analytics       # Fraud stats
```

### Support
```bash
POST /api/support/ticket              # Create ticket
GET  /api/support/campaign-health/:id # Health check
```

---

## Deployment

### Docker
```bash
docker build -t adsqr-service .
docker run -p 3008:3008 adsqr-service
```

### Kubernetes
```bash
kubectl apply -f k8s/deployment.yaml
```

---

## Environment Variables

```bash
PORT=3008
MONGODB_URI=mongodb://localhost:27017/adsqr
REDIS_URL=redis://localhost:6379

# RABTUL Services
MIND_API=https://REZ-mind.onrender.com
INTELLIGENCE_API=https://rez-intelligence.onrender.com
WALLET_API=https://rez-wallet-service.onrender.com
CARE_API=https://REZ-care.onrender.com
```

---

## Testing

```bash
npm test
```

---

## Documentation

- API Spec: `docs/openapi.yaml`
- Integration: Uses centralized RABTUL integration
