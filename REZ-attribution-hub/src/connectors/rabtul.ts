/**
 * RABTUL Integration Connector
 *
 * Connects Attribution Hub to RABTUL services:
 * - Auth (4002) - User verification
 * - Profile (4001) - User profiles
 * - Wallet (4004) - Loyalty/coins
 * - Order (4006) - Transaction data
 * - Payment (4001) - Payment status
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

// RABTUL Service URLs
const RABTUL = {
  auth: process.env.RABTUL_AUTH_URL || 'http://localhost:4002',
  profile: process.env.RABTUL_PROFILE_URL || 'http://localhost:4001',
  wallet: process.env.RABTUL_WALLET_URL || 'http://localhost:4004',
  order: process.env.RABTUL_ORDER_URL || 'http://localhost:4006',
};

// Internal token for RABTUL
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

interface RABTULHeaders {
  'X-Internal-Token': string;
  'Content-Type': string;
}

const headers: RABTULHeaders = {
  'X-Internal-Token': INTERNAL_TOKEN,
  'Content-Type': 'application/json',
};

export async function verifyUser(userId: string): Promise<boolean> {
  try {
    const res = await axios.get(`${RABTUL.auth}/api/users/${userId}/verify`, { headers });
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function getUserProfile(userId: string): Promise<any> {
  try {
    const res = await axios.get(`${RABTUL.profile}/api/profiles/${userId}`, { headers });
    return res.data;
  } catch {
    return null;
  }
}

export async function getUserWallet(userId: string): Promise<any> {
  try {
    const res = await axios.get(`${RABTUL.wallet}/api/wallets/${userId}`, { headers });
    return res.data;
  } catch {
    return null;
  }
}

export async function getUserOrders(userId: string, limit = 10): Promise<any[]> {
  try {
    const res = await axios.get(`${RABTUL.order}/api/orders`, {
      headers,
      params: { userId, limit },
    });
    return res.data.orders || [];
  } catch {
    return [];
  }
}

export async function getUserTransactions(userId: string): Promise<any[]> {
  try {
    const res = await axios.get(`${RABTUL.order}/api/transactions`, {
      headers,
      params: { userId },
    });
    return res.data.transactions || [];
  } catch {
    return [];
  }
}

export async function trackRABTULAttribution(userId: string, event: string, data: any): Promise<void> {
  logger.info('[RABTUL] Attribution event', { userId, event });

  try {
    // Forward to RABTUL analytics
    await axios.post(`${RABTUL.auth}/api/events`, {
      userId,
      event,
      data,
      source: 'attribution-hub',
    }, { headers }).catch(() => {});
  } catch {
    // Non-blocking
  }
}

export async function enrichAttributionEvent(event: any): Promise<any> {
  const enriched = { ...event };

  if (event.userId) {
    try {
      const [profile, wallet, orders] = await Promise.all([
        getUserProfile(event.userId).catch(() => null),
        getUserWallet(event.userId).catch(() => null),
        getUserOrders(event.userId, 5).catch(() => []),
      ]);

      enriched.userProfile = profile;
      enriched.wallet = wallet;
      enriched.recentOrders = orders;
      enriched.loyaltyTier = wallet?.tier || 'new';
    } catch {
      // Non-blocking enrichment
    }
  }

  return enriched;
}

export default {
  verifyUser,
  getUserProfile,
  getUserWallet,
  getUserOrders,
  getUserTransactions,
  trackRABTULAttribution,
  enrichAttributionEvent,
};
