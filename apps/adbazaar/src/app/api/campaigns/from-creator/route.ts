/**
 * AdBazaar - Push Campaign from Creator QR
 * Receive promotion listings from Creator QR as campaigns
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

// POST /api/campaigns/from-creator - Create campaign from Creator QR promotion
export async function POST(request: NextRequest) {
  if (!verifyInternal(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      source,
      sourcePromotionId,
      creatorSourceId,
      title,
      description,
      type,
      platform,
      budget,
      requirements,
      listingType,
    } = body;

    // Create campaign in AdBazaar
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        source: source || 'creator_qr',
        source_id: sourcePromotionId,
        creator_id: creatorSourceId,
        title,
        description,
        type: type || 'influencer',
        platform: platform || 'instagram',
        budget,
        requirements: requirements || [],
        status: 'open',
        budget_spent: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Campaign push error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaignId: data.id }, { status: 201 });
  } catch (error: any) {
    console.error('Campaign push error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
