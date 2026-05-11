# REZ ABANDONMENT TRACKER SERVICE

**Version:** 2.0
**Date:** May 6, 2026
**GitHub:** [imrejaul007/rez-abandonment-tracker](https://github.com/imrejaul007/rez-abandonment-tracker)

---

## WHAT IT DOES

```
Track → Recover → Convert
```

### Features

| Feature | Description |
|---------|-------------|
| Search Abandonment | Track users who search but don't convert |
| Cart Abandonment | Track abandoned carts |
| View Abandonment | Track products viewed but not purchased |
| Decay Scoring | Urgency decreases over time |
| Re-engagement | Trigger messages via best channel |

---

## APIS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/abandonment/search` | POST | Track search abandonment |
| `/api/abandonment/cart` | POST | Track cart abandonment |
| `/api/abandonment/view` | POST | Track view abandonment |
| `/api/abandonment/urgent` | GET | Get urgent abandonments |
| `/api/abandonment/reengage` | POST | Trigger re-engagement |
| `/api/abandonment/stats` | GET | Get abandonment stats |

---

## DECAY MODEL

```
Urgency decreases over time:
- Critical: 8 points/hour
- High: 12 points/hour
- Medium: 15 points/hour
- Low: 20 points/hour
```

### Re-engagement Timing

| Abandonment Type | Trigger After |
|-----------------|---------------|
| Payment | 1 hour |
| Search | 2 hours |
| Cart | 4 hours |
| View | 24 hours |

---

## INTEGRATIONS

| Service | Purpose |
|---------|---------|
| Lead Intelligence | Get lead score, channel preference |
| Unified Messaging | Send re-engagement messages |
| ReZ Mind | Learn from conversions |

---

## DEPLOYMENT

### Render

```
1. Connect GitHub repo
2. Add env vars
3. Deploy
```

### Environment Variables

```bash
PORT=4108
MONGODB_URI=mongodb://...
REDIS_URL=redis://...
LEAD_INTELLIGENCE_URL=http://localhost:4106
MARKETING_URL=http://localhost:4001
REZMIND_URL=http://localhost:4010
```

---

## STATUS

| Component | Status |
|-----------|--------|
| Search Tracking | ✅ Built |
| Cart Tracking | ✅ Built |
| View Tracking | ✅ Built |
| Decay Engine | ✅ Built |
| Re-engagement | ✅ Built |
| Deployment Ready | ✅ Ready |

---

**Built for scale, designed for growth.**
