import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { validateEnv } from '@/lib/env'

/**
 * GET /api/admin/kyc
 *
 * List all vendors with pending KYC for admin review.
 * Only accessible by admin users.
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

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (fetchError || !userData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get vendors with pending or submitted KYC
    const { data: vendors, error: vendorsError } = await supabase
      .from('users')
      .select(`
        id, name, email, company_name, phone, kyc_status, created_at,
        kyc_documents(id, document_type, document_url, document_number, status, submitted_at, reviewed_at, rejection_reason)
      `)
      .eq('role', 'vendor')
      .in('kyc_status', ['pending', 'submitted', 'rejected'])
      .order('created_at', { ascending: false })

    if (vendorsError) {
      logger.error('Error fetching KYC vendors', vendorsError)
      return NextResponse.json({ error: 'Failed to fetch KYC data' }, { status: 500 })
    }

    return NextResponse.json({ vendors: vendors || [] })

  } catch (e) {
    logger.error('GET /api/admin/kyc error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/kyc
 *
 * Approve or reject a vendor's KYC.
 * Body: { vendorId: string, action: 'approve' | 'reject', reason?: string }
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

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (fetchError || !userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Parse request body
    const body = await req.json()
    const { vendorId, action, reason } = body

    if (!vendorId || !action) {
      return NextResponse.json({ error: 'vendorId and action are required' }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
    }

    // Get the vendor
    const { data: vendor, error: vendorError } = await supabase
      .from('users')
      .select('id, kyc_status')
      .eq('id', vendorId)
      .eq('role', 'vendor')
      .single()

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const newStatus = action === 'approve' ? 'verified' : 'rejected'

    // Update vendor's KYC status
    const { error: updateError } = await supabase
      .from('users')
      .update({
        kyc_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)

    if (updateError) {
      logger.error('Error updating KYC status', updateError)
      return NextResponse.json({ error: 'Failed to update KYC status' }, { status: 500 })
    }

    // Update all pending documents
    await supabase
      .from('kyc_documents')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        rejection_reason: action === 'reject' ? (reason || 'KYC verification failed') : null,
      })
      .eq('user_id', vendorId)
      .eq('status', 'pending')

    // Update verified flag on user record
    if (action === 'approve') {
      await supabase
        .from('users')
        .update({ verified: true })
        .eq('id', vendorId)
    }

    logger.info(`KYC ${action}d`, { vendorId, adminId: user.id })

    return NextResponse.json({
      success: true,
      message: `Vendor KYC has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
      kycStatus: newStatus,
    })

  } catch (e) {
    logger.error('POST /api/admin/kyc error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
