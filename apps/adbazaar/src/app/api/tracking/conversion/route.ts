/**
 * AdBazaar - Conversion Tracking from Creator QR
 * Track bookings/conversions from QR codes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADBAZAAR_INTERNAL_KEY = process.env.ADBAZAAR_INTERNAL_KEY;

function verifyInternal(request: NextRequest): boolean {
  const key = request.headers.get('x-internal-key');
  return key === ADBAZAAR_INTERNAL_KEY;
}

// POST /api/tracking/conversion - Track booking as conversion
export async function POST(request: NextRequest) {
  if (!verifyInternal(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { source, creatorId, bookingId, amount, attributionSource } = body;

    // Log conversion
    const { error } = await supabase
      .from('conversions')
      .insert({
        source: source || 'creator_qr',
        creator_id: creatorId,
        booking_id: bookingId,
        amount: amount || 0,
        attribution_source: attributionSource || 'qr',
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Conversion tracking error:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Conversion tracking error:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
