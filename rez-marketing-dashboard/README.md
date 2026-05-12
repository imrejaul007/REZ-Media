# REZ Marketing Dashboard

> Unified marketing dashboard for merchants - one place for all marketing tasks

## Features

- **Campaigns** - Create and manage ad campaigns
- **Broadcasts** - WhatsApp, SMS, Email, Push campaigns
- **Audiences** - Segment builder and AI suggestions
- **Automation** - Abandonment, Win-back, Drip sequences
- **Analytics** - Real-time performance metrics

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Radix UI
- Recharts

## Getting Started

```bash
npm install
npm run dev
```

## API Integration

Connects to:
- `REZ-ads-service` - Ad campaigns
- `REZ-marketing` - Broadcasts, segments
- `REZ-communications-platform` - WhatsApp, SMS, Email, Push
- `REZ-intelligence` - AI segments

## Environment

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_ADS_SERVICE_URL=http://localhost:4007
NEXT_PUBLIC_COMMUNICATIONS_URL=http://localhost:3009
```
