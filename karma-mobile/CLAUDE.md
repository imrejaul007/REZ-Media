# CLAUDE.md

---

## Service Discovery

This service is registered in REZ-Master/services.json.

To discover related services:
```bash
# From REZ-Master directory
node rez-cli find <service-name>  # Find specific service
node rez-cli list --category <category>  # List by category
node rez-cli stats  # Platform statistics
```

Quick search:
- `node rez-cli list --search payment` - Find payment services
- `node rez-cli list --search auth` - Find auth services
- `node rez-cli list --search kds` - Find KDS services
- `node rez-cli list --search ai` - Find AI services

---



Karma mobile app - standalone Expo app for the Karma gamification feature.

---

## Project Overview

**Version**: 1.0.0 | **Last Updated**: May 2026

### Tech Stack
- Expo (React Native)
- TypeScript
- React Navigation

---

## Build & Run

```bash
npm install              # Install dependencies
npx expo prebuild       # Generate native projects
npx expo run:android    # Run on Android
npx expo run:ios        # Run on iOS
npx expo start          # Start Expo DevTools
```

---

## Project Structure

```
rez-karma-mobile/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Redirect to karma
│   ├── login.tsx          # Authentication
│   └── karma/             # Karma routes
│       ├── home.tsx
│       ├── my-karma.tsx
│       ├── explore.tsx
│       ├── event/[id].tsx
│       ├── missions.tsx
│       ├── micro-actions.tsx
│       ├── leaderboard.tsx
│       ├── wallet.tsx
│       ├── scan.tsx
│       ├── communities.tsx
│       └── communities/[slug].tsx
├── src/
│   ├── components/        # Reusable components
│   ├── services/          # API clients
│   └── utils/             # Helpers
├── app.json
└── package.json
```

---

## Screens

### Consumer
| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/login` | Authentication |
| Home | `/karma/home` | Main hub |
| My Karma | `/karma/my-karma` | Passport & history |
| Explore | `/karma/explore` | Event listing |
| Event Detail | `/karma/event/[id]` | Event info |
| Missions | `/karma/missions` | Available missions |
| Micro Actions | `/karma/micro-actions` | Quick actions |
| Leaderboard | `/karma/leaderboard` | Rankings |
| Wallet | `/karma/wallet` | Balance |
| QR Scan | `/karma/scan` | Scanner |
| Communities | `/karma/communities` | List |
| Community | `/karma/communities/[slug]` | Detail |

### Admin
| Screen | Route | Description |
|--------|-------|-------------|
| Dashboard | `/admin` | Admin hub |
| Karma Score | `/admin/karma-score` | Score admin |
| Perks | `/admin/perks` | Perk management |

---

## Environment Variables

```env
API_URL=https://rez-karma-service.onrender.com
AUTH_URL=https://rez-auth-service.onrender.com
```

---

## Brand Colors

| Name | Hex | Use |
|------|-----|-----|
| Primary | `#22C55E` | Impact/Growth |
| Secondary | `#FACC15` | Reward/Value |
| Trust | `#3B82F6` | Trust |

---

## Related Services

| Service | Purpose |
|---------|---------|
| rez-karma-service | Backend API |
| rez-auth-service | Authentication |
| rez-wallet-service | Balance |

---

## Security Rules

- NEVER commit `.env` files
- Store tokens securely (expo-secure-store)
- Validate API responses
- Sanitize user inputs
