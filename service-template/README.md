# [SERVICE NAME]

Brief description of the service.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | Yes | Service port |
| MONGODB_URI | Yes | MongoDB connection string |
| REDIS_URL | Yes | Redis connection string |
| INTERNAL_SERVICE_TOKEN | Yes | Service authentication token |
| CORS_ORIGIN | No | Comma-separated CORS origins |
| SENTRY_DSN | No | Sentry error tracking |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /ready | Readiness check |
| GET | /api/... | API routes |

## Authentication

All API routes (except /health and /ready) require the `X-Internal-Token` header.

```bash
curl -H "X-Internal-Token: your-token" http://localhost:3000/api/example
```

## Architecture

```
src/
├── index.ts          # Entry point
├── config/           # Configuration
├── middleware/        # Express middleware
│   ├── auth.ts       # Authentication
│   ├── rateLimit.ts  # Rate limiting
│   ├── errorHandler.ts # Error handling
│   └── requestLogger.ts # Request logging
├── routes/           # API routes
├── services/         # Business logic
├── models/           # Mongoose models
└── types/            # TypeScript types
```

## Best Practices

- Use `@rez/shared` for common utilities
- Add Zod validation for all request bodies
- Use Redis for caching and state management
- Implement proper error handling
- Add health checks for containers
- Use graceful shutdown handlers
