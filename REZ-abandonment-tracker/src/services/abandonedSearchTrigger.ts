import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface AbandonedSearch {
  id: string;
  userId: string;
  query: string;
  intentDetected: string;
  resultsShown: string[];
  notClicked: string[];
  timestamp: Date;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  decayScore: number;
  reminderSent: boolean;
  converted: boolean;
  lastDecayCalculation: Date;
  reEngagementAttempts: number;
}

export interface SearchReEngagement {
  abandonmentId: string;
  channel: 'whatsapp' | 'push' | 'sms' | 'email';
  message: string;
  offer?: {
    discount: number;
    coins: number;
    productId: string;
  };
  scheduledAt: Date;
}

interface UserLeadScore {
  userId: string;
  score: number;
  preferredChannel: 'whatsapp' | 'push' | 'sms' | 'email';
  lastEngagement: Date;
  pushEnabled: boolean;
  whatsappOptIn: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
}

interface Offer {
  id: string;
  productId: string;
  discount: number;
  coins: number;
  minLeadScore: number;
  intentMatch: string[];
  expiresAt: Date;
}

// ============================================================================
// In-Memory Storage (Replace with DB in production)
// ============================================================================

const abandonedSearches: Map<string, AbandonedSearch> = new Map();
const userLeadScores: Map<string, UserLeadScore> = new Map();
const availableOffers: Offer[] = [];

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Track when a user abandons a search without clicking any results
 */
export async function trackSearchAbandonment(
  userId: string,
  query: string,
  results: string[],
  intent: string,
  notClicked: string[] = []
): Promise<AbandonedSearch> {
  const now = new Date();

  // Calculate initial urgency based on intent and result count
  const urgency = calculateInitialUrgency(intent, results.length);

  const abandonment: AbandonedSearch = {
    id: uuidv4(),
    userId,
    query,
    intentDetected: intent,
    resultsShown: results,
    notClicked,
    timestamp: now,
    urgency,
    decayScore: 100, // Start at max decay score
    reminderSent: false,
    converted: false,
    lastDecayCalculation: now,
    reEngagementAttempts: 0
  };

  abandonedSearches.set(abandonment.id, abandonment);

  console.log(`[AbandonedSearch] Tracked abandonment for user ${userId}: "${query}" (intent: ${intent}, urgency: ${urgency})`);

  return abandonment;
}

/**
 * Calculate initial urgency based on search intent and results
 */
function calculateInitialUrgency(intent: string, resultCount: number): AbandonedSearch['urgency'] {
  // High-intent searches get higher urgency
  const highIntentPatterns = ['buy', 'order', 'book', 'reservation', 'checkout', 'purchase', '今夜', '今晚', '立即'];
  const mediumIntentPatterns = ['compare', 'review', 'best', 'top', ' cheapest', ' near me'];

  const isHighIntent = highIntentPatterns.some(pattern => intent.toLowerCase().includes(pattern));
  const isMediumIntent = mediumIntentPatterns.some(pattern => intent.toLowerCase().includes(pattern));

  // No results = critical (user needs help finding what they want)
  if (resultCount === 0) {
    return 'critical';
  }

  // High intent + few results = critical
  if (isHighIntent && resultCount < 5) {
    return 'critical';
  }

  // High intent search = high urgency
  if (isHighIntent) {
    return 'high';
  }

  // Medium intent = medium urgency
  if (isMediumIntent) {
    return 'medium';
  }

  // Browse/friendly search = low urgency
  return 'low';
}

/**
 * Calculate decay score - urgency decreases over time
 * Returns updated decay score (0-100, where 100 = just abandoned, 0 = fully decayed)
 */
export function calculateSearchDecay(abandonment: AbandonedSearch): number {
  const now = new Date();
  const hoursSinceLastCalculation = (now.getTime() - abandonment.lastDecayCalculation.getTime()) / (1000 * 60 * 60);

  // Decay rates by urgency level (points per hour)
  const decayRates: Record<AbandonedSearch['urgency'], number> = {
    critical: 8,   // Decays slowest - highest priority
    high: 12,      // 12 points per hour
    medium: 15,    // 15 points per hour
    low: 20        // Decays fastest - lowest priority
  };

  const decayRate = decayRates[abandonment.urgency];
  const decayAmount = hoursSinceLastCalculation * decayRate;

  // Calculate new decay score (floor at 0)
  const newDecayScore = Math.max(0, abandonment.decayScore - decayAmount);

  // Update the abandonment record
  abandonment.decayScore = newDecayScore;
  abandonment.lastDecayCalculation = now;

  console.log(`[Decay] Search ${abandonment.id}: ${abandonment.decayScore.toFixed(1)} (was ${(newDecayScore + decayAmount).toFixed(1)}, -${decayAmount.toFixed(1)})`);

  return newDecayScore;
}

