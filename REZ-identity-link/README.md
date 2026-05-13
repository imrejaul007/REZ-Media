# REZ Identity Link

Cross-app identity resolution and linking service.

## What It Does

Links user accounts across all REZ apps:
- Hotel OTA
- Food delivery
- Retail stores
- Wasil
- Do App

## Features

- Link accounts by phone
- Link accounts by device fingerprint
- Resolve identity from any identifier
- Merge duplicate profiles
- Confidence scoring

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/identity` | GET | Get identity by phone/email/device |
| `/api/identity/link` | POST | Link new account |
| `/api/identity/unlink` | POST | Unlink account |
| `/api/identity/potential-matches` | GET | Find duplicate identities |

## Link Methods

| Method | Confidence |
|--------|------------|
| Phone | 100% |
| Email | 90% |
| WhatsApp | 95% |
| Device | 70-80% |

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment

```
PORT=4017
MONGODB_URI=mongodb://localhost:27017/rez_identity
```
