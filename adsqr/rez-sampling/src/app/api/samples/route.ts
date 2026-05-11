// Free Samples API Routes
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/samples - Get available samples
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId')
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')

    // Get available samples
    if (action === 'available' || (!action && campaignId)) {
      let query = supabase
        .from('sample_products')
        .select('*')
        .eq('is_active', true)
        .gt('stock', 0)

      if (campaignId) {
        query = query.eq('campaign_id', campaignId)
      }

      const { data: samples, error } = await query

      if (error) throw error

      return NextResponse.json({
        success: true,
        samples: (samples || []).map(s => ({
          id: s.id,
          campaignId: s.campaign_id,
          brandId: s.brand_id,
          name: s.name,
          description: s.description,
          category: s.category,
          image: s.image,
          stock: s.stock,
          maxPerUser: s.max_per_user,
          value: s.value,
          expiryDate: s.expiry_date,
          terms: s.terms,
          isActive: s.is_active,
          createdAt: s.created_at
        }))
      })
    }

    // Get user's requests
    if (action === 'requests' && userId) {
      const { data: requests, error } = await supabase
        .from('sample_requests')
        .select('*')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })

      if (error) throw error

      return NextResponse.json({
        success: true,
        requests: (requests || []).map(r => ({
          id: r.id,
          sampleId: r.sample_id,
          userId: r.user_id,
          productName: r.product_name,
          status: r.status,
          pickupCode: r.pickup_code,
          pickupLocation: r.pickup_location,
          requestedAt: r.requested_at,
          approvedAt: r.approved_at,
          expiresAt: r.expires_at,
          claimedAt: r.claimed_at
        }))
      })
    }

    // Get request status
    if (action === 'status') {
      const requestId = searchParams.get('requestId')
      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
      }

      const { data: request, error } = await supabase
        .from('sample_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        request: {
          id: request.id,
          status: request.status,
          pickupCode: request.pickup_code,
          pickupLocation: request.pickup_location,
          expiresAt: request.expires_at
        }
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Samples GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/samples - Request sample or claim
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await req.json()
    const { action, sampleId, userId, requestId, pickupLocation } = body

    // Request a sample
    if (action === 'request') {
      if (!sampleId || !userId) {
        return NextResponse.json(
          { error: 'Missing sampleId or userId' },
          { status: 400 }
        )
      }

      // Check if sample exists and has stock
      const { data: sample, error: sampleError } = await supabase
        .from('sample_products')
        .select('*')
        .eq('id', sampleId)
        .single()

      if (sampleError || !sample) {
        return NextResponse.json({ error: 'Sample not found' }, { status: 404 })
      }

      if (!sample.is_active || sample.stock <= 0) {
        return NextResponse.json({ error: 'Sample not available' }, { status: 400 })
      }

      // Check user's existing requests for this sample
      const { data: existingRequests } = await supabase
        .from('sample_requests')
        .select('id')
        .eq('sample_id', sampleId)
        .eq('user_id', userId)
        .in('status', ['pending', 'approved', 'ready'])
        .limit(1)

      if (existingRequests && existingRequests.length >= sample.max_per_user) {
        return NextResponse.json(
          { error: `Maximum ${sample.max_per_user} requests allowed for this sample` },
          { status: 400 }
        )
      }

      // Generate pickup code
      const pickupCode = generatePickupCode()

      // Create request
      const { data: request, error: requestError } = await supabase
        .from('sample_requests')
        .insert({
          sample_id: sampleId,
          user_id: userId,
          product_name: sample.name,
          status: 'pending',
          pickup_code: pickupCode,
          pickup_location: pickupLocation || {
            name: 'Main Store',
            address: 'To be assigned',
            lat: 0,
            lng: 0
          },
          requested_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        })
        .select()
        .single()

      if (requestError) throw requestError

      // Decrease stock
      await supabase
        .from('sample_products')
        .update({ stock: sample.stock - 1 })
        .eq('id', sampleId)

      return NextResponse.json({
        success: true,
        request: {
          id: request.id,
          pickupCode: request.pickup_code,
          status: request.status,
          expiresAt: request.expires_at
        }
      }, { status: 201 })
    }

    // Store staff claims sample for user
    if (action === 'claim') {
      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
      }

      const { data: request, error: requestError } = await supabase
        .from('sample_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (requestError || !request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 })
      }

      if (request.status !== 'ready') {
        return NextResponse.json({ error: 'Sample not ready for pickup' }, { status: 400 })
      }

      // Update request
      const { data: updated, error: updateError } = await supabase
        .from('sample_requests')
        .update({
          status: 'claimed',
          claimed_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single()

      if (updateError) throw updateError

      return NextResponse.json({
        success: true,
        message: 'Sample claimed successfully'
      })
    }

    // Approve request (for admin/brand)
    if (action === 'approve') {
      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
      }

      const { data: updated, error } = await supabase
        .from('sample_requests')
        .update({
          status: 'ready',
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('status', 'pending')
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, request: updated })
    }

    // Cancel request
    if (action === 'cancel') {
      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
      }

      // Get request to restore stock
      const { data: request } = await supabase
        .from('sample_requests')
        .select('sample_id')
        .eq('id', requestId)
        .single()

      if (request) {
        // Restore stock
        await supabase.rpc('increment_sample_stock', { sample_id: request.sample_id })
      }

      const { data: updated, error } = await supabase
        .from('sample_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('user_id', userId)
        .single()

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    // Submit feedback
    if (action === 'feedback') {
      if (!requestId || !body.feedback) {
        return NextResponse.json({ error: 'Missing requestId or feedback' }, { status: 400 })
      }

      const { data: updated, error } = await supabase
        .from('sample_requests')
        .update({
          feedback: body.feedback
        })
        .eq('id', requestId)
        .eq('status', 'claimed')
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Samples POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/samples - Update sample or request
export async function PUT(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { action, sampleId, updates } = body

    // Update sample product (brand only)
    if (action === 'update-sample' && sampleId) {
      const { data: updated, error } = await supabase
        .from('sample_products')
        .update({
          name: updates.name,
          description: updates.description,
          category: updates.category,
          image: updates.image,
          stock: updates.stock,
          max_per_user: updates.maxPerUser,
          value: updates.value,
          terms: updates.terms,
          is_active: updates.isActive
        })
        .eq('id', sampleId)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, sample: updated })
    }

    // Bulk update stock
    if (action === 'bulk-update-stock' && updates) {
      for (const update of updates) {
        await supabase
          .from('sample_products')
          .update({ stock: update.stock })
          .eq('id', update.id)
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Samples PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/samples - Delete sample
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const sampleId = searchParams.get('sampleId')

    if (!sampleId) {
      return NextResponse.json({ error: 'Missing sampleId' }, { status: 400 })
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('sample_products')
      .update({ is_active: false })
      .eq('id', sampleId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Samples DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function
function generatePickupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
