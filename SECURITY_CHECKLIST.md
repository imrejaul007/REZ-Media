# REZ-Media Security Checklist

This document provides a security checklist for all REZ-Media services. Use this as a reference when auditing or developing new features.

## Services Covered

- REZ-ads-service
- REZ-decision-service
- REZ-media-events
- REZ-gamification-service
- REZ-automation-service

---

## Security Audit Summary (2026-05-12)

### Issues Fixed

| Issue | Severity | Service | Status |
|-------|----------|---------|--------|
| Timing attack on auth comparison | CRITICAL | ads-service | ✅ Fixed |
| Open redirect in email tracking | CRITICAL | automation-service | ✅ Fixed |
| No authentication on decision service | CRITICAL | decision-service | ✅ Fixed |
| Unauthenticated conversion events | CRITICAL | ads-service | ✅ Fixed |
| Redis connection without resilience | HIGH | decision-service | ✅ Fixed |
| IDOR vulnerability in action approval | HIGH | decision-service | ✅ Fixed |
| SSRF allowlist too permissive | MEDIUM | media-events | ✅ Fixed |
| ROI calculation using hardcoded estimate | MEDIUM | ads-service | ✅ Documented |

---

## 1. Authentication Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| All internal service routes use verifyInternal middleware | ✅ Required | Import from `../middleware/auth` |
| All admin routes use verifyAdmin middleware | ✅ Required | Check `src/routes/admin.ts` |
| All consumer routes use verifyConsumer middleware | ✅ Required | Check `src/routes/serve.ts` |
| JWT tokens use constant-time comparison | ✅ Required | Use `crypto.timingSafeEqual()` |
| Blank tokens are rejected | ✅ Required | Check `tokenStr.trim().length === 0` |
| Token length mismatch handled (timingSafeEqual throws) | ✅ Required | Wrap in try/catch |

### Authentication Middleware Pattern

```typescript
import { verifyInternal } from '../middleware/auth';

// Apply to route
router.post('/endpoint', verifyInternal, async (req, res) => {
  // Route handler
});
```

---

## 2. Authorization Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| Merchants can only access their own resources | ✅ Required | Check `merchantId` matches |
| Admin operations require admin role | ✅ Required | Use verifyAdmin middleware |
| IDOR vulnerabilities prevented | ✅ Required | Validate resource ownership |
| Rate limiting on public endpoints | ✅ Required | Redis-based preferred |

### Ownership Check Pattern

```typescript
// Get resource
const ad = await getCampaignById(req.params.id);

// Verify ownership
if (ad.merchantId.toString() !== req.merchantId) {
  return res.status(404).json({ error: 'Not found' });
}
```

---

## 3. Input Validation Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| All user input validated | ✅ Required | Use Zod or manual validation |
| MongoDB queries use parameterized values | ✅ Required | Never string concatenation |
| ObjectId validation for IDs | ✅ Required | Use `Types.ObjectId.isValid()` |
| String length limits enforced | ✅ Required | Check maxLength in schema |
| Numeric range validation | ✅ Required | min/max in schema |
| Enum validation | ✅ Required | Use schema enums |

### Input Validation Pattern

```typescript
// ObjectId validation
if (!Types.ObjectId.isValid(req.params.id)) {
  return res.status(400).json({ error: 'Invalid ID' });
}

// Enum validation
const validPlacements = ['home_banner', 'explore_feed', 'store_listing', 'search_result'];
if (!validPlacements.includes(placement)) {
  return res.status(400).json({ error: 'Invalid placement' });
}

// Numeric validation
if (typeof bidAmount !== 'number' || bidAmount < 0) {
  return res.status(400).json({ error: 'Invalid bidAmount' });
}
```

---

## 4. Security Headers Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| helmet() middleware enabled | ✅ Required | In index.ts |
| CORS properly configured | ✅ Required | No wildcard in production |
| X-Content-Type-Options: nosniff | ✅ Enabled | Via helmet() |
| X-Frame-Options: DENY | ✅ Enabled | Via helmet() |
| Content-Security-Policy configured | ✅ Required | Disable if needed for API |

### Security Headers Pattern

