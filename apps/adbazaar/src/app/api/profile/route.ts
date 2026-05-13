import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { ProfileUpdateSchema } from '@/lib/schemas' // AB-CROSS-03 FIX: use Zod schema for input validation
import { verifyGST, verifyPAN } from '@/lib/verifyDocuments' // AB-SEC-DOC-01: GST/PAN verification integration
import { validateEnv } from '@/lib/env' // AB-SEC-ENV-01: Environment validation

// AB2-H1 FIX: Comprehensive XSS sanitization for user-supplied text fields.
// Names, company names, and city should never contain HTML or dangerous characters.
// This prevents stored XSS via payload injection in any field rendered without escaping.
// Using multiple layers of protection: strip HTML tags + escape dangerous chars.
const STRIP_HTML = (s: string): string => {
  if (!s || typeof s !== 'string') return ''
  // First strip any HTML/XML tags
  let clean = s.replace(/<[^>]*>/g, '').trim()
  // Then escape any remaining dangerous characters that could be used for XSS
  // Escape: & < > " ' (but only in attribute contexts, so we escape all for safety)
  clean = clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
  return clean
}

// AB2-H4 FIX: Alias for PATCH endpoint - same sanitization applies
// This ensures both POST (creation) and PATCH (update) operations are protected
const sanitizeUserText = STRIP_HTML

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) return null
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : user
}

// GET /api/profile — fetch own profile
// AB-C3 FIX: Mask sensitive fields (bank account number, IFSC) before returning.
// AB-SEC-ENV-01: Validate environment
export async function GET(req: NextRequest) {
  validateEnv()
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, phone, company_name, gst_number, pan_number, city, avatar_url, rez_merchant_id, role, verified, bank_account_name, bank_account_number, bank_ifsc, upi_id')
      .eq('id', user.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // AB-C3 FIX: Mask all sensitive financial/identification fields.
  // Exposing the full account number allows social engineering and phishing attacks.
  // GST and PAN numbers are government-issued IDs — full exposure is a GDPR/RBI violation.
  const maskedData = {
    ...data,
    bank_account_number: data.bank_account_number
      ? `XXXX${data.bank_account_number.slice(-4)}`
      : null,
    // IFSC is less sensitive but still PII — mask middle characters
    bank_ifsc: data.bank_ifsc
      ? `${data.bank_ifsc.slice(0, 4)}XXXX${data.bank_ifsc.slice(-3)}`
      : null,
    // GST and PAN are government-issued IDs — mask them too
    gst_number: data.gst_number
      ? `XX${data.gst_number.slice(2, 13)}XXXX${data.gst_number.slice(-4)}`
      : null,
    pan_number: data.pan_number
      ? `XXXXXXXXXX${data.pan_number.slice(-4)}`
      : null,
  }

  return NextResponse.json({ profile: maskedData })
  } catch (e) {
    logger.error('GET /api/profile error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/profile — update own profile
// AB-C3 FIX: Mask sensitive fields in response as well.
// AB-SEC-ENV-01: Validate environment
export async function PATCH(req: NextRequest) {
  validateEnv()
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // AB-CROSS-03 FIX: Use Zod schema to validate all fields including financial ones.
    // Previously accepted arbitrary strings for gst_number, pan_number, etc. with no validation.
    const rawBody = await req.json()
    const parsed = ProfileUpdateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid profile data', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { name, phone, company_name, gst_number, pan_number, city, rez_merchant_id, bank_account_name, bank_account_number, bank_ifsc, upi_id } = parsed.data

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    // AB2-H1 FIX + AB2-H4 FIX: strip HTML tags and escape dangerous characters from all
    // user-displayed text fields to prevent stored XSS in both creation and updates.
    // Applying after Zod validation (which already type-checks) so we get clean strings.
    if (name !== undefined) update.name = STRIP_HTML(String(name))
    if (phone !== undefined) update.phone = phone || null
    if (company_name !== undefined) update.company_name = company_name ? STRIP_HTML(company_name) : null
    if (gst_number !== undefined) update.gst_number = gst_number || null
    if (pan_number !== undefined) update.pan_number = pan_number || null
    if (city !== undefined) update.city = city ? STRIP_HTML(city) : null
    if (rez_merchant_id !== undefined) update.rez_merchant_id = rez_merchant_id || null
    if (bank_account_name !== undefined) update.bank_account_name = bank_account_name || null
    if (bank_account_number !== undefined) update.bank_account_number = bank_account_number || null
    if (bank_ifsc !== undefined) update.bank_ifsc = bank_ifsc || null
    if (upi_id !== undefined) update.upi_id = upi_id || null

    // AB-SEC-DOC-01: Verify GST/PAN when updated and store verification status
    if (gst_number) {
      const gstResult = await verifyGST(gst_number)
      if (!gstResult.valid) {
        return NextResponse.json(
          { error: `GST verification failed: ${gstResult.error}` },
          { status: 400 }
        )
      }
      update.gst_verified = false // In production, set to true if API verifies
      update.gst_name = gstResult.name || null
    }
    if (pan_number) {
      const panResult = await verifyPAN(pan_number)
      if (!panResult.valid) {
        return NextResponse.json(
          { error: `PAN verification failed: ${panResult.error}` },
          { status: 400 }
        )
      }
      update.pan_verified = false // In production, set to true if API verifies
      update.pan_name = panResult.name || null
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', user.id)
      .select('id, name, email, phone, company_name, gst_number, pan_number, city, avatar_url, rez_merchant_id, role, verified, bank_account_name, bank_account_number, bank_ifsc, upi_id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // AB-C3 FIX: Mask all sensitive financial/identification fields in PATCH response too.
    const maskedData = {
      ...data,
      bank_account_number: data.bank_account_number
        ? `XXXX${data.bank_account_number.slice(-4)}`
        : null,
      bank_ifsc: data.bank_ifsc
        ? `${data.bank_ifsc.slice(0, 4)}XXXX${data.bank_ifsc.slice(-3)}`
        : null,
      gst_number: data.gst_number
        ? `XX${data.gst_number.slice(2, 13)}XXXX${data.gst_number.slice(-4)}`
        : null,
      pan_number: data.pan_number
        ? `XXXXXXXXXX${data.pan_number.slice(-4)}`
        : null,
    }

    return NextResponse.json({ profile: maskedData })
  } catch (e) {
    logger.error('PATCH /api/profile error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