/**
 * Get all abandonments that need re-engagement
 * - Not yet sent a reminder
 * - Older than 2 hours
 * - Has decayed below threshold
 */
export async function getUrgentSearchAbandonments(): Promise<AbandonedSearch[]> {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const urgentAbandonments: AbandonedSearch[] = [];

  for (const abandonment of abandonedSearches.values()) {
    // Skip if already converted or reminder sent
    if (abandonment.converted || abandonment.reminderSent) {
      continue;
    }

    // Skip if not yet 2 hours old
    if (abandonment.timestamp > twoHoursAgo) {
      continue;
    }

    // Calculate current decay
    calculateSearchDecay(abandonment);

    // Skip if not decayed enough (urgency too low)
    // Critical/high need < 60 decay score remaining, medium/low need < 40
    const minDecayThreshold = abandonment.urgency === 'critical' || abandonment.urgency === 'high' ? 60 : 40;
    if (abandonment.decayScore > minDecayThreshold) {
      continue;
    }

    urgentAbandonments.push(abandonment);
  }

  console.log(`[Urgent] Found ${urgentAbandonments.length} searches needing re-engagement`);

  return urgentAbandonments.sort((a, b) => {
    // Sort by urgency (critical first) then by decay score (lower = more urgent)
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return a.decayScore - b.decayScore;
  });
}

/**
 * Determine best channel based on lead score and user preferences
 */
export async function getBestChannel(userId: string): Promise<SearchReEngagement['channel']> {
  const leadScore = await getUserLeadScore(userId);

  // Channel selection based on lead score and preferences
  if (leadScore.preferredChannel) {
    // Verify user is reachable on preferred channel
    if (leadScore.preferredChannel === 'whatsapp' && leadScore.whatsappOptIn) {
      return 'whatsapp';
    }
    if (leadScore.preferredChannel === 'push' && leadScore.pushEnabled) {
      return 'push';
    }
    if (leadScore.preferredChannel === 'sms' && leadScore.phoneVerified) {
      return 'sms';
    }
    if (leadScore.preferredChannel === 'email' && leadScore.emailVerified) {
      return 'email';
    }
  }

  // Fallback to best available channel based on lead score
  if (leadScore.score >= 80 && leadScore.whatsappOptIn) {
    return 'whatsapp'; // High-value customers prefer WhatsApp
  }

  if (leadScore.score >= 60 && leadScore.pushEnabled) {
    return 'push'; // Good engagement → push notification
  }

  if (leadScore.phoneVerified) {
    return 'sms'; // Fallback to SMS
  }

  if (leadScore.emailVerified) {
    return 'email'; // Last resort
  }

  return 'push'; // Default to push
}

/**
 * Get user's lead score and channel preferences
 */
async function getUserLeadScore(userId: string): Promise<UserLeadScore> {
  let leadScore = userLeadScores.get(userId);

  if (!leadScore) {
    // Create default lead score (should be fetched from DB in production)
    leadScore = {
      userId,
      score: 50, // Default medium score
      preferredChannel: 'push',
      lastEngagement: new Date(),
      pushEnabled: true,
      whatsappOptIn: false,
      emailVerified: true,
      phoneVerified: false
    };
    userLeadScores.set(userId, leadScore);
  }

  return leadScore;
}

/**
 * Generate personalized re-engagement message for abandoned search
 */
export function generateSearchMessage(abandonment: AbandonedSearch): string {
  const { query, intentDetected, resultsShown } = abandonment;

  // Templates by intent type
  const templates: Record<string, string[]> = {
    buy: [
      `Still thinking about "${query}"? We have great deals waiting for you!`,
      `Your search for "${query}" found ${resultsShown.length} options. Ready to check them out?`,
      `Don't miss out on "${query}" - your picks are still available!`
    ],
    book: [
      `Planning to book "${query}"? Limited availability - check now!`,
      `Your reservation search for "${query}" is waiting. Secure your spot!`,
      `Ready to complete your booking for "${query}"? We're here to help!`
    ],
    compare: [
      `Comparing options for "${query}"? Get our expert comparison guide!`,
      `Need help deciding on "${query}"? Check out our top recommendations.`,
      `Still researching "${query}"? We've highlighted the best choices for you.`
    ],
    search: [
      `You were looking for "${query}" - found some new matches just for you!`,
      `Good news! New results for "${query}" are now available.`,
      `Your search "${query}" has updated results. Take another look?`
    ]
  };

  // Select template based on intent
  let selectedTemplates = templates.search; // Default
  for (const [intent, templateList] of Object.entries(templates)) {
    if (intentDetected.toLowerCase().includes(intent)) {
      selectedTemplates = templateList;
      break;
    }
  }

  // Pick template based on decay score (lower = longer wait = more urgent message)
  let templateIndex = 0;
  if (abandonment.decayScore < 30) {
    templateIndex = 0; // Most urgent
  } else if (abandonment.decayScore < 50) {
    templateIndex = 1; // Medium urgency
  } else {
    templateIndex = 2; // Friendly reminder
  }

  return selectedTemplates[templateIndex] || selectedTemplates[0];
}

