# REZ LEAD INTELLIGENCE SERVICE

**Version:** 2.0
**Date:** May 6, 2026
**GitHub:** [imrejaul007/rez-lead-intelligence](https://github.com/imrejaul007/rez-lead-intelligence)

---

## WHAT IT DOES

```
Lead Intelligence → Marketing → Re-engagement
```

### Features

| Feature | Description |
|---------|-------------|
| Hot Lead Detection | Score ≥ 75 → WhatsApp immediate |
| Warm Lead Detection | Score 40-74 → Push notification |
| Cold Lead Detection | Score < 40 → Email/SMS |
| Abandoned Search | Track & recover lost searches |
| Abandoned Cart | Track & recover abandoned carts |
| Marketing Integration | Sync leads to campaigns |

---

## APIS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/leads/:userId/score` | GET | Get lead score |
| `/api/leads/hot` | GET | Get hot leads |
| `/api/leads/warm` | GET | Get warm leads |
| `/api/leads/cold` | GET | Get cold leads |
| `/api/abandonment/cart` | POST | Track abandoned cart |
| `/api/abandonment/search` | POST | Track abandoned search |
| `/api/reengagement/trigger` | POST | Trigger re-engagement |
| `/api/offers/personalized` | GET | Get personalized offers |

---

## LEAD SCORING

```
Score = recentSearches(20%) + abandonedCarts(25%) + views(15%) + activity(25%) + intent(15%)
```

### Temperature Thresholds

| Temperature | Score | Action | Channel |
|-------------|-------|--------|---------|
| Hot | ≥ 75 | Immediate | WhatsApp |
| Warm | 40-74 | Nurture | Push |
| Cold | < 40 | Discovery | Email/SMS |

---

## INTEGRATIONS

| Service | Purpose |
|---------|---------|
| ReZ Mind | User signals, intent detection |
| Marketing Service | Campaign creation |
| Unified Messaging | Channel routing |

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
PORT=4106
MONGODB_URI=mongodb://...
REDIS_URL=redis://...
REZMIND_URL=http://localhost:4010
MARKETING_URL=http://localhost:4001
```

---

## STATUS

| Component | Status |
|-----------|--------|
| Lead Scoring | ✅ Built |
| Hot/Warm/Cold Detection | ✅ Built |
| Abandoned Tracking | ✅ Built |
| Marketing Integration | ✅ Built |
| Deployment Ready | ✅ Ready |

---

**Built for scale, designed for growth.**
