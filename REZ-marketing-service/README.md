# REZ Marketing Service

Marketing automation microservice for campaigns, analytics, and customer engagement.

## Features

- Campaign management
- Email marketing automation
- Customer segmentation
- Analytics and reporting
- Push notifications

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| MONGODB_URI | MongoDB connection string | Yes |
| REDIS_URL | Redis connection string | Yes |
| SMTP_HOST | Email SMTP host | Yes |
| SMTP_PORT | Email SMTP port | Yes |
| PORT | Service port (default: 4026) | No |

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Start production server
npm test         # Run tests
```

## API Endpoints

- `GET /api/v1/campaigns` - List campaigns
- `POST /api/v1/campaigns` - Create campaign
- `GET /api/v1/segments` - List customer segments
- `POST /api/v1/segments` - Create segment

## License

MIT