/**
 * Find related offers based on query and detected intent
 */
export async function getRelatedOffers(
  query: string,
  intent: string
): Promise<SearchReEngagement['offer'] | undefined> {
  const queryLower = query.toLowerCase();
  const intentLower = intent.toLowerCase();

  // Find matching offers
  const matchingOffers = availableOffers.filter(offer => {
    // Check if offer is expired
    if (offer.expiresAt < new Date()) {
      return false;
    }

    // Match against query keywords or intent
    const searchText = `${queryLower} ${intentLower}`;
    return offer.intentMatch.some(keyword => searchText.includes(keyword.toLowerCase()));
  });

  if (matchingOffers.length === 0) {
    // Generate default offer based on intent
    const defaultDiscount = intentLower.includes('buy') || intentLower.includes('order') ? 15 : 10;
    const defaultCoins = intentLower.includes('buy') || intentLower.includes('order') ? 50 : 20;

    return {
      discount: defaultDiscount,
      coins: defaultCoins,
      productId: ''
    };
  }

  // Return best matching offer (highest discount for high-intent searches)
  const bestOffer = matchingOffers.reduce((best, current) => {
    return current.discount > best.discount ? current : best;
  });

  return {
    discount: bestOffer.discount,
    coins: bestOffer.coins,
    productId: bestOffer.productId
  };
}

/**
 * Trigger re-engagement for an abandoned search
 */
export async function triggerSearchReEngagement(
  abandonmentId: string
): Promise<SearchReEngagement | null> {
  const abandonment = abandonedSearches.get(abandonmentId);

  if (!abandonment) {
    console.error(`[ReEngagement] Abandonment ${abandonmentId} not found`);
    return null;
  }

  if (abandonment.reminderSent) {
    console.log(`[ReEngagement] Already sent reminder for ${abandonmentId}`);
    return null;
  }

  // Determine best channel
  const channel = await getBestChannel(abandonment.userId);

  // Generate message
  const message = generateSearchMessage(abandonment);

  // Get related offer
  const offer = await getRelatedOffers(abandonment.query, abandonment.intentDetected);

  // Create re-engagement record
  const reEngagement: SearchReEngagement = {
    abandonmentId,
    channel,
    message,
    offer,
    scheduledAt: new Date()
  };

  // Update abandonment record
  abandonment.reminderSent = true;
  abandonment.reEngagementAttempts += 1;
  abandonedSearches.set(abandonmentId, abandonment);

  console.log(`[ReEngagement] Scheduled ${channel} message for abandonment ${abandonmentId}: "${message.substring(0, 50)}..."`);

  // In production, this would trigger the actual message sending
  await sendReEngagementMessage(reEngagement);

  return reEngagement;
}

/**
 * Send the re-engagement message via the appropriate channel
 */
async function sendReEngagementMessage(reEngagement: SearchReEngagement): Promise<boolean> {
  const { channel, message, offer } = reEngagement;

  console.log(`[Send] Sending ${channel} message: "${message}"`);
  if (offer) {
    console.log(`[Send] With offer: ${offer.discount}% off, ${offer.coins} coins`);
  }

  // In production, implement actual sending logic:
  // - WhatsApp: Use WhatsApp Business API
  // - Push: Use FCM/APNs
  // - SMS: Use Twilio/Nexmo
  // - Email: Use SendGrid/AWS SES

  // Simulate successful send
  return true;
}

/**
 * Mark a search as converted when user makes a purchase
 */
