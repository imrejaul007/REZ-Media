# Deal Manager Service

**Port:** 4062

Private Marketplaces (PMP), Preferred Deals, and Programmatic Guaranteed.

## Deals

| Type | Description |
|------|-------------|
| PMP | Invitation-only auctions |
| Preferred | First-look inventory access |
| Guaranteed | Fixed impressions/volume |

## API

- `GET /api/deals` - List deals
- `POST /api/deals` - Create deal
- `GET /api/deals/:id` - Get deal
- `POST /api/deals/:id/activate` - Activate
- `POST /api/deals/:id/pause` - Pause
- `POST /api/deals/:id/check` - Check eligibility