```typescript
import helmet from 'helmet';
import cors from 'cors';

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(','),
  credentials: true,
}));
```

---

## 5. Secrets Management Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| No secrets in code | ✅ Required | Use environment variables |
| No secrets in git | ✅ Required | Add to .gitignore |
| .env.example has placeholder values | ✅ Required | Real values not committed |
| Environment variables validated at startup | ✅ Required | Use validateEnv() |

### Environment Validation Pattern

```typescript
function validateEnv(): void {
  const required = ['MONGODB_URI', 'REDIS_URL'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```

---

## 6. Rate Limiting Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| Public endpoints are rate limited | ✅ Required | 100/min default |
| Redis-based rate limiting preferred | ✅ Recommended | Over in-memory |
| Rate limit fallback documented | ✅ Required | Note behavior when Redis down |

### Rate Limiting Pattern

```typescript
const impressionLimiter = createRateLimiter(60_000, 100); // 100/min

router.post('/impression', async (req, res) => {
  if (!(await impressionLimiter(userId, 'impression'))) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  // Handle request
});
```

---

## 7. Logging Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| Sensitive data not logged | ✅ Required | No tokens, passwords, PII |
| Authentication failures logged | ✅ Required | Include context |
| Request IDs for tracing | ✅ Recommended | Use X-Request-ID |
| Structured logging used | ✅ Required | Use JSON format |

### Logging Pattern

```typescript
import { logger } from './config/logger';

// Good - structured logging
logger.info('Request processed', { userId, action, durationMs });

// Bad - sensitive data
logger.info('User logged in', { email: 'user@test.com', password: 'secret123' });
```

---

## 8. Error Handling Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| No stack traces in production | ✅ Required | Custom error handler |
| Custom error pages/messages | ✅ Required | User-friendly messages |
| Graceful degradation | ✅ Required | Don't crash on external failures |
| Error responses include error codes | ✅ Recommended | For client handling |

### Error Handling Pattern

```typescript
// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, path: req.path });

  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
```

---

## 9. SSRF Prevention Checklist (Media Services)

| Requirement | Status | Notes |
|------------|--------|-------|
| Image URLs validated against allowlist | ✅ Required | Whitelist hosts |
| Private IP ranges blocked | ✅ Required | 10.x.x.x, 172.16-31.x.x, etc. |
| DNS rebinding protection | ✅ Recommended | Resolve and validate IP |
| No redirects to arbitrary URLs | ✅ Required | Validate all redirects |

### SSRF Prevention Pattern

```typescript
const ALLOWED_IMAGE_HOSTS = (process.env.ALLOWED_IMAGE_HOSTS || 'res.cloudinary.com,images.unsplash.com')
  .split(',');

function isUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_IMAGE_HOSTS.includes(parsed.host);
  } catch {
    return false;
  }
}
```

---

## 10. Open Redirect Prevention

| Requirement | Status | Notes |
|------------|--------|-------|
| Redirect URLs validated against allowlist | ✅ Required | Never trust user input |
| Private IP ranges blocked | ✅ Required | Prevent internal redirects |
| Only HTTPS URLs allowed | ✅ Required | No http:// redirects |

---

## Security Issue Response

If you find a security vulnerability:

1. **Do NOT** commit the vulnerable code
2. **Do NOT** describe the vulnerability in commit messages
3. Report to the security team immediately
4. Follow the incident response process

### Common Vulnerabilities to Watch For

| Vulnerability | Location | Prevention |
|--------------|----------|------------|
| SQL/NoSQL Injection | Database queries | Parameterized queries |
| XSS | User-generated content | Output encoding |
| CSRF | State-changing operations | CSRF tokens |
| IDOR | Resource access | Ownership validation |
| SSRF | URL fetching | Allowlist + IP check |
| Open Redirect | Redirects | Allowlist validation |
| Timing Attack | Auth comparison | Constant-time comparison |

---

## Review Schedule

- **Before Merge**: All PRs reviewed for security
- **Monthly**: Automated security scans
- **Quarterly**: Manual security audit
- **Annually**: Penetration testing

---

*Last Updated: 2026-05-12*