export async function markSearchConverted(
  searchId: string,
  purchasedProductId: string
): Promise<boolean> {
  const abandonment = abandonedSearches.get(searchId);

  if (!abandonment) {
    console.error(`[Convert] Search ${searchId} not found`);
    return false;
  }

  abandonment.converted = true;
  abandonedSearches.set(searchId, abandonment);

  console.log(`[Convert] Search ${searchId} converted with product ${purchasedProductId}`);

  // In production: Update analytics, adjust lead score, etc.
  return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Process all pending abandoned searches and trigger re-engagement
 * Called by cron job every 30 minutes
 */
export async function processSearchAbandonments(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const results = {
    processed: 0,
    sent: 0,
    errors: 0
  };

  try {
    const urgentAbandonments = await getUrgentSearchAbandonments();

    for (const abandonment of urgentAbandonments) {
      results.processed++;

      try {
        const reEngagement = await triggerSearchReEngagement(abandonment.id);
        if (reEngagement) {
          results.sent++;
        }
      } catch (error) {
        console.error(`[Process] Error processing abandonment ${abandonment.id}:`, error);
        results.errors++;
      }
    }

    console.log(`[Cron] Processed ${results.processed} abandonments, sent ${results.sent} reminders, ${results.errors} errors`);
  } catch (error) {
    console.error('[Cron] Error in processSearchAbandonments:', error);
    results.errors++;
  }

  return results;
}

/**
 * Get all active (non-converted) abandoned searches for a user
 */
export async function getUserAbandonedSearches(userId: string): Promise<AbandonedSearch[]> {
  const userSearches: AbandonedSearch[] = [];

  for (const abandonment of abandonedSearches.values()) {
    if (abandonment.userId === userId && !abandonment.converted) {
      // Update decay score before returning
      calculateSearchDecay(abandonment);
      userSearches.push(abandonment);
    }
  }

  return userSearches.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Clear old converted/failed abandonments to prevent memory buildup
 * Should be called periodically (e.g., daily)
 */
export async function cleanupOldAbandonments(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  let cleaned = 0;

  for (const [id, abandonment] of abandonedSearches.entries()) {
    if (abandonment.timestamp < cutoffDate && (abandonment.converted || abandonment.reminderSent)) {
      abandonedSearches.delete(id);
      cleaned++;
    }
  }

  console.log(`[Cleanup] Removed ${cleaned} old abandonment records`);
  return cleaned;
}

// ============================================================================
// Cron Job Setup
// ============================================================================

let cronIntervalId: NodeJS.Timeout | null = null;

/**
 * Start the cron job to check for abandoned searches every 30 minutes
 */
export function startSearchAbandonmentCron(): void {
  if (cronIntervalId) {
    console.log('[Cron] Search abandonment cron already running');
    return;
  }

  console.log('[Cron] Starting search abandonment cron (every 30 minutes)');

  // Run immediately on start
  processSearchAbandonments().catch(console.error);

  // Then run every 30 minutes
  cronIntervalId = setInterval(() => {
    processSearchAbandonments().catch(console.error);
  }, 30 * 60 * 1000); // 30 minutes
}

/**
 * Stop the cron job
 */
export function stopSearchAbandonmentCron(): void {
  if (cronIntervalId) {
    clearInterval(cronIntervalId);
    cronIntervalId = null;
    console.log('[Cron] Stopped search abandonment cron');
  }
}

/**
 * Add an offer to the available offers pool
 */
export function addOffer(offer: Offer): void {
  availableOffers.push(offer);
  console.log(`[Offer] Added offer for product ${offer.productId}: ${offer.discount}% off, ${offer.coins} coins`);
}

/**
 * Update user lead score and preferences
 */
export function updateUserLeadScore(
  userId: string,
  updates: Partial<Omit<UserLeadScore, 'userId'>>
): void {
  const current = userLeadScores.get(userId) || {
    userId,
    score: 50,
    preferredChannel: 'push' as const,
    lastEngagement: new Date(),
    pushEnabled: true,
    whatsappOptIn: false,
    emailVerified: false,
    phoneVerified: false
  };

  const updated = { ...current, ...updates };
  userLeadScores.set(userId, updated);
  console.log(`[LeadScore] Updated score for user ${userId}: ${updated.score}`);
}

// ============================================================================
// Health Check
// ============================================================================

export function getAbandonmentStats(): {
  total: number;
  active: number;
  converted: number;
  pending: number;
  byUrgency: Record<string, number>;
} {
  const stats = {
    total: abandonedSearches.size,
    active: 0,
    converted: 0,
    pending: 0,
    byUrgency: { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>
  };

  for (const abandonment of abandonedSearches.values()) {
    stats.byUrgency[abandonment.urgency]++;
    if (abandonment.converted) {
      stats.converted++;
    } else if (abandonment.reminderSent) {
      stats.pending++;
    } else {
      stats.active++;
    }
  }

  return stats;
}
