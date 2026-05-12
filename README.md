# REZ-Media

## Company Description

REZ-Media is a comprehensive digital marketing platform specializing in **Ads** and **Loyalty** solutions. We empower businesses to reach their target audiences through innovative advertising technology while building lasting customer relationships through gamified loyalty programs and intelligent marketing automation.

## Services

Our platform offers a complete suite of marketing and advertising solutions:

### Advertising Solutions

| Service | Description |
|---------|-------------|
| **adBazaar** | Multi-channel ad marketplace connecting brands with premium inventory |
| **adsqr** | QR code-based advertising with seamless offline-to-online tracking |
| **dooh** | Digital Out-of-Home advertising for dynamic screen networks |
| **dooh-screen-app** | DOOH screen management and content display |
| **dooh-mobile** | DOOH mobile companion app for screen owners |
| **rez-dooh-service** | DOOH backend service for scheduling and bidding |
| **creators** | Influencer and creator partnership management platform |

### Loyalty & Gamification

| Service | Description |
|---------|-------------|
| **Gamification** | Engagement-driven loyalty mechanics with points, badges, and challenges |

### Marketing Automation

| Service | Description |
|---------|-------------|
| **Marketing** | AI-powered campaign management and audience segmentation |
| **Automation** | Workflow-based marketing automation for cross-channel campaigns |
| **Abandonment Tracker** | Cart and engagement abandonment detection and recovery |
| **Decision Service** | Real-time personalization and recommendation engine |
| **Economic Engine** | Dynamic pricing and promotional optimization |

### Intelligence & Analytics

| Service | Description |
|---------|-------------|
| **Feedback** | Real-time customer feedback collection and sentiment analysis |
| **Journey** | Customer journey mapping and touchpoint optimization |
| **Lead Intelligence** | Predictive lead scoring and qualification system |
| **Media Events** | Event-driven analytics and cross-channel attribution |

---

## Deployment

### Prerequisites

- Node.js 18+
- Docker (optional, for containerized deployment)
- Database: PostgreSQL 14+ / MongoDB 6+

### Local Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Run development server
npm run dev

# Run tests
npm test
```

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
npm start

# Or use Docker
docker build -t rez-media .
docker run -p 3000:3000 rez-media
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL/MongoDB connection string | Yes |
| `API_KEY` | Authentication key for API access | Yes |
| `REDIS_URL` | Redis connection for caching | No |
| `LOG_LEVEL` | Logging verbosity (info, warn, error) | No |

### Container Orchestration

For Kubernetes deployment, use the provided Helm chart:

```bash
helm install rez-media ./charts/rez-media -f values.prod.yaml
```

---

## License

Proprietary - REZ-Media Inc.
