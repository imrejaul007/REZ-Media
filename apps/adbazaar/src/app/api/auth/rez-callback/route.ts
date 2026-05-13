import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { getRedis } from '@/lib/redis';

const REZ_AUTH_URL = process.env.REZ_AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const REZ_CLIENT_ID = process.env.REZ_OAUTH_CLIENT_ID || 'adbazaar';
const REZ_CLIENT_SECRET = process.env.REZ_OAUTH_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REZ_OAUTH_REDIRECT_URI || 'https://ad-bazaar.vercel.app/api/auth/rez-callback';

const OAUTH_STATE_TTL = 10 * 60; // 10 minutes

/**
 * GET /api/auth/rez-callback
 * Handles OAuth callback from REZ Auth Service
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      logger.error('[OAuth] Error from REZ:', errorParam);
      return NextResponse.redirect(`/?oauth_error=${encodeURIComponent(errorParam)}`);
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // Validate and retrieve state from Redis (or in-memory fallback)
    let destination = '/';
    const redis = getRedis();
    if (redis) {
      const stored = await redis.get<string>(`oauth:state:${state}`);
      if (!stored) {
        return NextResponse.json({ error: 'Invalid or expired state' }, { status: 400 });
      }
      const parsed = JSON.parse(stored) as { destination?: string };
      destination = parsed.destination || '/';
      await redis.del(`oauth:state:${state}`);
    } else {
      // Fallback: in-memory state validation
      type StateStore = Map<string, { createdAt: number; destination: string | null }>;
      const stateStore = (global as unknown as { adbazaarOAuthState?: StateStore }).adbazaarOAuthState;
      const storedState = stateStore?.get(state);
      if (!storedState || Date.now() - storedState.createdAt > OAUTH_STATE_TTL * 1000) {
        return NextResponse.json({ error: 'Invalid or expired state' }, { status: 400 });
      }
      destination = storedState.destination || '/';
      stateStore?.delete(state);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`${REZ_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: REZ_CLIENT_ID,
        client_secret: REZ_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      logger.error('[OAuth] Token exchange failed:', errText);
      return NextResponse.redirect('/?oauth_error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user_id?: string;
    };

    // Find or create user by external user ID
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    let userId = tokens.user_id;

    if (!userId) {
      logger.error('[OAuth] No user_id in token response');
      return NextResponse.redirect('/?oauth_error=no_user_id');
    }

    // Check if user exists with this external ID
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('external_auth_id', userId)
      .single();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          external_auth_id: userId,
          role: 'user',
        })
        .select('id')
        .single();

      if (createError || !newUser) {
        logger.error('[OAuth] Failed to create user:', createError);
        return NextResponse.redirect('/?oauth_error=user_creation_failed');
      }
      userId = newUser.id;
    }

    // Return tokens to client for session creation
    const response = NextResponse.redirect(`${new URL(req.url).origin}${destination}?oauth_success=1`);
    response.cookies.set('rez_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in,
      path: '/',
    });
    response.cookies.set('rez_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in,
      path: '/',
    });

    return response;
  } catch (err) {
    logger.error('[OAuth] Callback error:', err);
    return NextResponse.redirect('/?oauth_error=callback_error');
  }
}
