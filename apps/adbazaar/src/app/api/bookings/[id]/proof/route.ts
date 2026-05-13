import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { BookingStatus } from '@/types'
import { emailProofUploaded } from '@/lib/email'
import { randomUUID } from 'crypto'
import logger from '@/lib/logger'
import { insertNotification } from '@/lib/notifications'

// POST /api/bookings/[id]/proof
// Vendor uploads proof of execution image(s). Each file is uploaded to
// Supabase Storage and the URL is appended to proof_of_execution[].
// Booking status advances to Executing on first upload.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: bookingId } = await params

    // Auth
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

    // Verify booking ownership (vendor)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, buyer_id, vendor_id, status, proof_of_execution, listings(title)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.vendor_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!['confirmed', 'paid', 'executing'].includes(booking.status)) {
      return NextResponse.json({ error: 'Proof can only be uploaded for confirmed/executing bookings' }, { status: 400 })
    }

    // Parse multipart form
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB per file

    const uploadedUrls: string[] = []

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 })
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `File too large (max 10MB): ${file.name}` }, { status: 400 })
      }

      const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
      const path = `proof/${bookingId}/${Date.now()}-${randomUUID()}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(path, buffer, { contentType: file.type, upsert: false })

      if (uploadError) {
        logger.error('Proof upload error', uploadError)
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
      }

      const { data: { publicUrl } } = supabase.storage
        .from('listing-images')
        .getPublicUrl(path)

      uploadedUrls.push(publicUrl)
    }

    // Append to proof_of_execution and advance status
    const existingProof: string[] = Array.isArray(booking.proof_of_execution) ? booking.proof_of_execution : []
    const newProof = [...existingProof, ...uploadedUrls]
    const newStatus = booking.status === BookingStatus.Confirmed || booking.status === BookingStatus.Paid
      ? BookingStatus.Executing
      : booking.status

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ proof_of_execution: newProof, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select('id, status, proof_of_execution')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Notify buyer of proof uploaded
    await insertNotification({
      user_id: booking.buyer_id,
      type: 'proof_uploaded',
      title: 'Proof uploaded',
      body: 'Your vendor uploaded execution proof. Please review and approve.',
      link: `/buyer/bookings`,
    }).catch((e) => logger.error('notification insert failed', e))

    // AB-H3 FIX: Notify buyer of proof uploaded with proper error handling
    const listingRaw = booking.listings as unknown
    const listingObj = Array.isArray(listingRaw) ? (listingRaw[0] as Record<string, string> | undefined ?? null) : (listingRaw as Record<string, string> | null)
    ;(async () => {
      try {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, name')
          .in('id', [booking.buyer_id, booking.vendor_id])

        const buyer = users?.find((u) => u.id === booking.buyer_id)
        const vendor = users?.find((u) => u.id === booking.vendor_id)
        if (buyer?.email) {
          await emailProofUploaded({
            buyerEmail: buyer.email,
            buyerName: buyer.name ?? 'there',
            vendorName: vendor?.name ?? 'Vendor',
            listingTitle: listingObj?.title ?? 'your booking',
            bookingId,
          })
        }
      } catch (e) {
        logger.error('[proof] emailProofUploaded failed', e)
      }
    })()

    return NextResponse.json({ booking: updated, uploadedUrls })
  } catch (e) {
    logger.error('POST /api/bookings/[id]/proof error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
