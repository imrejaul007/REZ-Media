import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'

// POST /api/inquiries/[id]/decline — vendor declines an inquiry

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: inquiryId } = await params
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: inquiry } = await supabase
      .from('inquiries')
      .select('id, vendor_id, status')
      .eq('id', inquiryId)
      .single()

    if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    if (inquiry.vendor_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!['pending', 'quoted'].includes(inquiry.status)) {
      return NextResponse.json({ error: 'Inquiry cannot be declined in current status' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('inquiries')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', inquiryId)
      .select('id, status')
      .single()

    if (error) {
      logger.error('[inquiries decline] Database error', { error: error.message })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ inquiry: updated })
  } catch (e) {
    logger.error('POST /api/inquiries/[id]/decline error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
