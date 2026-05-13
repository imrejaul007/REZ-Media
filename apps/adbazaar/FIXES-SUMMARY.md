# AdBazaar Fixes — Executive Summary

**For:** Development Team
**Priority:** Critical issues MUST be fixed before any production launch
**Total Issues:** 111 (64 open, 47 fixed)
**Last Updated:** 2026-05-01

---

## ✅ Batch Fix #1 Complete (2026-05-01)

Fixed 10 issues in one session:

| ID | Issue | Severity | File |
|----|-------|----------|------|
| AB2-C1 | XFF spoofing bypass | CRITICAL | `qr/scan/route.ts` |
| AB-C2 | Rate limit race condition | CRITICAL | `qr/scan/route.ts` |
| AB-H2 | Fragile admin cookie parsing | HIGH | `adminAuth.ts` |
| AB-H3 | Fire-and-forget patterns | HIGH | 4 files |
| AB2-C2 | Commission double-application | HIGH | `inquiries/accept/route.ts` |
| AB-D2 | Attribution missing booking_id | MEDIUM | `dlq.ts` |
| AB-D3 | Cron freshness no pagination | MEDIUM | `cron/freshness/route.ts` |

**New Migration:** `013_add_attribution_booking_id.sql`

---

## Remaining Must-Fix Before Launch

| ID | Issue | Impact | File |
|----|-------|--------|------|
| ~~AB-C1~~ | ✅ FIXED | User ID spoofable via URL param | `qr/scan/route.ts` |
| ~~AB-C2~~ | ✅ FIXED | No rate limiting | `qr/scan/route.ts` |
| **AB-C3** | Bank data exposed in API | PII/financial leak | `profile/route.ts` |
| **AB-C4** | No idempotency on booking | Double payments | `bookings/route.ts` |
| **AB-C5** | Payment amount never verified | Pay ₹1 for ₹50k | `verify-payment/route.ts` |
| ~~AB-D1~~ | ✅ FIXED | Fire-and-forget patterns | Multiple files |
| ~~AB2-C1~~ | ✅ FIXED | IP cooldown bypassable | `qr/scan/route.ts` |
| ~~AB2-C2~~ | ✅ FIXED | Commission applied twice | `inquiries/accept/route.ts` |
| **AB3-C1** | Buyer can remove other's bookings | Authorization bypass | `campaigns/route.ts` |
| **AB3-C2** | Any user can create listing | Authorization bypass | `vendor/listings/route.ts` |

---

## Remaining High Priority

| Category | Issues |
|----------|--------|
| Authorization | AB3-C1, AB3-C2, AB2-H5 |
| XSS | AB2-H1, AB2-H4, AB3-M1 |
| Race Conditions | AB2-H6, AB2-H9 |
| Payment | AB3-H9, AB3-H10, AB-B4 |
| Performance | AB-H5, AB3-M4 |
| Data Integrity | AB-D4 |

---

## Files Still Needing Work

1. `src/app/api/campaigns/[id]/route.ts` — AB3-C1 (authorization)
2. `src/app/api/vendor/listings/route.ts` — AB3-C2 (role check)
3. `src/app/api/webhooks/razorpay/route.ts` — payment issues
4. `src/middleware.ts` — AB-H5 (security headers)
5. `src/next.config.ts` — security headers

---

## Database Migrations Needed

1. ✅ `013_add_attribution_booking_id.sql` — Created (AB-D2)
2. `014_add_vendor_ledger.sql` — For AB-A1

---

## Full Documentation

See `FIXES-REQUIRED.md` for detailed fixes, code examples, and file paths.
