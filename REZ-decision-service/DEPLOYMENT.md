# rez-decision-service Deployment Guide

## Overview

The rez-decision-service is a unified targeting and action engine with Phase 3-5 analytics capabilities including:
- Sampling Decision Engine
- Attribution Tracking
- Dynamic Pricing
- Auto-Campaign Engine
- Smart Coin Allocation
- Auto Coin Distribution
- Merchant Coin Analytics
- DOOH Analytics

## Prerequisites

- Node.js 20+
- Docker 24+
- Docker Compose 2.20+
- Redis 7+

## Local Development

### Quick Start

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f decision-service

# Check health
curl http://localhost:4027/health
```

### Development with Hot Reload

```bash
# Install dependencies
npm install

# Start with hot reload
npm run dev

# Or with debugger
npm run dev:debug
```

### Using Docker Compose Profiles

```bash
# Basic development
docker-compose up -d

# With Redis Commander (debug UI)
docker-compose --profile debug up -d

# With Prometheus + Grafana (monitoring)
docker-compose --profile monitoring up -d

# All tools
docker-compose --profile debug --profile monitoring up -d
```

## Environment Variables

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `4027` | Service port |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |

### Phase 3-5 Engine Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `SAMPLING_ENGINE_ENABLED` | `true` | Enable sampling decision engine |
| `ATTRIBUTION_ENGINE_ENABLED` | `true` | Enable attribution tracking |
| `DYNAMIC_PRICING_ENABLED` | `true` | Enable dynamic pricing engine |
| `AUTO_CAMPAIGN_ENABLED` | `true` | Enable auto-campaign engine |
| `SMART_COIN_ALLOCATION_ENABLED` | `true` | Enable smart coin allocation |
| `AUTO_COIN_DISTRIBUTION_ENABLED` | `true` | Enable auto coin distribution |
| `MERCHANT_COIN_ANALYTICS_ENABLED` | `true` | Enable merchant analytics |
| `DOOH_ANALYTICS_ENABLED` | `true` | Enable DOOH analytics |

### Performance Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_MAX_CONNECTIONS` | `50` | Max Redis connections |
| `REQUEST_TIMEOUT_MS` | `30000` | Request timeout in ms |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |
| `CIRCUIT_BREAKER_ENABLED` | `true` | Enable circuit breaker |
| `CIRCUIT_BREAKER_TIMEOUT_MS` | `5000` | Circuit breaker timeout |

### CORS Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |

## API Endpoints

### Health Check

```bash
GET /health
```

### Targeting Engine (Phase 1-2)

```bash
# Evaluate user segments
GET /api/targeting/segments/:userId

# Evaluate with campaign
POST /api/targeting/evaluate

# Check frequency cap
GET /api/frequency/:userId/:campaignId/:channel

# Record impression
POST /api/frequency/record
```

### Sampling Engine (Phase 3)

```bash
# Main sampling decision
POST /api/sampling/decide

# Fatigue check
GET /api/sampling/fatigue/:userId

# Record scan
POST /api/sampling/record-scan

# Record redemption
POST /api/sampling/record-redeem

# Leaderboard
GET /api/sampling/leaderboard

# Dynamic pricing
GET /api/sampling/pricing/:merchantId
POST /api/sampling/pricing/calculate
GET /api/sampling/pricing/surge/:merchantId
```

### Auto-Campaign Engine (Phase 3)

```bash
# Detect signals
POST /api/sampling/auto-campaign/detect

# Generate campaigns
POST /api/sampling/auto-campaign/generate

# Process signals (auto-launch)
POST /api/sampling/auto-campaign/process

# Get merchant campaigns
GET /api/sampling/auto-campaign/campaigns/:merchantId

# Update campaign status
PATCH /api/sampling/auto-campaign/campaigns/:campaignId/status

# Get signal history
GET /api/sampling/auto-campaign/signals/history

# Campaign performance
GET /api/sampling/auto-campaign/performance/:campaignId
POST /api/sampling/auto-campaign/performance/:campaignId/record
GET /api/sampling/auto-campaign/performance/top
```

### Smart Coin Allocation (Phase 3)

```bash
# Allocate coins
POST /api/sampling/coins/allocate

# Get breakdown
POST /api/sampling/coins/breakdown

# User stats
GET /api/sampling/coins/user/:userId/stats

# Budget status
GET /api/sampling/coins/budget/:campaignId/status

# Pause campaign
POST /api/sampling/coins/budget/:campaignId/pause

# Validate allocation
POST /api/sampling/coins/validate
```

### Auto Coin Distribution (Phase 4)

```bash
# Main distribution
POST /api/sampling/auto-distribute

# Preview distribution
POST /api/sampling/auto-distribute/preview

# Quick distribute
POST /api/sampling/auto-distribute/quick

# Trigger breakdown
POST /api/sampling/auto-distribute/triggers

# User history
GET /api/sampling/auto-distribute/history/:userId

# Trigger analytics
GET /api/sampling/auto-distribute/analytics/triggers

# Rules management
POST /api/sampling/auto-distribute/rules
GET /api/sampling/auto-distribute/rules
PATCH /api/sampling/auto-distribute/rules/:ruleId
DELETE /api/sampling/auto-distribute/rules/:ruleId
```

