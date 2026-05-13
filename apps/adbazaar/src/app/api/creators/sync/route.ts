/**
 * AdBazaar - Creator Sync from Creator QR
 * Endpoint to receive creator profiles from Creator QR service
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADBAZAAR_INTERNAL_KEY = process.env.ADBAZAAR_INTERNAL_KEY;

// Verify internal service call
function verifyInternal(request: NextRequest): boolean {
  const key = request.headers.get('x-internal-key');
  return key === ADBAZAAR_INTERNAL_KEY;
}

// POST /api/creators/sync - Sync creator from Creator QR
export async function POST(request: NextRequest) {
  // Verify internal key
  if (!verifyInternal(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      source,
      sourceId,
      display_name,
      username,
      bio,
      avatar_url,
      niche,
      socials,
      followers,
      engagement_rate,
    } = body;

    // Upsert creator in AdBazaar database
    const { data, error } = await supabase
      .from('creators')
      .upsert({
        source: source || 'creator_qr',
        source_id: sourceId,
        username,
        display_name,
        bio,
        avatar_url,
        niche,
        socials: socials || [],
        followers: followers || 0,
        engagement_rate: engagement_rate || 0,
        verified: false,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'source,source_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Creator sync error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 200 });
  } catch (error: any) {
    console.error('Creator sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/creators - List creators
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '20');

  let query = supabase
    .from('creators')
    .select('*')
    .eq('status', 'active')
    .order('followers', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.contains('niche', [category]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ creators: data || [] });
}
