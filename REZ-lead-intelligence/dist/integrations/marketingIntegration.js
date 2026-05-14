"use strict";
/**
 * Marketing Service Integration (FIXED)
 * Connects Lead Intelligence to Marketing campaigns
 *
 * Features:
 * - Sync hot leads to WhatsApp campaigns
 * - Sync warm leads to push campaigns
 * - Sync cold leads to email campaigns
 * - Auto-trigger based on lead temperature
 * - Personalize offers based on lead score
 *
 * FIXES APPLIED (Agent 16):
 * - Added x-internal-token to all internal service calls
 * - Added retry logic with exponential backoff
 * - Added circuit breaker pattern
 * - Added timeouts to all service calls
 * - Added correlation IDs for tracing
 * - Added event persistence queue
 * - Standardized error handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketingIntegration = exports.MarketingIntegration = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
const LeadIntelligenceService_1 = require("../services/LeadIntelligenceService");
const shared_1 = require("@rez/shared");
// ============================================================================
// Cross-Service Integration Utilities
// ============================================================================
// Circuit breaker state
const circuitState = {
    marketing: { failures: 0, state: 'CLOSED', lastFailure: 0 },
    notification: { failures: 0, state: 'CLOSED', lastFailure: 0 },
};
// Event persistence queue
const eventQueue = new Map();
// Configuration
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000;
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'lead-intelligence-service-token';
// ============================================================================
// Correlation ID Generator
// ============================================================================
function generateCorrelationId() {
    return `li-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
function generateEventId() {
    return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
// ============================================================================
// Circuit Breaker Helpers
// ============================================================================
function recordSuccess(service) {
    const state = circuitState[service];
    state.failures = 0;
    state.state = 'CLOSED';
}
function recordFailure(service) {
    const state = circuitState[service];
    state.failures++;
    state.lastFailure = Date.now();
    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
        state.state = 'OPEN';
    }
}
function canExecute(service) {
    const state = circuitState[service];
    if (state.state === 'CLOSED')
        return true;
    if (state.state === 'OPEN') {
        if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
            state.state = 'HALF_OPEN';
            return true;
        }
        return false;
    }
    return true;
}
// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================
function calculateBackoff(retryCount) {
    const base = 1000;
    const maxDelay = 30000;
    const delay = Math.min(base * Math.pow(2, retryCount), maxDelay);
    // Add jitter (0-25%)
    return Math.floor(delay + delay * Math.random() * 0.25);
}
function isRetryable(error) {
    if (!error.response) {
        // Network errors
        const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'];
        return retryableCodes.includes(error.code || '');
    }
    // HTTP status codes
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.response.status);
}
async function withRetry(fn, options = { maxRetries: MAX_RETRIES, service: 'unknown' }) {
    let lastError;
    for (let attempt = 0; attempt <= (options.maxRetries || MAX_RETRIES); attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            const axiosError = error;
            if (attempt < (options.maxRetries || MAX_RETRIES) && isRetryable(axiosError)) {
                const delay = calculateBackoff(attempt);
                if (options.onRetry) {
                    options.onRetry(attempt + 1, lastError, delay);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            else {
                throw lastError;
            }
        }
    }
    throw lastError;
}
// ============================================================================
// Event Queue Management
// ============================================================================
function queueEvent(type, payload) {
    const eventId = generateEventId();
    eventQueue.set(eventId, { type, payload, timestamp: new Date().toISOString() });
    shared_1.logger.info(`[EventQueue] Queued event ${eventId}`, { type, payloadSize: JSON.stringify(payload).length });
    return eventId;
}
async function flushEventQueue(targetService, endpoint) {
    let sent = 0;
    let failed = 0;
    for (const [eventId, event] of eventQueue.entries()) {
        try {
            const client = axios_1.default.create({
                baseURL: config_1.default.services.marketing,
                timeout: DEFAULT_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Token': INTERNAL_TOKEN,
                    'X-Source-Service': 'lead-intelligence',
                },
            });
            await client.post(endpoint, { eventId, ...event });
            eventQueue.delete(eventId);
            sent++;
        }
        catch (error) {
            failed++;
            // Event stays in queue for next flush
        }
    }
    shared_1.logger.info(`[EventQueue] Flushed to ${targetService}`, { sent, failed, remaining: eventQueue.size });
    return { sent, failed };
}
// ============================================================================
// Marketing Service Client
// ============================================================================
class MarketingServiceClient {
    client;
    correlationId;
    constructor() {
        const baseURL = config_1.default.services.marketing;
        this.correlationId = generateCorrelationId();
        this.client = axios_1.default.create({
            baseURL,
            timeout: DEFAULT_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': INTERNAL_TOKEN,
                'X-Source-Service': 'lead-intelligence',
                'X-Correlation-ID': this.correlationId,
            },
        });
    }
    /**
     * Create a campaign for a lead segment
     */
    async createCampaign(segment, leads) {
        const channelMap = {
            hot: 'whatsapp',
            warm: 'push',
            cold: 'email',
        };
        const channel = channelMap[segment];
        const campaignCorrelationId = generateCorrelationId();
        const makeRequest = async () => {
            // Check circuit breaker
            if (!canExecute('marketing')) {
                // Queue for later
                queueEvent('create-campaign', { segment, leads, channel, correlationId: campaignCorrelationId });
                throw new Error(`Circuit breaker OPEN for marketing service`);
            }
            const response = await this.client.post('/api/v1/campaigns', {
                correlationId: campaignCorrelationId,
                eventId: generateEventId(),
                timestamp: new Date().toISOString(),
                name: `${segment.charAt(0).toUpperCase() + segment.slice(1)} Leads Campaign - ${new Date().toISOString().split('T')[0]}`,
                segment,
                channel,
                leads: leads.map((l) => ({
                    userId: l.userId,
                    score: l.score,
                    temperature: l.temperature,
                })),
                source: 'lead_intelligence_service',
                autoTrigger: true,
                personalization: true,
            });
            recordSuccess('marketing');
            return {
                campaignId: response.data?.campaignId,
                leadsAdded: leads.length,
            };
        };
        try {
            const result = await withRetry(makeRequest, {
                service: 'marketing',
                onRetry: (attempt, error, delay) => {
                    shared_1.logger.warn(`[Marketing] Retry attempt ${attempt}`, { segment, delay, error: error.message });
                    recordFailure('marketing');
                },
            });
            shared_1.logger.info(`[Marketing] Created ${segment} campaign`, {
                campaignId: result.campaignId,
                leadsCount: leads.length,
                correlationId: campaignCorrelationId,
            });
            return result;
        }
        catch (error) {
            shared_1.logger.error(`[Marketing] Failed to create ${segment} campaign`, {
                error: error.message,
                leadsCount: leads.length,
                correlationId: campaignCorrelationId,
            });
            throw error;
        }
    }
    /**
     * Add leads to an existing campaign
     */
    async addLeadsToCampaign(campaignId, leads) {
        const correlationId = generateCorrelationId();
        const makeRequest = async () => {
            if (!canExecute('marketing')) {
                queueEvent('add-leads', { campaignId, leads, correlationId });
                return 0;
            }
            const response = await this.client.post(`/api/v1/campaigns/${campaignId}/leads`, {
                correlationId,
                eventId: generateEventId(),
                timestamp: new Date().toISOString(),
                leads: leads.map((l) => ({
                    userId: l.userId,
                    score: l.score,
                    temperature: l.temperature,
                })),
            });
            recordSuccess('marketing');
            return response.data?.addedCount || 0;
        };
        try {
            return await withRetry(makeRequest, {
                service: 'marketing',
                onRetry: (attempt, error, delay) => {
                    shared_1.logger.warn(`[Marketing] Retry add leads attempt ${attempt}`, { campaignId, delay, error: error.message });
                    recordFailure('marketing');
                },
            });
        }
        catch (error) {
            shared_1.logger.warn('[Marketing] Failed to add leads to campaign', {
                campaignId,
                error: error.message,
            });
            return 0;
        }
    }
    /**
     * Get active campaigns for a segment
     */
    async getActiveCampaigns(segment) {
        const correlationId = generateCorrelationId();
        const makeRequest = async () => {
            if (!canExecute('marketing')) {
                return [];
            }
            const response = await this.client.get('/api/v1/campaigns', {
                params: {
                    segment,
                    status: 'active',
                    source: 'lead_intelligence_service',
                    correlationId,
                },
                headers: {
                    'X-Correlation-ID': correlationId,
                },
            });
            recordSuccess('marketing');
            return response.data?.campaigns?.map((c) => c.campaignId) || [];
        };
        try {
            return await withRetry(makeRequest, { service: 'marketing' });
        }
        catch (error) {
            shared_1.logger.warn('[Marketing] Failed to get active campaigns', {
                segment,
                error: error.message,
            });
            return [];
        }
    }
    /**
     * Sync lead data to marketing for personalization
     */
    async syncLeadData(userId, leadScore) {
        const correlationId = generateCorrelationId();
        const makeRequest = async () => {
            if (!canExecute('marketing')) {
                queueEvent('sync-lead', { userId, leadScore, correlationId });
                return false;
            }
            await this.client.post('/api/v1/leads/sync', {
                correlationId,
                eventId: generateEventId(),
                timestamp: new Date().toISOString(),
                userId,
                temperature: leadScore.temperature,
                score: leadScore.score,
                signals: leadScore.signals,
                recommendedChannel: leadScore.recommendedChannel,
                recommendedAction: leadScore.recommendedAction,
                source: 'lead_intelligence_service',
            });
            recordSuccess('marketing');
            return true;
        };
        try {
            return await withRetry(makeRequest, { service: 'marketing' });
        }
        catch (error) {
            shared_1.logger.warn('[Marketing] Failed to sync lead data', {
                userId,
                error: error.message,
            });
            return false;
        }
    }
    /**
     * Get campaign analytics
     */
    async getCampaignAnalytics(campaignId) {
        const correlationId = generateCorrelationId();
        const makeRequest = async () => {
            if (!canExecute('marketing')) {
                return {};
            }
            const response = await this.client.get(`/api/v1/campaigns/${campaignId}/analytics`, {
                headers: { 'X-Correlation-ID': correlationId },
            });
            recordSuccess('marketing');
            return response.data || {};
        };
        try {
            return await withRetry(makeRequest, { service: 'marketing' });
        }
        catch (error) {
            shared_1.logger.warn('[Marketing] Failed to get campaign analytics', {
                campaignId,
                error: error.message,
            });
            return {};
        }
    }
}
// ============================================================================
// Notification Service Client (FIXED)
// ============================================================================
class NotificationServiceClient {
    client;
    constructor() {
        const baseURL = config_1.default.services.notification;
        this.client = axios_1.default.create({
            baseURL,
            timeout: 10000, // Shorter timeout for notifications
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': INTERNAL_TOKEN,
                'X-Source-Service': 'lead-intelligence',
            },
        });
    }
    /**
     * Send WhatsApp urgent notification
     */
    async sendWhatsAppUrgent(userId, message, metadata = {}) {
        const correlationId = generateCorrelationId();
        const makeRequest = async () => {
            if (!canExecute('notification')) {
                queueEvent('whatsapp-urgent', { userId, message, metadata, correlationId });
                return false;
            }
            const response = await this.client.post('/api/v1/notifications/send', {
                correlationId,
                eventId: generateEventId(),
                timestamp: new Date().toISOString(),
                userId,
                channel: 'whatsapp',
                message,
                metadata: {
                    ...metadata,
                    priority: 'high',
                    source: 'lead_intelligence_reengagement',
                },
            });
            recordSuccess('notification');
            return response.data?.success !== false;
        };
        try {
            return await withRetry(makeRequest, {
                service: 'notification',
                onRetry: (attempt, error, delay) => {
                    shared_1.logger.warn(`[Notification] WhatsApp retry attempt ${attempt}`, { userId, delay, error: error.message });
                    recordFailure('notification');
                },
            });
        }
        catch (error) {
            shared_1.logger.warn('[Notification] Failed to send WhatsApp urgent', {
                userId,
                error: error.message,
            });
            return false;
        }
    }
    /**
     * Send push notification
     */
    async sendPushNotification(userId, title, body, metadata = {}) {
        const correlationId = generateCorrelationId();
        const makeRequest = async () => {
            if (!canExecute('notification')) {
                queueEvent('push-notification', { userId, title, body, metadata, correlationId });
                return false;
            }
            const response = await this.client.post('/api/v1/notifications/send', {
                correlationId,
                eventId: generateEventId(),
                timestamp: new Date().toISOString(),
                userId,
                channel: 'push',
                title,
                body,
                metadata: {
                    ...metadata,
                    source: 'lead_intelligence_reengagement',
                },
            });
            recordSuccess('notification');
            return response.data?.success !== false;
        };
        try {
            return await withRetry(makeRequest, { service: 'notification' });
        }
        catch (error) {
            shared_1.logger.warn('[Notification] Failed to send push notification', {
                userId,
                error: error.message,
            });
            return false;
        }
    }
    /**
     * Send email discovery campaign
     */
    async sendEmailDiscovery(userId, subject, body, metadata = {}) {
        const correlationId = generateCorrelationId();
        const makeRequest = async () => {
            if (!canExecute('notification')) {
                queueEvent('email-discovery', { userId, subject, body, metadata, correlationId });
                return false;
            }
            const response = await this.client.post('/api/v1/notifications/send', {
                correlationId,
                eventId: generateEventId(),
                timestamp: new Date().toISOString(),
                userId,
                channel: 'email',
                subject,
                body,
                metadata: {
                    ...metadata,
                    campaignType: 'discovery',
                    source: 'lead_intelligence_reengagement',
                },
            });
            recordSuccess('notification');
            return response.data?.success !== false;
        };
        try {
            return await withRetry(makeRequest, { service: 'notification' });
        }
        catch (error) {
            shared_1.logger.warn('[Notification] Failed to send email', {
                userId,
                error: error.message,
            });
            return false;
        }
    }
}
// ============================================================================
// Marketing Integration Service
// ============================================================================
class MarketingIntegration {
    marketingClient;
    notificationClient;
    constructor() {
        this.marketingClient = new MarketingServiceClient();
        this.notificationClient = new NotificationServiceClient();
    }
    /**
     * Get circuit breaker status for health checks
     */
    getCircuitBreakerStatus() {
        return {
            marketing: { ...circuitState.marketing },
            notification: { ...circuitState.notification },
        };
    }
    /**
     * Get queued events count
     */
    getQueuedEventsCount() {
        return eventQueue.size;
    }
    /**
     * Flush event queue to services
     */
    async flushEventQueues() {
        await Promise.all([
            flushEventQueue('marketing', '/api/v1/events/batch'),
            flushEventQueue('notification', '/api/v1/notifications/batch'),
        ]);
    }
    /**
     * Sync all leads to marketing campaigns
     * Creates separate campaigns for hot, warm, and cold leads
     */
    async syncLeadsToMarketing() {
        shared_1.logger.info('[MarketingIntegration] Starting lead sync to marketing');
        const errors = [];
        const timestamp = new Date();
        // Get all leads by temperature
        const [hotLeads, warmLeads, coldLeads] = await Promise.all([
            LeadIntelligenceService_1.leadIntelligenceService.detectHotLeads({ limit: 1000 }),
            LeadIntelligenceService_1.leadIntelligenceService.detectWarmLeads({ limit: 1000 }),
            LeadIntelligenceService_1.leadIntelligenceService.detectColdLeads({ limit: 1000 }),
        ]);
        shared_1.logger.info('[MarketingIntegration] Lead counts', {
            hot: hotLeads.length,
            warm: warmLeads.length,
            cold: coldLeads.length,
        });
        // Create campaigns for each segment
        const [hotResult, warmResult, coldResult] = await Promise.all([
            this.createCampaignForSegment('hot', hotLeads),
            this.createCampaignForSegment('warm', warmLeads),
            this.createCampaignForSegment('cold', coldLeads),
        ]);
        // Sync lead data for personalization
        await this.syncAllLeadData([...hotLeads, ...warmLeads, ...coldLeads]);
        const totalProcessed = hotResult.leadsProcessed + warmResult.leadsProcessed + coldResult.leadsProcessed;
        const totalErrors = hotResult.errors.length + warmResult.errors.length + coldResult.errors.length;
        shared_1.logger.info('[MarketingIntegration] Lead sync completed', {
            totalProcessed,
            totalErrors,
            hotCampaign: hotResult.campaignId,
            warmCampaign: warmResult.campaignId,
            coldCampaign: coldResult.campaignId,
        });
        return {
            hotLeads: hotResult,
            warmLeads: warmResult,
            coldLeads: coldResult,
            totalProcessed,
            totalErrors,
            timestamp,
        };
    }
    /**
     * Create campaign for a specific segment
     */
    async createCampaignForSegment(segment, leads) {
        if (leads.length === 0) {
            return {
                success: true,
                leadsProcessed: 0,
                errors: [],
            };
        }
        const errors = [];
        try {
            // Check for existing active campaigns
            const activeCampaigns = await this.marketingClient.getActiveCampaigns(segment);
            if (activeCampaigns.length > 0) {
                // Add to existing campaign
                let totalAdded = 0;
                for (const campaignId of activeCampaigns) {
                    const added = await this.marketingClient.addLeadsToCampaign(campaignId, leads);
                    totalAdded += added;
                }
                return {
                    success: true,
                    campaignId: activeCampaigns[0],
                    leadsProcessed: totalAdded,
                    errors,
                };
            }
            else {
                // Create new campaign
                const result = await this.marketingClient.createCampaign(segment, leads);
                return {
                    success: true,
                    campaignId: result.campaignId,
                    leadsProcessed: result.leadsAdded,
                    errors,
                };
            }
        }
        catch (error) {
            errors.push(`Failed to create ${segment} campaign: ${error.message}`);
            return {
                success: false,
                leadsProcessed: 0,
                errors,
            };
        }
    }
    /**
     * Sync all lead data for personalization
     */
    async syncAllLeadData(leads) {
        const syncPromises = leads.map((lead) => this.marketingClient.syncLeadData(lead.userId, lead));
        await Promise.allSettled(syncPromises);
    }
    /**
     * Get personalized offer for a lead based on their score
     */
    async getPersonalizedOffer(userId) {
        const leadScore = await LeadIntelligenceService_1.leadIntelligenceService.getLeadScore(userId);
        const score = leadScore.score;
        const temperature = leadScore.temperature;
        // Determine offer tier based on score
        let discount;
        let coins;
        let productRecommendation;
        let offerText;
        if (temperature === 'hot' && score >= 90) {
            // Premium hot leads - highest incentives
            discount = 15;
            coins = 500;
            productRecommendation = 'premium_products';
            offerText = `Congratulations! You've earned a 15% exclusive discount and 500 bonus coins. Complete your purchase now!`;
        }
        else if (temperature === 'hot') {
            // Regular hot leads
            discount = 10;
            coins = 300;
            productRecommendation = 'popular_products';
            offerText = `Great news! Enjoy a 10% discount and 300 bonus coins on your next purchase. Hurry, this offer won't last!`;
        }
        else if (temperature === 'warm' && score >= 60) {
            // High warm leads
            discount = 8;
            coins = 150;
            productRecommendation = 'trending_products';
            offerText = `We've missed you! Here's an 8% discount and 150 bonus coins to welcome you back.`;
        }
        else if (temperature === 'warm') {
            // Regular warm leads
            discount = 5;
            coins = 100;
            productRecommendation = 'recommended_products';
            offerText = `Welcome back! Take 5% off your order plus 100 bonus coins on your next purchase.`;
        }
        else {
            // Cold leads - discovery offers
            discount = 0;
            coins = 50;
            productRecommendation = 'new_arrivals';
            offerText = `It's been a while! Here's 50 bonus coins to explore our latest arrivals. First order? Enjoy free shipping!`;
        }
        // Add product-specific recommendations based on abandoned carts
        const abandonedCarts = await LeadIntelligenceService_1.leadIntelligenceService.getAbandonedCarts(userId);
        if (abandonedCarts.length > 0) {
            const latestCart = abandonedCarts[0];
            if (latestCart.items.length > 0) {
                const topItem = latestCart.items.reduce((max, item) => item.price > max.price ? item : max);
                productRecommendation = `cart_item:${topItem.productId}`;
                if (temperature === 'hot') {
                    offerText = `Your cart item "${topItem.name || 'the product'}" is still waiting! Complete your purchase now for ${discount}% off + ${coins} coins.`;
                }
                else if (temperature === 'warm') {
                    offerText = `Don't miss out on "${topItem.name || 'your saved items'}" - ${discount}% off + ${coins} coins if you complete your order today!`;
                }
            }
        }
        // Add abandoned search context
        const abandonedSearches = await LeadIntelligenceService_1.leadIntelligenceService.getAbandonedSearches(userId);
        if (abandonedSearches.length > 0 && temperature !== 'hot') {
            const latestSearch = abandonedSearches[0];
            offerText += ` Looking for "${latestSearch.query}"? We have new arrivals you might love!`;
        }
        return {
            offerText,
            discount,
            coins,
            productRecommendation,
        };
    }
    /**
     * Trigger re-engagement based on lead temperature
     * Routes to appropriate channel: WhatsApp (hot), Push (warm), Email (cold)
     */
    async triggerReEngagement(userId, reason) {
        shared_1.logger.info('[MarketingIntegration] Triggering re-engagement', { userId, reason });
        const leadScore = await LeadIntelligenceService_1.leadIntelligenceService.getLeadScore(userId);
        const temperature = leadScore.temperature;
        // Get personalized offer
        const offer = await this.getPersonalizedOffer(userId);
        if (temperature === 'hot') {
            // High priority - WhatsApp
            await this.sendWhatsAppUrgent(userId, reason, offer);
            shared_1.logger.info('[MarketingIntegration] Sent WhatsApp urgent re-engagement', { userId });
        }
        else if (temperature === 'warm') {
            // Medium priority - Push notification
            await this.sendPushNotification(userId, "Don't miss out!", offer.offerText, { ...offer, reason });
            shared_1.logger.info('[MarketingIntegration] Sent push notification re-engagement', { userId });
        }
        else {
            // Low priority - Email discovery
            await this.sendEmailDiscovery(userId, "We've missed you! Here's something special", offer.offerText, { ...offer, reason });
            shared_1.logger.info('[MarketingIntegration] Sent email discovery re-engagement', { userId });
        }
        // Sync to marketing for tracking
        await this.marketingClient.syncLeadData(userId, leadScore);
    }
    /**
     * Send urgent WhatsApp message to hot lead
     */
    async sendWhatsAppUrgent(userId, reason, offer) {
        const leadScore = await LeadIntelligenceService_1.leadIntelligenceService.getLeadScore(userId);
        const offerData = offer || await this.getPersonalizedOffer(userId);
        const urgentMessage = `[URGENT] ${reason}\n\n${offerData.offerText}\n\nUse code SAVE${offerData.discount} for ${offerData.discount}% off!`;
        return this.notificationClient.sendWhatsAppUrgent(userId, urgentMessage, {
            temperature: 'hot',
            score: leadScore.score,
            offer: offerData,
        });
    }
    /**
     * Send push notification to warm lead
     */
    async sendPushNotification(userId, reason, offer) {
        const leadScore = await LeadIntelligenceService_1.leadIntelligenceService.getLeadScore(userId);
        const offerData = offer || await this.getPersonalizedOffer(userId);
        return this.notificationClient.sendPushNotification(userId, "Don't miss out!", offerData.offerText, {
            temperature: 'warm',
            score: leadScore.score,
            offer: offerData,
            reason,
        });
    }
    /**
     * Send email discovery campaign to cold lead
     */
    async sendEmailDiscovery(userId, reason, offer) {
        const leadScore = await LeadIntelligenceService_1.leadIntelligenceService.getLeadScore(userId);
        const offerData = offer || await this.getPersonalizedOffer(userId);
        const emailBody = `
      <h2>Hi there!</h2>
      <p>${reason}</p>
      <p><strong>${offerData.offerText}</strong></p>
      ${offerData.discount > 0 ? `<p>Use code <strong>SAVE${offerData.discount}</strong> for ${offerData.discount}% off!</p>` : ''}
      ${offerData.coins > 0 ? `<p>You'll also earn <strong>${offerData.coins} bonus coins</strong> on your next purchase!</p>` : ''}
      <p><a href="https://app.example.com/shop">Shop Now</a></p>
    `;
        return this.notificationClient.sendEmailDiscovery(userId, "We've missed you! Here's something special", emailBody, {
            temperature: 'cold',
            score: leadScore.score,
            offer: offerData,
            reason,
        });
    }
    /**
     * Get lead score for a user (convenience method)
     */
    async getLeadScore(userId) {
        return LeadIntelligenceService_1.leadIntelligenceService.getLeadScore(userId);
    }
    /**
     * Detect hot leads (convenience method)
     */
    async detectHotLeads(options) {
        return LeadIntelligenceService_1.leadIntelligenceService.detectHotLeads(options);
    }
    /**
     * Detect warm leads (convenience method)
     */
    async detectWarmLeads(options) {
        return LeadIntelligenceService_1.leadIntelligenceService.detectWarmLeads(options);
    }
    /**
     * Detect cold leads (convenience method)
     */
    async detectColdLeads(options) {
        return LeadIntelligenceService_1.leadIntelligenceService.detectColdLeads(options);
    }
}
exports.MarketingIntegration = MarketingIntegration;
// Export singleton instance
exports.marketingIntegration = new MarketingIntegration();
exports.default = exports.marketingIntegration;
//# sourceMappingURL=marketingIntegration.js.map