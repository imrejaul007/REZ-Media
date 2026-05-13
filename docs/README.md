# ReZ Commerce Media Platform API Documentation

Welcome to the ReZ Commerce Media Platform API documentation. This platform provides a comprehensive solution for managing advertising campaigns, dynamic pricing, wallet transactions, and analytics across multiple channels.

## Table of Contents

- [Getting Started](getting-started.md) - Quick start guide for new developers
- [Authentication](authentication.md) - Authentication and authorization
- [Pricing API](pricing-api.md) - Dynamic pricing engine documentation
- [Campaigns API](campaigns-api.md) - Campaign management endpoints
- [Wallet API](wallet-api.md) - Merchant wallet operations
- [Webhooks](webhooks.md) - Real-time event notifications
- [Examples](examples/) - Request and response examples

## Overview

The ReZ Commerce Media Platform enables merchants to:

- **Create multi-channel campaigns** across In-App, DOOH, QR, Broadcast, and Offline advertising
- **Access AI-powered dynamic pricing** that considers demand, competition, and real-time factors
- **Manage campaign budgets** through an integrated wallet system
- **Track performance** with real-time analytics and metrics
- **Receive webhooks** for real-time event notifications

## Base URLs

| Environment | Base URL |
|------------|----------|
| Production | `https://api.rez.money/v1` |
| Staging | `https://api-staging.rez.money/v1` |
| Local | `http://localhost:4007` |

## API Versioning

The API uses URL versioning. The current version is `v1`. All endpoints are prefixed with `/v1`.

```
https://api.rez.money/v1/campaigns
```

## Response Format

All API responses follow a consistent JSON format:

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

## Rate Limits

| Plan | Requests per Minute | Requests per Day |
|------|---------------------|------------------|
| Basic | 60 | 10,000 |
| Standard | 300 | 100,000 |
| Premium | 1,000 | 1,000,000 |
| Enterprise | Custom | Custom |

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1622500000
```

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 402 | Payment Required - Insufficient balance |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 422 | Unprocessable Entity - Validation error |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Ad Types

The platform supports the following ad types:

| Type | Description | Pricing Unit |
|------|-------------|--------------|
| `banner` | Home banner ads | CPM/CPC |
| `feed` | Explore feed ads | CPM/CPC |
| `search` | Search result ads | CPC |
| `store` | Product page ads | CPM/CPC |
| `push` | Push notifications | Per user |
| `whatsapp` | WhatsApp messages | Per message |
| `email` | Email campaigns | Per email |
| `dooh` | Digital out-of-home | Daily rate |
| `offline` | Static offline ads | Weekly |
| `qr` | QR code scans | CPS |

## Campaign Statuses

| Status | Description |
|--------|-------------|
| `draft` | Campaign created but not activated |
| `active` | Campaign is running |
| `paused` | Campaign temporarily stopped |
| `completed` | Campaign ended naturally |
| `cancelled` | Campaign manually cancelled |

## SDKs and Libraries

Official SDKs are available for:

- [JavaScript/TypeScript](https://github.com/rez-money/rez-js)
- [Python](https://github.com/rez-money/rez-python)
- [Go](https://github.com/rez-money/rez-go)

## Support

- **Documentation**: https://developers.rez.money
- **API Status**: https://status.rez.money
- **Email Support**: api-support@rez.money
- **Community Forum**: https://community.rez.money

## Changelog

### Version 1.0.0 (Current)
- Initial API release
- Core endpoints: Authentication, Pricing, Campaigns, Wallet, Webhooks
- Support for 10 ad types
- Dynamic pricing engine with AI multipliers
- Integrated wallet system

---

Last updated: May 2026
