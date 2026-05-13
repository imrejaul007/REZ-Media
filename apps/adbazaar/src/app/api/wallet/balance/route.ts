import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import logger from '@/lib/logger';

const REZ_AUTH_URL = process.env.REZ_AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const REZ_WALLET_URL = process.env.REZ_WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const INTERNAL_TOKEN = process.env.ADBAZAAR_INTERNAL_KEY || '';

/**
 * GET /api/wallet/balance
 * Returns the REZ wallet balance for the authenticated AdBazaar user.
 * Requires REZ OAuth2 login (rez_access_token stored in Supabase).
 *
 * Flow:
 * 1. Get user's REZ access token from Supabase
 * 2. Get user's REZ user ID via /oauth/userinfo
 * 3. Fetch wallet balance via wallet-service internal endpoint
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate via Supabase session
    const authHeader = req.headers.get('authorization') ?? '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: sessionUser, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !sessionUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's REZ credentials from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, rez_user_id, rez_access_token, rez_token_expires_at')
      .eq('id', sessionUser.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has linked REZ account
    if (!userData.rez_user_id || !userData.rez_access_token) {
      return NextResponse.json({
        linked: false,
        error: 'REZ account not linked. Please login via REZ OAuth.',
      }, { status: 200 });
    }

    // Check if token is expired
    const tokenExpiry = userData.rez_token_expires_at ? new Date(userData.rez_token_expires_at) : null;
    if (tokenExpiry && tokenExpiry.getTime() < Date.now()) {
      return NextResponse.json({
        linked: true,
        token_expired: true,
        error: 'REZ token expired. Please re-authenticate.',
      }, { status: 200 });
    }

    // Get REZ user info to confirm identity
    const userInfoRes = await fetch(`${REZ_AUTH_URL}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${userData.rez_access_token}` },
    });

    if (!userInfoRes.ok) {
      logger.warn('[wallet] REZ userinfo failed', { status: userInfoRes.status, userId: userData.id });
      return NextResponse.json({
        linked: true,
        error: 'Failed to verify REZ account. Please re-authenticate.',
      }, { status: 200 });
    }

    const userInfo = await userInfoRes.json() as { sub: string; phone: string; name: string };
    const rezUserId = userInfo.sub;

    // Fetch wallet balance from REZ Wallet Service
    if (!REZ_WALLET_URL) {
      return NextResponse.json({ error: 'REZ Wallet Service not configured' }, { status: 503 });
    }

    const walletRes = await fetch(`${REZ_WALLET_URL}/internal/balance/${rezUserId}`, {
      headers: {
        'x-internal-token': INTERNAL_TOKEN,
        'x-internal-service': 'adBazaar',
      },
    });

    if (!walletRes.ok) {
      logger.warn('[wallet] Balance fetch failed', { status: walletRes.status, rezUserId });
      return NextResponse.json({ error: 'Failed to fetch wallet balance' }, { status: 502 });
    }

    const walletData = await walletRes.json();

    return NextResponse.json({
      linked: true,
      user: { sub: rezUserId, phone: userInfo.phone, name: userInfo.name },
      wallet: walletData,
    });
  } catch (e) {
    logger.error('[wallet] Balance route error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
