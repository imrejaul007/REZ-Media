/**
 * REZ Intelligence Integration Connector
 *
 * Connects Attribution Hub to REZ Intelligence services:
 * - Intent Graph (4050)
 * - Predictive Engine (4059)
 * - RFM Service (4055)
 * - Customer Intelligence (4140)
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

const INTELLIGENCE = {
  intent: process.env.REZ_INTENT_URL || 'http://localhost:4050',
  predictive: process.env.REZ_PREDICTIVE_URL || 'http://localhost:4059',
  rfm: process.env.REZ_RFM_URL || 'http://localhost:4055',
  customer: process.env.REZ_CUSTOMER_URL || 'http://localhost:4140',
};

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

interface IntelHeaders {
  'X-Internal-Token': string;
  'Content-Type': string;
}

const headers: IntelHeaders = {
  'X-Internal-Token': INTERNAL_TOKEN,
  'Content-Type': 'application/json',
};

export interface CustomerIntelligence {
  userId: string;
  churnRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ltvTier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  rfmScore?: { r: number; f: number; m: number };
  intentSignals?: string[];
  nextBestAction?: string;
}

export interface AttributionEvent {
  userId: string;
  event: string;
  channel: string;
  campaign?: string;
  value?: number;
  timestamp: Date;
}

// Send event to Intent Graph
export async function sendToIntent(event: AttributionEvent): Promise<void> {
  try {
    await axios.post(`${INTELLIGENCE.intent}/api/intent`, {
      userId: event.userId,
      event: event.event,
      signals: [event.channel, event.campaign].filter(Boolean),
      timestamp: event.timestamp,
    }, { headers, timeout: 5000 });
    logger.debug('[Intelligence] Intent sent', { userId: event.userId });
  } catch (err) {
    logger.warn('[Intelligence] Intent failed', { error: (err as Error).message });
  }
}

// Get customer intelligence
export async function getCustomerIntelligence(userId: string): Promise<CustomerIntelligence | null> {
  try {
    const [churn, ltv, rfm] = await Promise.allSettled([
      axios.get(`${INTELLIGENCE.predictive}/api/churn/${userId}`, { headers }),
      axios.get(`${INTELLIGENCE.customer}/api/ltv/${userId}`, { headers }),
      axios.get(`${INTELLIGENCE.rfm}/api/rfm/${userId}`, { headers }),
    ]);

    const intelligence: CustomerIntelligence = { userId };

    if (churn.status === 'fulfilled') {
      intelligence.churnRisk = churn.value.data.risk;
    }
    if (ltv.status === 'fulfilled') {
      intelligence.ltvTier = ltv.value.data.tier;
    }
    if (rfm.status === 'fulfilled') {
      intelligence.rfmScore = rfm.value.data.score;
    }

    return intelligence;
  } catch {
    return null;
  }
}

// Get churn prediction
export async function getChurnRisk(userId: string): Promise<string> {
  try {
    const res = await axios.get(`${INTELLIGENCE.predictive}/api/churn/${userId}`, { headers });
    return res.data.risk || 'LOW';
  } catch {
    return 'LOW';
  }
}

// Get LTV prediction
export async function getLTV(userId: string): Promise<number> {
  try {
    const res = await axios.get(`${INTELLIGENCE.customer}/api/ltv/${userId}`, { headers });
    return res.data.ltv || 0;
  } catch {
    return 0;
  }
}

// Get RFM score
export async function getRFMScore(userId: string): Promise<{ r: number; f: number; m: number }> {
  try {
    const res = await axios.get(`${INTELLIGENCE.rfm}/api/score/${userId}`, { headers });
    return res.data.score || { r: 0, f: 0, m: 0 };
  } catch {
    return { r: 0, f: 0, m: 0 };
  }
}

// Get next best action
export async function getNextBestAction(userId: string): Promise<string> {
  try {
    const res = await axios.get(`${INTELLIGENCE.predictive}/api/action/${userId}`, { headers });
    return res.data.action || 'retarget';
  } catch {
    return 'retarget';
  }
}

// Enrich attribution with AI insights
export async function enrichWithAI(event: AttributionEvent): Promise<any> {
  const [intelligence, nextAction] = await Promise.all([
    getCustomerIntelligence(event.userId),
    getNextBestAction(event.userId),
  ]);

  return {
    ...event,
    intelligence,
    recommendedAction: nextAction,
    segment: intelligence?.ltvTier || 'NEW',
    churnRisk: intelligence?.churnRisk || 'LOW',
    rfmScore: intelligence?.rfmScore,
  };
}

export default {
  sendToIntent,
  getCustomerIntelligence,
  getChurnRisk,
  getLTV,
  getRFMScore,
  getNextBestAction,
  enrichWithAI,
};
