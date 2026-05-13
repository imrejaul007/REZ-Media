/**
 * AdBazaar - QR Tracking from Creator QR
 * Track QR scans as ad impressions
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

// POST /api/tracking/impression - Track QR scan as impression
export async function POST(request: NextRequest) {
  if (!verifyInternal(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { source, creatorId, type, userId, metadata } = body;

    // Log impression
    const { error } = await supabase
      .from('qr_impressions')
      .insert({
        source: source || 'creator_qr',
        creator_id: creatorId,
        type: type || 'qr_scan',
        user_id: userId,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Impression tracking error:', error);
      // Don't fail the request, just log
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Impression tracking error:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
