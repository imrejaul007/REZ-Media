# REZ Attribution Dashboard

A comprehensive marketing attribution and ROI analytics dashboard built with Next.js 14, Tailwind CSS, and Recharts.

## Features

- **Real-time Attribution Reports**: Track conversions across multiple attribution models
- **Funnel Visualization**: Visualize conversion funnels with drop-off analysis
- **ROI Dashboard**: Monitor channel performance and return on investment
- **Campaign Comparison**: Compare campaign performance side-by-side
- **Export Reports**: Generate and export detailed reports in multiple formats

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Environment

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Project Structure

```
REZ-attribution-dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Dashboard overview
│   │   ├── campaigns/
│   │   │   └── page.tsx       # Campaign attribution page
│   │   ├── reports/
│   │   │   └── page.tsx       # Detailed reports page
│   │   ├── layout.tsx         # Root layout with sidebar
│   │   └── globals.css        # Global styles
│   └── components/
│       ├── FunnelChart.tsx    # Conversion funnel visualization
│       ├── AttributionBreakdown.tsx  # Attribution model breakdown
│       ├── ROICard.tsx        # Channel ROI metrics
│       └── CampaignTable.tsx   # Sortable campaign table
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Dashboard Metrics

The dashboard tracks the following key metrics:

| Metric | Description |
|--------|-------------|
| Total Touchpoints | Number of marketing interactions |
| Total Conversions | Completed conversions |
| Conversion Rate | Percentage of conversions from touchpoints |
| First Touch | Attribution to first interaction |
| Last Touch | Attribution to last interaction |
| Linear | Equal attribution across all touchpoints |
| Time Decay | Attribution weighted by recency |

## Attribution Models

The dashboard supports multiple attribution models:

1. **First Touch**: 100% credit to the first touchpoint
2. **Last Touch**: 100% credit to the last touchpoint
3. **Linear**: Equal credit across all touchpoints
4. **Time Decay**: Higher credit to recent touchpoints

## Components

### FunnelChart
Visualizes the conversion funnel with stage-by-stage analysis and drop-off rates.

### AttributionBreakdown
Pie chart showing conversion distribution across different attribution models.

### ROICard
Comprehensive ROI metrics with channel-by-channel breakdown and comparison.

### CampaignTable
Sortable, filterable table with campaign performance metrics and actions.

## Customization

### Adding New Metrics

Extend the `AttributionDashboard` interface in any component to add new metrics:

```typescript
interface CustomMetric {
  label: string;
  value: number;
  change: number;
  changeType: 'positive' | 'negative';
}
```

### Styling

Tailwind classes are used throughout for styling. Custom colors can be added to `tailwind.config.js`.

## License

Proprietary - REZ-Media
