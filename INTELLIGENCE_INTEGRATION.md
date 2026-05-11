# REZ-Media to REZ-Intelligence Integration

This document describes how REZ-Media services connect to REZ-Intelligence components.

## Architecture Overview

```
REZ-Media Services                    REZ-Intelligence Hub
┌─────────────────────┐             ┌─────────────────────┐
│ REZ-ads-service      │────────────▶│ REZ-intent-graph    │
│ REZ-decision-service  │────────────▶│ REZ-event-platform  │
│ REZ-gamification     │────────────▶│ REZ-insights        │
└─────────────────────┘             └─────────────────────┘
         │                                    │
         │         BullMQ Queues               │
         ▼                                    ▼
┌─────────────────────┐             ┌─────────────────────┐
│   Shared Redis      │◀───────────│  Shared Redis      │
│   (for queues)      │             │  (for workers)     │
└─────────────────────┘             └─────────────────────┘
```

## Service Connections

### REZ-ads-service → REZ-Intelligence

| Target Service | URL Env Var | Purpose | Auth Header |
|---------------|-------------|---------|-------------|
| REZ-intent-graph | `INTENT_CAPTURE_URL` | Track user intent events | `x-internal-token` |
| REZ-event-platform | `EVENT_PLATFORM_URL` | Forward ad analytics events | `x-internal-token` |
| REZ-insights | `INSIGHTS_SERVICE_URL` | ML-powered targeting insights | `x-internal-token` |

### REZ-decision-service → REZ-Intelligence

| Target Service | URL Env Var | Purpose | Auth Header |
|---------------|-------------|---------|-------------|
| REZ-intelligence-hub | `INTELLIGENCE_HUB_URL` | Fetch ML targeting models | `x-internal-token` |
| REZ-intent-graph | `INTENT_CAPTURE_URL` | User segment evaluation | `x-internal-token` |

### REZ-gamification-service → REZ-Intelligence

| Target Service | URL Env Var | Purpose | Auth Header |
|---------------|-------------|---------|-------------|
| REZ-intent-graph | `INTENT_CAPTURE_URL` | Track gamification events | `x-internal-token` |
| REZ-event-platform | `EVENT_PLATFORM_URL` | Achievement unlock events | `x-internal-token` |

## BullMQ Queue Integration

All services share BullMQ queues for async processing:

| Queue Name | Producer | Consumer | Purpose |
|------------|----------|----------|---------|
| `notification-events` | ads-service, gamification | notification-service | Push notifications |
| `re-engagement` | ads-service | engagement-worker | Re-targeting campaigns |
| `media-events` | catalog-service | media-worker | Image processing |
| `intent-events` | all services | intent-processor | Intent capture |

## Required Environment Variables

All REZ-Media services must set:

```bash
# Authentication (MUST match across all services)
INTERNAL_SERVICE_TOKEN=your-shared-secret-token

# REZ-Intelligence Endpoints
INTENT_CAPTURE_URL=https://rez-intent-graph.onrender.com
EVENT_PLATFORM_URL=https://rez-event-platform.onrender.com
INTELLIGENCE_HUB_URL=https://rez-intelligence-hub.onrender.com

# Redis (shared across services for BullMQ)
REDIS_URL=redis://localhost:6379
```

## Token Sharing

All services in the ReZ ecosystem use the same `INTERNAL_SERVICE_TOKEN` for inter-service communication. This token is:

1. Set in each service's `.env` file
2. Passed via `x-internal-token` header
3. Verified using constant-time comparison (`crypto.timingSafeEqual`)

## Security

All internal service calls use:
- **Authentication**: `x-internal-token` header with shared secret
- **TLS**: HTTPS for all external calls
- **Validation**: Input sanitization before API calls
- **Rate Limiting**: Redis-based rate limits on all endpoints

## Health Checks

Each service exposes:
- `/health` - Basic liveness check
- `/health/detailed` - Detailed status with dependency checks
- `/metrics` - Prometheus metrics

## Troubleshooting

### "401 Unauthorized" from Intelligence Services

1. Check that `INTERNAL_SERVICE_TOKEN` matches across all services
2. Verify the token is passed in `x-internal-token` header
3. Check service logs for authentication failures

### "503 Service Unavailable" from Intelligence Services

1. Verify the target service is running
2. Check network connectivity between services
3. Verify `INTENT_CAPTURE_URL`, `EVENT_PLATFORM_URL` are correct

### Events Not Appearing in Analytics

1. Check that `EVENT_PLATFORM_URL` is configured
2. Verify `EVENT_PLATFORM_ENABLED=true`
3. Check BullMQ queue health
4. Verify Redis connection is stable

## Deployment

In production, ensure:
1. All services use the same `INTERNAL_SERVICE_TOKEN`
2. Services are in the same VPC or have private networking
3. Redis is accessible from all services
4. MongoDB connections use proper credentials
5. Sentry DSN is configured for error tracking
