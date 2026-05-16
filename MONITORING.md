# REZ-Media Monitoring Guide

**Last Updated:** 2026-05-16

---

## Services Monitored

| Service | Port | Status Endpoint |
|---------|------|----------------|
| rez-dooh-service | 4018 | /health |
| REZ-ad-ai | 4021 | /health |
| REZ-pricing-engine | 4015 | /health |
| REZ-engagement-platform | 4017 | /health |
| REZ-journey-service | 4019 | /health |

---

## Key Metrics

### Ad Performance

| Metric | Target | Alert |
|--------|--------|-------|
| Fill Rate | > 95% | < 90% |
| CTR | > 2% | < 1% |
| Viewability | > 70% | < 60% |
| Latency | < 100ms | > 500ms |

### Campaign Metrics

| Metric | Target |
|--------|--------|
| Impressions | Configurable |
| Conversions | Configurable |
| Revenue | Configurable |

---

## Alerts

### Sentry Integration

```bash
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Health Checks

```bash
curl https://rez-dooh-service.onrender.com/health
```

---

## Dashboards

### Grafana

Import dashboard for:
- Node.js services
- MongoDB metrics
- Redis cache

---

## Incident Response

1. Check service health endpoints
2. Review Sentry errors
3. Check Render logs
4. Scale if needed
