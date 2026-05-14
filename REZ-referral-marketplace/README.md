# REZ Referral Marketplace

Next.js application for referral program management with creator discovery, campaign management, and analytics.

## Features

- **Dashboard**: Overview of referral performance with charts and recent activity
- **Creator Marketplace**: Discover and connect with top-performing creators
- **Campaign Management**: Create and manage referral campaigns
- **Analytics**: Detailed performance tracking and payout management
- **Payout System**: Process and track creator payments

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Recharts (for analytics charts)
- Lucide React (icons)
- date-fns (date formatting)

## Project Structure

```
src/
├── app/
│   ├── page.tsx           # Dashboard
│   ├── creators/page.tsx  # Creator marketplace
│   ├── campaigns/page.tsx # Campaign management
│   ├── analytics/page.tsx # Analytics & payouts
│   ├── layout.tsx         # App layout
│   └── globals.css       # Global styles
├── components/
│   ├── CreatorCard.tsx   # Creator card component
│   └── CampaignCard.tsx  # Campaign card component
└── lib/
    └── api.ts            # API types and mock data
```

## Environment Variables

```env
# Optional: Connect to real backend
API_URL=https://api.example.com

# Authentication (when using backend)
INTERNAL_SERVICE_TOKEN=your-token
```

## License

Private - REZ Media
