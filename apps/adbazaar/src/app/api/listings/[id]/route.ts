import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing listing id' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  // Join vendor info from users table
  const { data: vendor, error: vendorError } = await supabase
    .from('users')
    .select('id, name, verified, city, created_at')
    .eq('id', listing.vendor_id)
    .single()

  if (vendorError || !vendor) {
    // Return listing without vendor rather than 500
    return NextResponse.json({
      listing,
      vendor: null,
    })
  }

  return NextResponse.json({ listing, vendor })
}