### Attribution Engine (Phase 3)

```bash
# Track event
POST /api/attribution/track

# Get summary
GET /api/attribution/summary/:userId

# Calculate attribution
POST /api/attribution/attribute

# Record conversion
POST /api/attribution/conversion

# Campaign stats
GET /api/attribution/campaign/:campaignId

# Quick event tracking
POST /api/attribution/event/:eventType
```

### Sampling Analytics (Phase 3)

```bash
# Campaign analytics
GET /api/sampling/analytics/campaign/:id

# User analytics
GET /api/sampling/analytics/user/:id

# Merchant analytics
GET /api/sampling/analytics/merchant/:id

# System analytics
GET /api/sampling/analytics/system

# Funnel analytics
GET /api/sampling/analytics/funnel/:campaignId

# Leaderboard
GET /api/sampling/analytics/leaderboard

# Active users
GET /api/sampling/analytics/active-users

# Cohort analysis
GET /api/sampling/analytics/cohorts

# Fatigue distribution
GET /api/sampling/analytics/fatigue-distribution
```

### Merchant Coin Analytics (Phase 4)

```bash
# Coin analytics
GET /api/merchant/:merchantId/coins/analytics

# Customer insights
GET /api/merchant/:merchantId/coins/customers

# Campaign analytics
GET /api/merchant/:merchantId/coins/campaigns

# Trend analysis
GET /api/merchant/:merchantId/coins/trends

# Leaderboard
GET /api/merchant/:merchantId/coins/leaderboard
```

### DOOH Analytics (Phase 5)

```bash
# Screen overview
GET /api/dooh/analytics/screens

# Individual screen
GET /api/dooh/analytics/screens/:id

# Campaign analytics
GET /api/dooh/analytics/campaigns

# Network analytics
GET /api/dooh/analytics/network
```

## Deployment

### Render Cloud

1. Connect your repository to Render
2. Create a new Web Service
3. Select the `render.yaml` configuration
4. Add environment variables or connect to Render Redis

```bash
# Manual deploy (if not using render.yaml)
npm run deploy:render
```

### Docker

```bash
# Build image
docker build -t rez-decision-service .

# Run container
docker run -p 4027:4027 \
  --env-file .env.production \
  rez-decision-service

# Run with docker-compose
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# Build and push image
docker build -t your-registry/rez-decision-service:latest .
docker push your-registry/rez-decision-service:latest

# Apply manifests
kubectl apply -f k8s/
```

## Monitoring

### Prometheus Metrics

Enable the monitoring profile:

```bash
docker-compose --profile monitoring up -d
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

### Redis Commander

```bash
docker-compose --profile debug up -d
```

Access: http://localhost:8081

### Health Checks

```bash
# Service health
curl http://localhost:4027/health | jq

# Redis health
docker exec rez-redis redis-cli ping

# Container status
docker-compose ps
```

## Troubleshooting

### Common Issues

1. **Redis connection failed**
   ```bash
   # Check Redis is running
   docker-compose ps redis

   # Check logs
   docker-compose logs redis
   ```

2. **Port already in use**
   ```bash
   # Find and kill process
   lsof -i :4027
   kill -9 <PID>
   ```

3. **Build failures**
   ```bash
   # Clean build
   docker-compose build --no-cache
   ```

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f decision-service

# Last 100 lines
docker-compose logs --tail 100 decision-service
```

## Scaling

### Horizontal Scaling (Docker Compose)

```bash
docker-compose up -d --scale decision-service=3
```

### Load Balancing

The service can be scaled behind a load balancer. Ensure:
- Sticky sessions disabled for stateless requests
- Redis configured for connection pooling
- Health checks configured on load balancer

## Security

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGINS` (specific domains only)
- [ ] Enable `CIRCUIT_BREAKER_ENABLED`
- [ ] Configure rate limiting
- [ ] Use Redis AUTH if possible
- [ ] Enable TLS for Redis
- [ ] Review and limit exposed endpoints

## API Examples

### Sample Request: Sampling Decision

```bash
curl -X POST http://localhost:4027/api/sampling/decide \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "campaignId": "camp-456",
    "merchantId": "merch-789",
    "location": { "lat": 40.7128, "lng": -74.0060 }
  }'
```

### Sample Request: Attribution Conversion

```bash
curl -X POST http://localhost:4027/api/attribution/conversion \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "campaignId": "camp-456",
    "merchantId": "merch-789",
    "conversionType": "purchase",
    "value": 25.99,
    "model": "last-touch"
  }'
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f decision-service`
2. Verify Redis: `docker exec rez-redis redis-cli ping`
3. Check health: `curl http://localhost:4027/health`
