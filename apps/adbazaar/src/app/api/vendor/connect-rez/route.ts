import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use anon key + Bearer token from the client to identify the user.
// The service-role client cannot read session cookies in Route Handlers,
// so we verify the JWT sent by the browser in the Authorization header.
function getUserClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  )
}

// Service-role client for writes (bypasses RLS intentionally for the update)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  try {
    const { rezMerchantId } = await req.json()

    if (!rezMerchantId || typeof rezMerchantId !== 'string' || rezMerchantId.trim().length < 8) {
      return NextResponse.json({ error: 'Invalid REZ Merchant ID.' }, { status: 400 })
    }

    const trimmed = rezMerchantId.trim()

    // Extract Bearer token from Authorization header
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    // Verify the token and get the user
    const userClient = getUserClient(accessToken)
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    // Verify merchant ID against REZ backend (if configured)
    const rezApiBase = process.env.REZ_API_BASE_URL
    const internalKey = process.env.REZ_INTERNAL_KEY
    if (rezApiBase && internalKey) {
      const verifyRes = await fetch(
        `${rezApiBase}/api/adbazaar/verify-merchant?merchantId=${encodeURIComponent(trimmed)}`,
        { headers: { 'x-internal-key': internalKey } },
      ).catch(() => null)

      if (verifyRes && !verifyRes.ok) {
        return NextResponse.json(
          { error: 'REZ Merchant ID not found. Please check and try again.' },
          { status: 400 },
        )
      }
    }

    // Save rez_merchant_id using service role (user row must exist)
    const serviceClient = getServiceClient()
    const { error: updateError } = await serviceClient
      .from('users')
      .update({ rez_merchant_id: trimmed })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save connection.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 })
  }
}
