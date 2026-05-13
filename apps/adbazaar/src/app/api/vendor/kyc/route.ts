import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'
import { validateEnv } from '@/lib/env'

/**
 * POST /api/vendor/kyc
 *
 * Submit KYC documents for vendor verification.
 * This endpoint handles document submission and status updates.
 *
 * Body: {
 *   documentType: 'aadhar' | 'pan' | 'gst_certificate' | 'address_proof' | 'business_certificate',
 *   documentUrl: string (URL to the uploaded document),
 *   documentNumber?: string (optional, for documents like Aadhar/PAN)
 * }
 *
 * AB-SEC-KYC-01: KYC submission with status tracking
 */
export async function POST(req: NextRequest) {
  try {
    validateEnv()

    // Authenticate user
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await req.json()
    const { documentType, documentUrl, documentNumber } = body

    if (!documentType || !documentUrl) {
      return NextResponse.json(
        { error: 'documentType and documentUrl are required' },
        { status: 400 }
      )
    }

    // Validate document type
    const validDocumentTypes = ['aadhar', 'pan', 'gst_certificate', 'address_proof', 'business_certificate']
    if (!validDocumentTypes.includes(documentType)) {
      return NextResponse.json(
        { error: `Invalid document type. Must be one of: ${validDocumentTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(documentUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid document URL' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Check if user is a vendor
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('id, role, kyc_status')
      .eq('id', user.id)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (userData.role !== 'vendor') {
      return NextResponse.json({ error: 'Only vendors can submit KYC documents' }, { status: 403 })
    }

    // Check if KYC is already verified (can't resubmit if verified)
    if (userData.kyc_status === 'verified') {
      return NextResponse.json(
        { error: 'Your KYC is already verified. No further submission is needed.' },
        { status: 400 }
      )
    }

    // Store KYC document reference in a kyc_documents table
    const { error: kycError } = await supabase
      .from('kyc_documents')
      .insert({
        user_id: user.id,
        document_type: documentType,
        document_url: documentUrl,
        document_number: documentNumber || null,
        status: 'pending',
      })

    if (kycError) {
      logger.error('Error storing KYC document', kycError)
      return NextResponse.json({ error: 'Failed to submit KYC document' }, { status: 500 })
    }

    // Update KYC status to 'submitted' if it was 'pending' or 'rejected'
    if (userData.kyc_status !== 'submitted') {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          kyc_status: 'submitted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) {
        logger.error('Error updating KYC status', updateError)
        // Non-fatal - document is submitted
      }
    }

    logger.info('KYC document submitted', { userId: user.id, documentType })

    return NextResponse.json({
      success: true,
      message: 'KYC document submitted successfully. You will be notified once reviewed.',
      kycStatus: 'submitted',
    })

  } catch (e) {
    logger.error('POST /api/vendor/kyc error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/vendor/kyc
 *
 * Get current KYC status and submitted documents for the authenticated vendor.
 */
export async function GET(req: NextRequest) {
  try {
    validateEnv()

    // Authenticate user
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Get KYC status
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('kyc_status')
      .eq('id', user.id)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get submitted documents
    const { data: documents } = await supabase
      .from('kyc_documents')
      .select('id, document_type, document_number, status, submitted_at, reviewed_at, rejection_reason')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })

    return NextResponse.json({
      kycStatus: userData.kyc_status || 'pending',
      documents: documents || [],
    })

  } catch (e) {
    logger.error('GET /api/vendor/kyc error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
