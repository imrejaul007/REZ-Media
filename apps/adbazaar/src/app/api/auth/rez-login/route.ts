import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import logger from '@/lib/logger';
import { getRedis } from '@/lib/redis';

const REZ_AUTH_URL = process.env.REZ_AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const REZ_CLIENT_ID = process.env.REZ_OAUTH_CLIENT_ID || 'adbazaar';
const REZ_CLIENT_SECRET = process.env.REZ_OAUTH_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REZ_OAUTH_REDIRECT_URI || 'https://ad-bazaar.vercel.app/api/auth/rez-callback';

const OAUTH_STATE_TTL = 10 * 60; // 10 minutes

/**
 * GET /api/auth/rez-login
 * Initiates OAuth flow with REZ Auth Service
 */
export async function GET(req: NextRequest) {
  try {
    // Check if Redis is configured (Upstash)
    const redis = getRedis();
    if (!redis) {
      logger.warn('[OAuth] Upstash Redis not configured — falling back to in-memory state (single-instance only)');
      // Fallback to in-memory for development (Vercel free tier won't persist global)
      const state = crypto.randomBytes(16).toString('hex');
      const stateStore = (global as any).adbazaarOAuthState || new Map();
      (global as any).adbazaarOAuthState = stateStore;
      stateStore.set(state, { createdAt: Date.now(), destination: req.nextUrl.searchParams.get('dest') });

      const params = new URLSearchParams({
        client_id: REZ_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'profile wallet:read',
        state,
      });

      return NextResponse.redirect(`${REZ_AUTH_URL}/oauth/authorize?${params.toString()}`);
    }

    // Production: use Upstash Redis for state (shared across all Vercel instances)
    const state = crypto.randomBytes(16).toString('hex');
    const destination = req.nextUrl.searchParams.get('dest') || '/';
    await redis.set(`oauth:state:${state}`, JSON.stringify({ destination }), { ex: OAUTH_STATE_TTL });

    const params = new URLSearchParams({
      client_id: REZ_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'profile wallet:read',
      state,
    });

    return NextResponse.redirect(`${REZ_AUTH_URL}/oauth/authorize?${params.toString()}`);
  } catch (error) {
    logger.error('[OAuth] Failed to initiate:', error);
    return NextResponse.json({ error: 'Failed to start OAuth flow' }, { status: 500 });
  }
}
