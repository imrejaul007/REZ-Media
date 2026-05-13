# Authentication Guide

This guide covers authentication and authorization for the ReZ Commerce Media Platform API.

## Authentication Overview

The ReZ API uses **JWT (JSON Web Tokens)** for authentication. All requests to protected endpoints must include a valid Bearer token.

### Authentication Flow

```
1. Client sends credentials to /auth/login
2. Server validates and returns access + refresh tokens
3. Client includes access token in Authorization header
4. When access token expires, client uses /auth/refresh
5. Process repeats
```

## Token Types

| Token Type | Expiry | Purpose |
|-----------|--------|---------|
| Access Token | 1 hour (3600s) | API authentication |
| Refresh Token | 30 days | Obtain new access tokens |

## Endpoints

### POST /auth/login

Authenticate with email and password to obtain tokens.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@example.com",
    "password": "yourpassword123"
  }'
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "merchant": {
    "id": "merchant_abc123",
    "name": "Example Restaurant",
    "email": "merchant@example.com",
    "businessType": "restaurant",
    "tier": "standard"
  }
}
```

**Error Responses:**

```json
// 401 - Invalid credentials
{
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid email or password"
}

// 429 - Too many attempts
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many login attempts. Please try again in 15 minutes."
}
```

### POST /auth/refresh

Exchange a valid refresh token for a new access token.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_REFRESH_TOKEN" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### POST /auth/verify

Verify if a token is valid and get token metadata.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/auth/verify \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**

```json
{
  "valid": true,
  "merchantId": "merchant_abc123",
  "expiresAt": "2026-05-13T11:30:00Z",
  "issuedAt": "2026-05-13T10:30:00Z",
  "scopes": ["campaigns:read", "campaigns:write", "wallet:read", "wallet:write"]
}
```

## Using Tokens

### Authorization Header

Include the access token in all API requests:

```bash
curl -X GET https://api.rez.money/v1/campaigns \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Token Expiry Handling

When a token expires, you will receive a 401 response:

```json
{
  "code": "TOKEN_EXPIRED",
  "message": "Access token has expired"
}
```

Your application should:

1. Detect the 401 response
2. Use the refresh token to get a new access token
3. Retry the original request with the new token

### Example: Token Refresh Flow

```javascript
async function apiRequest(endpoint, options = {}) {
  let token = getStoredAccessToken();

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // If unauthorized, try to refresh
  if (response.status === 401) {
    const data = await response.json();

    if (data.code === 'TOKEN_EXPIRED') {
      const tokens = await refreshAccessToken();

      if (tokens) {
        // Update stored token
        storeTokens(tokens);

        // Retry with new token
        return fetch(endpoint, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      }
    }

    throw new Error('Authentication failed');
  }

  return response;
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await fetch('https://api.rez.money/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    clearStoredTokens();
    return null;
  }

  return response.json();
}
```

## Token Storage

### Security Best Practices

1. **Never expose tokens in URLs** - Tokens in query parameters may be logged
2. **Store tokens securely**:
   - Web: Use `httpOnly` cookies or secure storage
   - Mobile: Use secure storage (Keychain/Keystore)
   - Server: Use encrypted environment variables
3. **Implement token rotation** - Always use refresh tokens, don't persist access tokens
4. **Clear tokens on logout** - Remove all tokens when user logs out

### Recommended Storage Patterns

**Browser (React/Vue/Angular):**

```javascript
// Use httpOnly cookie (recommended)
// Server sets: Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict

// Or use memory + secure storage fallback
const tokenCache = {
  accessToken: null,
  refreshToken: null
};

function setTokens(tokens) {
  tokenCache.accessToken = tokens.accessToken;
  tokenCache.refreshToken = tokens.refreshToken;

  // Persist refresh token only
  localStorage.setItem('refreshToken', tokens.refreshToken);
}
```

**Node.js Server:**

```javascript
// Store tokens in memory or Redis
const tokenStore = new Map();

// Use encrypted cookies for browser clients
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  }
}));
```

