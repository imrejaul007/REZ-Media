# Twilio WhatsApp Business Setup Guide

This guide walks you through setting up Twilio WhatsApp integration for the REZ Communications Platform.

## Prerequisites

- Twilio account with WhatsApp Business API access
- WhatsApp Business Account (WABA)
- Node.js 18+ environment
- ngrok or public URL for webhook callbacks

---

## Table of Contents

1. [Getting Twilio Credentials](#1-getting-twilio-credentials)
2. [Creating WhatsApp Business Account](#2-creating-whatsapp-business-account)
3. [Setting Up WhatsApp Sender](#3-setting-up-whatsapp-sender)
4. [Configuring Webhooks](#4-configuring-webhooks)
5. [Submitting Templates for Approval](#5-submitting-templates-for-approval)
6. [Environment Configuration](#6-environment-configuration)
7. [Status Check Commands](#7-status-check-commands)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Getting Twilio Credentials

### Step 1.1: Create Twilio Account

1. Go to [Twilio Console](https://console.twilio.com/)
2. Sign up for a free trial or log in to existing account
3. Verify your email and phone number

### Step 1.2: Get Account Credentials

1. Navigate to **General Settings** in Twilio Console
2. Copy your **Account SID** (starts with `AC...`)
3. Copy your **Auth Token** (from the same page)

```
Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Auth Token:  your-auth-token-here
```

### Step 1.3: Enable WhatsApp Business API

1. Go to **Messaging** > **Try it Out** > **Send a WhatsApp Message**
2. Or navigate to **essaging** > **Senders** > **WhatsApp Senders**
3. Request access to WhatsApp Business API

---

## 2. Creating WhatsApp Business Account

### Step 2.1: Create Facebook Business Manager Account

1. Go to [Business.facebook.com](https://business.facebook.com/)
2. Click **Create Account**
3. Fill in business details:
   - Business name: `REZ Media`
   - Work email: Your verified business email
   - Business phone number
   - Business address

### Step 2.2: Verify Business

1. Go to **Business Settings** > **Security Center**
2. Complete verification:
   - **Email verification**: Click link sent to your business email
   - **Phone verification**: Enter code sent to business phone
   - **Business verification**: Upload required documents

Verification typically takes 1-2 business days.

### Step 2.3: Create WhatsApp Business Account (WABA)

1. In Business Manager, go to **WhatsApp** > **Accounts**
2. Click **Create WhatsApp Business Account**
3. Select your verified business profile
4. Enter display info:
   - Business display name: `REZ`
   - Timezone: Your primary timezone

---

## 3. Setting Up WhatsApp Sender

### Step 3.1: Request a Phone Number

1. In WhatsApp Business Account, go to **Phone Numbers**
2. Click **Add Phone Number**
3. Choose option:
   - **Use a Twilio number** (recommended)
   - **Use your own number** (requires verification)

### Step 3.2: Configure the Number

For Twilio-provided numbers:

```
Phone Number Type: Long Number or Short Code
Number: +1234567890
Country: United States (or your target market)
```

For your own number:

1. Select country code
2. Enter phone number (with country code)
3. Wait for verification code
4. Enter 6-digit verification code

### Step 3.3: Note the Phone Number ID

After setup, note the following IDs from Twilio Console:

1. Go to **Messaging** > **Senders** > **WhatsApp Senders**
2. Find your WhatsApp number
3. Copy the **Phone Number SID** (starts with `WH...`)

```
Phone Number SID: WHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WhatsApp Number: +1234567890
```

---

## 4. Configuring Webhooks

### Step 4.1: Set Up Callback URL

1. In Twilio Console, go to your WhatsApp sender
2. Click **Edit** on Webhook configuration
3. Enter your webhook URL:

```
Production:    https://api.rez.io/webhooks/whatsapp
Staging:       https://staging-api.rez.io/webhooks/whatsapp
Development:   https://your-ngrok-url/webhooks/whatsapp
```

### Step 4.2: Configure Webhook Events

Enable these webhook events:

- [x] **Message Received**
- [x] **Message Delivered**
- [x] **Message Read**
- [x] **Message Sent**
- [x] **Message Failed**
- [x] **Message Queued**

### Step 4.3: Set Verify Token

Generate a secure random token for webhook verification:

```bash
openssl rand -hex 32
```

Example output:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

## 5. Submitting Templates for Approval

WhatsApp requires all outbound message templates to be pre-approved. Follow this process for each template.

### Step 5.1: Access Template Manager

1. In Twilio Console, go to **Messaging** > **Templates**
2. Or in WhatsApp Business Manager, go to **Templates**

### Step 5.2: Create New Template

Click **Create Template** and fill in:

#### Template Details

| Field | Value |
|-------|-------|
| **Template Name** | `welcome_rez` |
| **Language** | English (en) |
| **Category** | Transactional / Marketing / Utility |

#### Template Body

**Welcome Message Template:**
```
Hello {{1}}! Welcome to REZ. Your account is ready. Start exploring deals near you at {{2}}.
```

**Order Confirmation Template:**
```
Your REZ order #{{1}} is confirmed. Total: {{2}}. Delivery by {{3}}. Track: {{4}}
```

**Abandoned Cart Template:**
```
Hi {{1}}, you left items in your cart! Complete your purchase and get {{2}}% off. Shop now: {{3}}
```

**Promotional Template:**
```
{{1}}! {{2}} only! Use code {{3}} for {{4}}% off. Valid until {{5}}. {{6}}
```

**Appointment Reminder Template:**
```
Reminder: {{1}} appointment at {{2}} tomorrow at {{3}}. Address: {{4}}. Confirm: {{5}}
```

### Step 5.3: Template Variables Format

WhatsApp uses numbered placeholders `{{1}}`, `{{2}}`, etc.

| Variable Type | Example | Notes |
|--------------|---------|-------|
| Text | `Hello {{1}}!` | User names, messages |
| Currency | `{{1}}` with `{{2}}` currency | $100, 100 USD |
| DateTime | `{{1}}` with `{{2}}` date_format | May 15, 2:00 PM |
| URL | `{{1}}` | Must be HTTPS |

### Step 5.4: Submit for Review

1. Click **Submit for Review**
2. Wait for WhatsApp review (typically 24-48 hours)
3. Check status in Templates dashboard

### Step 5.5: Template Status

| Status | Meaning | Action |
|--------|---------|--------|
| **Pending** | Under review | Wait 24-48 hours |
| **Approved** | Ready to use | Use in campaigns |
| **Rejected** | Not approved | Fix issues, resubmit |
| **Disabled** | Violated policy | Review guidelines |

### Step 5.6: Resubmit Rejected Templates

Common rejection reasons and fixes:

1. **Too many variables**: Reduce to max 15 variables
2. **Missing context**: Add business name, clearer CTA
3. **Phone number format**: Use international format in URLs
4. **Incomplete CTA**: Ensure button links work
5. **Grammar/punctuation**: Fix formatting issues

---

## 6. Environment Configuration

### Step 6.1: Copy Environment File

```bash
cp .env.example .env
```

### Step 6.2: Configure Twilio Variables

Update `.env` with your Twilio credentials:

```env
# =============================================================================
# TWILIO CREDENTIALS
# =============================================================================

# Twilio Account SID (from Twilio Console)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Twilio Auth Token (from Twilio Console)
TWILIO_AUTH_TOKEN=your-auth-token-here

# =============================================================================
# WHATSAPP CONFIGURATION
# =============================================================================

# WhatsApp provider (twilio for production)
WHATSAPP_PROVIDER=twilio

# Your Twilio WhatsApp sender number (with country code)
WHATSAPP_FROM_NUMBER=+1234567890

# Alternative WhatsApp Business API (not using Twilio)
# Uncomment if using WhatsApp Business API directly
# WHATSAPP_PROVIDER=whatsapp-business
# WHATSAPP_PHONE_NUMBER_ID=Wxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# WHATSAPP_BUSINESS_ACCOUNT_ID=your-business-account-id
# WHATSAPP_APP_SECRET=your-app-secret

# =============================================================================
# WEBHOOK SECURITY
# =============================================================================

# Verification token for incoming webhooks
# Generate with: openssl rand -hex 32
WHATSAPP_VERIFY_TOKEN=your-generated-verify-token-here

# =============================================================================
# AUTO-REPLY SETTINGS
# =============================================================================

# Enable auto-reply for non-template messages
WHATSAPP_AUTO_REPLY=false

# Auto-reply message text
WHATSAPP_AUTO_REPLY_MESSAGE=Thanks for your message! Our team will respond shortly.
```

### Step 6.3: Production Environment

For production, also set:

```env
# Production settings
NODE_ENV=production
LOG_LEVEL=info

# Rate limiting
RATE_LIMIT_RPM=300

# Template cache TTL
TEMPLATE_CACHE_TTL=3600
```

---

## 7. Status Check Commands

### Check WhatsApp Service Status

```bash
# Health check endpoint
curl http://localhost:3000/health | jq '.services[] | select(.service == "whatsapp")'
```

Expected output:
```json
{
  "service": "whatsapp",
  "healthy": true,
  "latency": 45
}
```

### Check Template Status via Twilio API

```bash
# List all templates
curl -X GET "https://content.twilio.com/v1/Content" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"

# Check specific template
curl -X GET "https://content.twilio.com/v1/Content/YOUR_TEMPLATE_SID" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

### Check WhatsApp Business Account

```bash
# List WhatsApp Business Accounts
curl -X GET "https://lookups.twilio.com/v2/PhoneNumbers/+1234567890" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

### Verify Webhook Configuration

```bash
# Test webhook endpoint
curl -X POST "https://your-domain.com/webhooks/whatsapp" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE"
```

Expected response: Returns the challenge string.

### Check Message Logs

In Twilio Console:
1. Go to **Monitor** > **Logs** > **Messaging**
2. Filter by your WhatsApp sender number
3. Check delivery status and error codes

### Test Sending a Message

```bash
# Using platform API
curl -X POST "http://localhost:3000/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-platform-token" \
  -d '{
    "to": "+1234567890",
    "body": "Test message from REZ Communications Platform"
  }'
```

---

## 8. Troubleshooting

### Common Issues

#### Issue: "Account not verified for WhatsApp"

**Cause**: WhatsApp Business Account not fully verified

**Solution**:
1. Complete business verification in Facebook Business Manager
2. Ensure phone number is verified
3. Wait 24-48 hours after verification

#### Issue: "Template rejected - missing business name"

**Cause**: Template doesn't include business identifier

**Solution**:
1. Add "REZ" or your registered business name to template
2. Example: "Hi! REZ here. Your order #{{1}} is confirmed."

#### Issue: "Webhook not receiving events"

**Cause**: Webhook URL not accessible or token mismatch

**Solution**:
1. Verify URL is publicly accessible (not localhost)
2. Use ngrok for local testing: `ngrok http 3000`
3. Confirm WHATSAPP_VERIFY_TOKEN matches Twilio config
4. Check firewall allows Twilio IPs

#### Issue: "Message rate limited"

**Cause**: Exceeded WhatsApp rate limits

**Solution**:
1. Standard tier: 1 message/second
2. Business tier: Higher limits available
3. Implement message queuing
4. Monitor rate in Twilio Console

#### Issue: "Invalid phone number format"

**Cause**: Number not in E.164 format

**Solution**:
1. Ensure number starts with `+` and country code
2. Example: `+1234567890` (not `1234567890` or `+1 234-567-890`)
3. Use Twilio's lookup API to validate

#### Issue: "Session expired"

**Cause**: WhatsApp session invalid or expired

**Solution**:
1. For Twilio: Re-authenticate the WhatsApp number
2. For WhatsApp Web: Re-scan QR code
3. Check session persistence configuration

### Error Codes Reference

| Code | Description | Action |
|------|-------------|--------|
| 20003 | Authentication failed | Check TWILIO_AUTH_TOKEN |
| 20429 | Rate limited | Reduce message frequency |
| 21601 | Phone number not WhatsApp-enabled | Verify number in Twilio Console |
| 63001 | Session expired | Re-authenticate |
| 63002 | Invalid session | Re-establish connection |

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
WEBHOOK_DEBUG_LOGGING=true
```

Check logs:

```bash
# View real-time logs
npm run dev 2>&1 | grep -i whatsapp

# Check webhook payloads
tail -f logs/comms.log | grep webhook
```

---

## Quick Reference

### Required Environment Variables

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
WHATSAPP_FROM_NUMBER=+1234567890
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_PROVIDER=twilio
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/api/whatsapp/send` | POST | Send WhatsApp message |
| `/api/whatsapp/send-template` | POST | Send template message |
| `/api/whatsapp/batch` | POST | Send batch messages |
| `/webhooks/whatsapp` | POST | Receive WhatsApp webhooks |

### Template Names (After Approval)

```
welcome_rez
order_confirmation_rez
abandoned_cart_rez
promotional_offer_rez
appointment_reminder_rez
```

---

## Additional Resources

- [Twilio WhatsApp Documentation](https://www.twilio.com/docs/whatsapp)
- [WhatsApp Business API](https://business.whatsapp.com/developers/developer-hub)
- [Facebook Business Manager](https://business.facebook.com/)
- [Twilio Console](https://console.twilio.com/)
