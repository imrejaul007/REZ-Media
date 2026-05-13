# REZ Admin Dashboard

A comprehensive admin panel for the REZ-Media advertising platform built with Next.js 14.

## Features

- **Dashboard Overview**: Platform metrics, key performance indicators, recent activity
- **Merchant Management**: Approve/reject/suspend merchants, view merchant details
- **Campaign Management**: Monitor campaigns, pause/resume active campaigns
- **Revenue Analytics**: Track revenue trends, merchant earnings, campaign performance
- **Audit Logs**: Complete activity tracking for compliance and security

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Utilities**: date-fns, clsx

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Configuration

Edit `.env.local` with your environment settings:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
ADMIN_API_BASE_URL=http://localhost:4000
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx           # Dashboard overview
│   ├── merchants/page.tsx  # Merchant management
│   ├── campaigns/page.tsx # Campaign management
│   ├── revenue/page.tsx   # Revenue analytics
│   ├── audit/page.tsx     # Audit logs
│   └── layout.tsx         # App layout with sidebar
├── components/
│   ├── Sidebar.tsx        # Admin navigation
│   ├── StatsCard.tsx      # Stats display card
│   ├── Table.tsx          # Reusable table components
│   ├── StatusBadge.tsx    # Status indicator badges
│   ├── Button.tsx         # Button component
│   └── Input.tsx         # Input component
└── lib/
    └── api.ts             # API client functions
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## API Endpoints

The dashboard expects the following admin API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/dashboard/stats` | GET | Platform statistics |
| `/admin/merchants` | GET | List merchants |
| `/admin/merchants/:id/approve` | PUT | Approve merchant |
| `/admin/merchants/:id/reject` | PUT | Reject merchant |
| `/admin/campaigns` | GET | List campaigns |
| `/admin/campaigns/:id/pause` | PUT | Pause campaign |
| `/admin/campaigns/:id/resume` | PUT | Resume campaign |
| `/admin/revenue/stats` | GET | Revenue data |
| `/admin/audit` | GET | Audit logs |

## Development Notes

- The dashboard includes mock data for demonstration when API is unavailable
- All API calls include error handling with fallback to mock data
- Components are fully typed with TypeScript
- Responsive design with Tailwind CSS

## License

Private - REZ-Media Platform