**Mobile (iOS/Android):**

```swift
// iOS - Use Keychain
let query: [String: Any] = [
  kSecClass as String: kSecClassGenericPassword,
  kSecAttrAccount as String: "rez_access_token",
  kSecValueData as String: token.data(using: .utf8)!,
  kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
]
SecItemAdd(query as CFDictionary, nil)
```

```kotlin
// Android - Use EncryptedSharedPreferences
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val sharedPreferences = EncryptedSharedPreferences.create(
    context,
    "rez_tokens",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

sharedPreferences.edit().putString("access_token", token).apply()
```

## Scopes

Tokens are issued with specific scopes based on the merchant's permissions:

| Scope | Description |
|-------|-------------|
| `campaigns:read` | View campaign information |
| `campaigns:write` | Create, update, delete campaigns |
| `wallet:read` | View wallet balance and transactions |
| `wallet:write` | Make deposits, reservations |
| `webhooks:read` | View webhook configurations |
| `webhooks:write` | Create, update, delete webhooks |
| `analytics:read` | Access analytics data |
| `admin:*` | Full admin access (restricted) |

## Service-to-Service Authentication

For internal service communication, use service tokens:

```bash
curl -X GET http://internal-service/v1/data \
  -H "X-Internal-Token: service_token_here"
```

Service tokens are stored in `INTERNAL_SERVICE_TOKENS_JSON` as a JSON map:

```json
{
  "ads-service": "tok_service_ads_xxx",
  "pricing-engine": "tok_service_pricing_xxx",
  "wallet-service": "tok_service_wallet_xxx"
}
```

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_CREDENTIALS` | Email or password incorrect | Verify credentials |
| `TOKEN_EXPIRED` | Access token has expired | Use refresh token |
| `TOKEN_INVALID` | Token is malformed or tampered | Re-authenticate |
| `TOKEN_REVOKED` | Token was manually revoked | Re-authenticate |
| `RATE_LIMIT_EXCEEDED` | Too many auth attempts | Wait and retry |
| `ACCOUNT_LOCKED` | Account temporarily locked | Contact support |

## Security Considerations

### Rate Limiting

Authentication endpoints have stricter rate limits:

- Login: 5 attempts per minute per IP
- Refresh: 10 attempts per minute per token
- Verify: 60 attempts per minute per token

### Failed Login Tracking

After 5 failed attempts, the account is temporarily locked for 15 minutes. Track failed attempts on your end:

```javascript
let failedAttempts = 0;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

async function login(email, password) {
  if (failedAttempts >= MAX_ATTEMPTS) {
    throw new Error('Account locked. Try again in 15 minutes.');
  }

  try {
    const response = await apiLogin(email, password);
    failedAttempts = 0; // Reset on success
    return response;
  } catch (error) {
    failedAttempts++;
    throw error;
  }
}
```

### Token Validation

Always validate tokens server-side:

```javascript
import jwt from 'jsonwebtoken';

function validateToken(token, secret) {
  try {
    const decoded = jwt.verify(token, secret);
    return {
      valid: true,
      payload: decoded
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}
```

## SDK Integration

### JavaScript/TypeScript SDK

```bash
npm install @rez-money/sdk
```

```typescript
import { ReZClient } from '@rez-money/sdk';

const client = new ReZClient({
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret'
});

// Login
await client.auth.login({
  email: 'merchant@example.com',
  password: 'password123'
});

// Tokens are automatically managed
const campaigns = await client.campaigns.list();

// SDK handles token refresh automatically
```

### Python SDK

```bash
pip install rez-money
```

```python
from rez_money import ReZClient

client = ReZClient(
    api_key='your_api_key',
    api_secret='your_api_secret'
)

# Login
client.auth.login(
    email='merchant@example.com',
    password='password123'
)

# List campaigns
campaigns = client.campaigns.list()

# Token refresh is automatic
```
