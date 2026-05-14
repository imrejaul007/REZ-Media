"use strict";
/**
 * Lead Intelligence Service
 * Core business logic for lead scoring, detection, and re-engagement
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadIntelligenceService = exports.LeadIntelligenceService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
const models_1 = require("../models");
const shared_1 = require("@rez/shared");
// ============================================================================
// ReZ Mind Integration
// ============================================================================
class ReZMindClient {
    client;
    baseUrl;
    constructor() {
        this.baseUrl = config_1.default.services.mind || 'https://rez-event-platform.onrender.com';
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    /**
     * Send lead signal event to ReZ Mind for learning
     */
    async sendSignalEvent(event) {
        try {
            const response = await this.client.post('/webhook/lead/signal', {
                ...event,
                source: 'lead_intelligence_service',
                timestamp: new Date().toISOString(),
            });
            return {
                success: response.data?.success !== false,
                correlationId: response.data?.correlationId || response.data?.correlation_id,
            };
        }
        catch (error) {
            shared_1.logger.warn('[ReZ Mind] Failed to send signal event', {
                error: error.message,
                eventType: event.eventType,
                userId: event.userId,
            });
            return { success: false };
        }
    }
    /**
     * Send lead score update to ReZ Mind
     */
    async sendLeadScoreUpdate(userId, score) {
        return this.sendSignalEvent({
            eventType: 'lead_score_updated',
            userId,
            timestamp: new Date(),
            data: {
                temperature: score.temperature,
                score: score.score,
                signals: score.signals,
                recommendedChannel: score.recommendedChannel,
            },
        });
    }
    /**
     * Send abandoned cart event to ReZ Mind
     */
    async sendAbandonedCartEvent(cart) {
        return this.sendSignalEvent({
            eventType: 'abandoned_cart',
            userId: cart.userId,
            timestamp: new Date(),
            data: {
                cartId: cart.cartId,
                totalValue: cart.totalValue,
                itemCount: cart.items.length,
                urgencyLevel: cart.items.length > 3 ? 'high' : cart.totalValue > 100 ? 'high' : 'medium',
            },
        });
    }
    /**
     * Send abandoned search event to ReZ Mind
     */
    async sendAbandonedSearchEvent(search) {
        return this.sendSignalEvent({
            eventType: 'abandoned_search',
            userId: search.userId,
            timestamp: new Date(),
            data: {
                query: search.query,
                resultsCount: search.resultsShown.length,
                intentDetected: search.intentDetected,
                urgencyLevel: search.urgencyLevel,
            },
        });
    }
}
// ============================================================================
// Marketing Service Integration
// ============================================================================
class MarketingServiceClient {
    client;
    constructor() {
        const baseURL = config_1.default.services.marketing || 'https://rez-marketing-service.onrender.com';
        this.client = axios_1.default.create({
            baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    /**
     * Notify marketing service of re-engagement action
     */
    async notifyReEngagement(userId, channel, action) {
        try {
            await this.client.post('/api/v1/engagement/track', {
                userId,
                channel,
                action,
                source: 'lead_intelligence_service',
                timestamp: new Date().toISOString(),
            });
            return { success: true };
        }
        catch (error) {
            shared_1.logger.warn('[Marketing] Failed to notify engagement', {
                error: error.message,
                userId,
                channel,
            });
            return { success: false };
        }
    }
    /**
     * Get campaign recommendations for user segment
     */
    async getCampaignRecommendations(temperature) {
        try {
            const response = await this.client.get(`/api/v1/campaigns/recommend`, {
                params: { segment: temperature },
            });
            return {
                success: true,
                campaigns: response.data?.campaigns,
            };
        }
        catch (error) {
            return { success: false };
        }
    }
}
// ============================================================================
// Notification Service Integration
// ============================================================================
class NotificationServiceClient {
    client;
    constructor() {
        const baseURL = config_1.default.services.notification || 'https://rez-notification-service.onrender.com';
        this.client = axios_1.default.create({
            baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    /**
     * Send notification via specified channel
     */
    async sendNotification(userId, channel, message, metadata = {}) {
        try {
            const payload = {
                userId,
                channel,
                message,
                metadata: {
                    ...metadata,
                    source: 'lead_intelligence_service',
                },
            };
            const response = await this.client.post('/api/v1/notifications/send', payload);
            return {
                success: response.data?.success !== false,
                messageId: response.data?.messageId,
            };
        }
        catch (error) {
            shared_1.logger.warn('[Notification] Failed to send notification', {
                error: error.message,
                userId,
                channel,
            });
            return { success: false };
        }
    }
}
// ============================================================================
// Main Lead Intelligence Service
// ============================================================================
class LeadIntelligenceService {
    rezMind;
    marketing;
    notifications;
    constructor() {
        this.rezMind = new ReZMindClient();
        this.marketing = new MarketingServiceClient();
        this.notifications = new NotificationServiceClient();
    }
    // ==========================================================================
    // Lead Scoring
    // ==========================================================================
    /**
     * Calculate comprehensive lead score for a user
     */
    async getLeadScore(userId) {
        shared_1.logger.info('[LeadIntelligence] Calculating lead score', { userId });
        // Get user activity signals
        const signals = await this.calculateSignals(userId);
        // Calculate individual signal scores
        const signalScores = {
            recentSearches: this.scoreRecentSearches(signals.recentSearches),
            abandonedCarts: this.scoreAbandonedCarts(signals.abandonedCarts),
            viewedProducts: this.scoreViewedProducts(signals.viewedProducts),
            lastActiveHours: this.scoreLastActive(signals.lastActiveHours),
            intentStrength: signals.intentStrength,
            purchaseProbability: signals.purchaseProbability,
        };
        // Calculate weighted total score
        const weights = config_1.default.scoring.weights;
        const score = signalScores.recentSearches * weights.recentSearches +
            signalScores.abandonedCarts * weights.abandonedCarts +
            signalScores.viewedProducts * weights.viewedProducts +
            signalScores.lastActiveHours * weights.lastActiveHours +
            signalScores.intentStrength * weights.intentStrength +
            signalScores.purchaseProbability * weights.purchaseProbability;
        // Determine temperature
        const temperature = this.determineTemperature(score);
        // Determine recommended channel
        const recommendedChannel = await this.getRecommendedChannel(userId);
        // Determine recommended action
        const recommendedAction = this.determineRecommendedAction(temperature, signals);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + config_1.default.cache.leadScoreTTL * 1000);
        const leadScore = {
            userId,
            temperature,
            score: Math.round(score * 100) / 100,
            signals,
            recommendedChannel,
            recommendedAction,
            calculatedAt: now,
            expiresAt,
        };
        // Save/update lead score in database
        await this.saveLeadScore(leadScore);
        // Send to ReZ Mind for learning
        await this.rezMind.sendLeadScoreUpdate(userId, leadScore);
        shared_1.logger.info('[LeadIntelligence] Lead score calculated', {
            userId,
            temperature,
            score: leadScore.score,
            recommendedChannel,
        });
        return leadScore;
    }
    /**
     * Calculate signals from user activity
     */
    async calculateSignals(userId) {
        // Get cached activity data
        const activityCache = await models_1.UserActivityCacheModel.findOne({ userId });
        if (!activityCache) {
            return {
                recentSearches: 0,
                abandonedCarts: 0,
                viewedProducts: 0,
                lastActiveHours: 0,
                intentStrength: 0,
                purchaseProbability: 0,
            };
        }
        // Calculate recent searches (last 24 hours)
        const recentSearches = activityCache.searches.filter((s) => new Date(s.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000).length;
        // Get abandoned cart count
        const abandonedCarts = await models_1.AbandonedCartModel.countDocuments({
            userId,
            recovered: false,
            abandonedAt: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        });
        // Calculate viewed products
        const viewedProducts = activityCache.views.filter((v) => new Date(v.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000).length;
        // Calculate hours since last active
        const lastActiveHours = activityCache.lastActive
            ? Math.round((Date.now() - new Date(activityCache.lastActive).getTime()) / (1000 * 60 * 60))
            : 999;
        // Calculate intent strength based on search patterns
        const intentStrength = this.calculateIntentStrength(activityCache);
        // Calculate purchase probability
        const purchaseProbability = await this.predictPurchaseProbability(userId, activityCache);
        return {
            recentSearches,
            abandonedCarts,
            viewedProducts,
            lastActiveHours,
            intentStrength,
            purchaseProbability,
        };
    }
    /**
     * Calculate intent strength based on search behavior
     */
    calculateIntentStrength(activityCache) {
        if (!activityCache.searches || activityCache.searches.length === 0) {
            return 0;
        }
        const searches = activityCache.searches;
        let strength = 0;
        // Factor 1: Number of searches (more searches = higher intent)
        strength += Math.min(searches.length * 0.1, 0.3);
        // Factor 2: Search refinement (user searching again for similar terms = higher intent)
        const uniqueQueries = new Set(searches.map((s) => s.query.toLowerCase()));
        const refinementBonus = searches.length > uniqueQueries.size ? 0.2 : 0;
        strength += refinementBonus;
        // Factor 3: Results clicked vs shown (engagement ratio)
        const totalShown = searches.reduce((sum, s) => sum + (s.resultsCount || 0), 0);
        const totalClicked = searches.reduce((sum, s) => sum + (s.clickedResults?.length || 0), 0);
        if (totalShown > 0) {
            strength += Math.min((totalClicked / totalShown) * 0.3, 0.3);
        }
        // Factor 4: Intent detected
        const hasStrongIntent = searches.some((s) => s.intentDetected && ['buy', 'purchase', 'order', 'price'].includes(s.intentDetected.toLowerCase()));
        if (hasStrongIntent) {
            strength += 0.2;
        }
        return Math.min(strength, 1);
    }
    /**
     * Predict purchase probability using ML model or heuristic fallback
     */
    async predictPurchaseProbability(userId, activityCache) {
        try {
            // Try to call ML model server
            const response = await axios_1.default.post(`${config_1.default.ml.modelServer}/predict/purchase`, {
                userId,
                features: {
                    viewCount: activityCache.views?.length || 0,
                    searchCount: activityCache.searches?.length || 0,
                    cartAddCount: activityCache.cartActions?.filter((a) => a.action === 'add').length || 0,
                    sessionCount: activityCache.sessionCount || 1,
                    lastActiveHours: activityCache.lastActive
                        ? (Date.now() - new Date(activityCache.lastActive).getTime()) / (1000 * 60 * 60)
                        : 999,
                },
            }, {
                timeout: 3000,
            });
            return response.data?.probability || this.heuristicPurchaseProbability(activityCache);
        }
        catch {
            // Fallback to heuristic
            return this.heuristicPurchaseProbability(activityCache);
        }
    }
    /**
     * Heuristic-based purchase probability calculation
     */
    heuristicPurchaseProbability(activityCache) {
        let probability = 0.1; // Base probability
        // Cart additions increase probability significantly
        const cartAdds = activityCache.cartActions?.filter((a) => a.action === 'add').length || 0;
        probability += Math.min(cartAdds * 0.15, 0.45);
        // Multiple product views increase probability
        const views = activityCache.views?.length || 0;
        probability += Math.min(views * 0.05, 0.25);
        // Active searchers are more likely to purchase
        const searches = activityCache.searches?.length || 0;
        probability += Math.min(searches * 0.03, 0.15);
        // Recent activity is better
        if (activityCache.lastActive) {
            const hoursSinceActive = (Date.now() - new Date(activityCache.lastActive).getTime()) / (1000 * 60 * 60);
            if (hoursSinceActive < 24) {
                probability += 0.1;
            }
            else if (hoursSinceActive < 72) {
                probability += 0.05;
            }
        }
        return Math.min(probability, 1);
    }
    /**
     * Score recent searches (0-100)
     */
    scoreRecentSearches(count) {
        if (count === 0)
            return 0;
        if (count <= 2)
            return 30;
        if (count <= 5)
            return 60;
        if (count <= 10)
            return 80;
        return 100;
    }
    /**
     * Score abandoned carts (0-100)
     */
    scoreAbandonedCarts(count) {
        if (count === 0)
            return 0;
        if (count === 1)
            return 70; // Has cart but abandoned
        if (count === 2)
            return 85;
        return 100; // Multiple carts = high intent
    }
    /**
     * Score viewed products (0-100)
     */
    scoreViewedProducts(count) {
        if (count === 0)
            return 0;
        if (count <= 3)
            return 30;
        if (count <= 7)
            return 60;
        if (count <= 15)
            return 80;
        return 100;
    }
    /**
     * Score last active hours (0-100, recent = higher)
     */
    scoreLastActive(hours) {
        if (hours <= 1)
            return 100;
        if (hours <= 6)
            return 80;
        if (hours <= 24)
            return 60;
        if (hours <= 72)
            return 30;
        if (hours <= 168)
            return 15; // 7 days
        return 0;
    }
    /**
     * Determine temperature based on score
     */
    determineTemperature(score) {
        if (score >= config_1.default.thresholds.hot)
            return 'hot';
        if (score >= config_1.default.thresholds.warm)
            return 'warm';
        return 'cold';
    }
    /**
     * Save lead score to database
     */
    async saveLeadScore(leadScore) {
        await models_1.LeadScoreModel.findOneAndUpdate({ userId: leadScore.userId }, {
            userId: leadScore.userId,
            temperature: leadScore.temperature,
            score: leadScore.score,
            signals: leadScore.signals,
            recommendedChannel: leadScore.recommendedChannel,
            recommendedAction: leadScore.recommendedAction,
            calculatedAt: leadScore.calculatedAt,
            expiresAt: leadScore.expiresAt,
        }, { upsert: true, new: true });
    }
    // ==========================================================================
    // Lead Detection
    // ==========================================================================
    /**
     * Detect all hot leads
     */
    async detectHotLeads(options = {}) {
        const { limit = 100, offset = 0 } = options;
        shared_1.logger.info('[LeadIntelligence] Detecting hot leads', { limit, offset });
        const leads = await models_1.LeadScoreModel.find({
            temperature: 'hot',
            expiresAt: { $gt: new Date() },
        })
            .sort({ score: -1 })
            .skip(offset)
            .limit(limit)
            .lean();
        shared_1.logger.info('[LeadIntelligence] Hot leads detected', { count: leads.length });
        return leads;
    }
    /**
     * Detect all warm leads
     */
    async detectWarmLeads(options = {}) {
        const { limit = 100, offset = 0 } = options;
        shared_1.logger.info('[LeadIntelligence] Detecting warm leads', { limit, offset });
        const leads = await models_1.LeadScoreModel.find({
            temperature: 'warm',
            expiresAt: { $gt: new Date() },
        })
            .sort({ score: -1 })
            .skip(offset)
            .limit(limit)
            .lean();
        shared_1.logger.info('[LeadIntelligence] Warm leads detected', { count: leads.length });
        return leads;
    }
    /**
     * Detect all cold leads
     */
    async detectColdLeads(options = {}) {
        const { limit = 100, offset = 0 } = options;
        shared_1.logger.info('[LeadIntelligence] Detecting cold leads', { limit, offset });
        const leads = await models_1.LeadScoreModel.find({
            temperature: 'cold',
            expiresAt: { $gt: new Date() },
        })
            .sort({ score: -1 })
            .skip(offset)
            .limit(limit)
            .lean();
        shared_1.logger.info('[LeadIntelligence] Cold leads detected', { count: leads.length });
        return leads;
    }
    // ==========================================================================
    // Abandoned Cart Tracking
    // ==========================================================================
    /**
     * Track an abandoned cart
     */
    async trackAbandonedCart(userId, cartId, items, totalValue) {
        shared_1.logger.info('[LeadIntelligence] Tracking abandoned cart', { userId, cartId, totalValue });
        const expiresAt = new Date(Date.now() + config_1.default.reEngagement.cartExpiryHours * 60 * 60 * 1000);
        const abandonedCart = await models_1.AbandonedCartModel.findOneAndUpdate({ cartId }, {
            userId,
            cartId,
            items,
            totalValue,
            abandonedAt: new Date(),
            reminderCount: 0,
            recovered: false,
            expiresAt,
        }, { upsert: true, new: true });
        // Update user activity cache
        await this.updateUserActivityCache(userId, { cartActions: items.map((i) => ({ action: 'add', productId: i.productId, quantity: i.quantity })) });
        // Send to ReZ Mind for learning
        await this.rezMind.sendAbandonedCartEvent(abandonedCart);
        // Recalculate lead score
        await this.getLeadScore(userId);
        shared_1.logger.info('[LeadIntelligence] Abandoned cart tracked', {
            userId,
            cartId,
            itemCount: items.length,
            totalValue,
        });
        return abandonedCart;
    }
    /**
     * Get all abandoned carts for a user
     */
    async getAbandonedCarts(userId) {
        return models_1.AbandonedCartModel.find({
            userId,
            recovered: false,
            expiresAt: { $gt: new Date() },
        }).lean();
    }
    /**
     * Mark cart as recovered
     */
    async markCartRecovered(cartId) {
        await models_1.AbandonedCartModel.findOneAndUpdate({ cartId }, {
            recovered: true,
            recoveredAt: new Date(),
        });
    }
    // ==========================================================================
    // Abandoned Search Tracking
    // ==========================================================================
    /**
     * Track an abandoned search
     */
    async trackAbandonedSearch(userId, query, resultsShown, notClicked, intentDetected = '', urgencyLevel = 'low') {
        shared_1.logger.info('[LeadIntelligence] Tracking abandoned search', {
            userId,
            query,
            resultCount: resultsShown.length,
            notClickedCount: notClicked.length,
        });
        const abandonedSearch = new models_1.AbandonedSearchModel({
            userId,
            query,
            resultsShown,
            notClicked,
            timestamp: new Date(),
            intentDetected,
            urgencyLevel,
            reEngaged: false,
            reEngagementAttempts: 0,
        });
        await abandonedSearch.save();
        // Update user activity cache
        await this.updateUserActivityCache(userId, {
            searches: [{ query, resultsCount: resultsShown.length, clickedResults: [], intentDetected }],
        });
        // Send to ReZ Mind for learning
        await this.rezMind.sendAbandonedSearchEvent(abandonedSearch);
        // Recalculate lead score
        await this.getLeadScore(userId);
        shared_1.logger.info('[LeadIntelligence] Abandoned search tracked', {
            userId,
            query,
            intentDetected,
            urgencyLevel,
        });
        return abandonedSearch.toObject();
    }
    /**
     * Get all abandoned searches for a user
     */
    async getAbandonedSearches(userId) {
        return models_1.AbandonedSearchModel.find({
            userId,
            reEngaged: false,
        }).lean();
    }
    /**
     * Mark search as re-engaged
     */
    async markSearchReEngaged(searchId) {
        await models_1.AbandonedSearchModel.findByIdAndUpdate(searchId, {
            reEngaged: true,
            $inc: { reEngagementAttempts: 1 },
        });
    }
    // ==========================================================================
    // Channel Selection
    // ==========================================================================
    /**
     * Get recommended channel for user
     */
    async getRecommendedChannel(userId) {
        const channelScores = await this.getChannelScores(userId);
        if (channelScores.length === 0) {
            return 'email'; // Default fallback
        }
        // Return the highest scoring channel
        const bestChannel = channelScores.reduce((best, current) => current.score > best.score ? current : best);
        return bestChannel.channel;
    }
    /**
     * Get channel scores for user
     */
    async getChannelScores(userId) {
        // Get channel preferences
        const preferences = await models_1.ChannelPreferenceModel.findOne({ userId });
        // Get lead score for context
        const leadScore = await models_1.LeadScoreModel.findOne({ userId });
        const score = leadScore?.score || 50;
        const urgencyLevel = leadScore?.temperature === 'hot' ? 'high' : leadScore?.temperature === 'warm' ? 'medium' : 'low';
        const channels = ['whatsapp', 'push', 'sms', 'email'];
        const scores = [];
        for (const channel of channels) {
            // Check if channel is enabled for user
            const isEnabled = preferences
                ? preferences[channel]
                : true;
            if (!isEnabled) {
                continue;
            }
            const weights = config_1.default.channelWeights[channel];
            const factors = [];
            // Calculate engagement factor
            const engagementScore = (weights.engagementRate * 100) / 0.35; // Normalize to 0-100
            factors.push({ name: 'engagementRate', weight: 0.3, value: engagementScore });
            // Calculate conversion factor
            const conversionScore = (weights.conversionRate * 100) / 0.30;
            factors.push({ name: 'conversionRate', weight: 0.3, value: conversionScore });
            // Calculate urgency factor
            let urgencyScore = 50;
            if (urgencyLevel === 'high' && channel === 'whatsapp')
                urgencyScore = 100;
            else if (urgencyLevel === 'high' && channel === 'push')
                urgencyScore = 90;
            else if (urgencyLevel === 'medium')
                urgencyScore = 70;
            factors.push({ name: 'urgency', weight: 0.4, value: urgencyScore });
            // Calculate overall score
            const channelScore = factors.reduce((sum, f) => sum + f.value * f.weight, 0) * (score / 100);
            scores.push({
                channel,
                score: Math.round(channelScore * 100) / 100,
                factors,
            });
        }
        return scores.sort((a, b) => b.score - a.score);
    }
    // ==========================================================================
    // Re-Engagement
    // ==========================================================================
    /**
     * Trigger re-engagement for a user
     */
    async triggerReEngagement(userId) {
        shared_1.logger.info('[LeadIntelligence] Triggering re-engagement', { userId });
        // Get lead score
        let leadScore = await models_1.LeadScoreModel.findOne({ userId });
        if (!leadScore) {
            leadScore = await this.getLeadScore(userId);
        }
        // Get recommended channel
        const channel = await this.getRecommendedChannel(userId);
        // Generate personalized message
        const message = this.generateReEngagementMessage(userId, leadScore, channel);
        // Check if user should be re-engaged (respect cooldown)
        const lastEngagement = await models_1.EngagementActionModel.findOne({ userId })
            .sort({ sentAt: -1 });
        if (lastEngagement) {
            const hoursSinceLastEngagement = (Date.now() - new Date(lastEngagement.sentAt).getTime()) / (1000 * 60 * 60);
            const minInterval = this.getMinIntervalForTemperature(leadScore.temperature);
            if (hoursSinceLastEngagement < minInterval) {
                shared_1.logger.info('[LeadIntelligence] Skipping re-engagement - cooldown period', {
                    userId,
                    hoursSinceLastEngagement,
                    minInterval,
                });
                return {
                    userId,
                    success: false,
                    channel,
                    action: 'cooldown',
                    message: 'User is in cooldown period',
                    sentAt: new Date(),
                };
            }
        }
        // Send notification
        const notificationResult = await this.notifications.sendNotification(userId, channel, message, {
            leadScore: leadScore.score,
            temperature: leadScore.temperature,
            action: leadScore.recommendedAction,
        });
        // Record engagement action
        const engagementAction = new models_1.EngagementActionModel({
            userId,
            channel,
            actionType: this.getActionType(leadScore.temperature),
            message,
            sentAt: new Date(),
            delivered: notificationResult.success,
        });
        await engagementAction.save();
        // Notify marketing service
        await this.marketing.notifyReEngagement(userId, channel, leadScore.recommendedAction);
        // Send to ReZ Mind
        await this.rezMind.sendSignalEvent({
            eventType: 're_engagement_sent',
            userId,
            timestamp: new Date(),
            data: {
                channel,
                action: leadScore.recommendedAction,
                success: notificationResult.success,
            },
        });
        shared_1.logger.info('[LeadIntelligence] Re-engagement triggered', {
            userId,
            channel,
            success: notificationResult.success,
        });
        return {
            userId,
            success: notificationResult.success,
            channel,
            action: leadScore.recommendedAction,
            message,
            sentAt: new Date(),
        };
    }
    /**
     * Generate personalized re-engagement message
     */
    generateReEngagementMessage(userId, leadScore, channel) {
        const templates = {
            hot: {
                whatsapp: "Hi! We noticed you were interested in some items. They're still available - complete your purchase now and get 10% off!",
                push: "Complete your purchase now and save 10%!",
                sms: "Your cart items are waiting! Use code SAVE10 for 10% off. Valid for 24 hours.",
                email: "Complete Your Purchase - 10% Off Exclusive Offer",
            },
            warm: {
                whatsapp: "Hi! Just a reminder - you left some items in your cart. They might be selling out soon!",
                push: "Don't miss out! Your cart items are still available.",
                sms: "Reminder: Items in your cart are waiting. Check them out!",
                email: "You Left Something Behind - Complete Your Purchase",
            },
            cold: {
                whatsapp: "Hi there! We miss you! Here's a special offer - 15% off your next order.",
                push: "We have something special for you!",
                sms: "Hey! Use code WELCOME15 for 15% off your next order.",
                email: "We Miss You - Here's 15% Off Your Next Order",
            },
        };
        return templates[leadScore.temperature][channel];
    }
    /**
     * Get action type based on temperature
     */
    getActionType(temperature) {
        const actionTypes = {
            hot: 'cart_recovery',
            warm: 'browse_reminder',
            cold: 'loyalty_offer',
        };
        return actionTypes[temperature];
    }
    /**
     * Get minimum re-engagement interval based on temperature
     */
    getMinIntervalForTemperature(temperature) {
        const intervals = {
            hot: config_1.default.reEngagement.hotLeadsIntervalHours,
            warm: config_1.default.reEngagement.warmLeadsIntervalHours,
            cold: config_1.default.reEngagement.coldLeadsIntervalHours,
        };
        return intervals[temperature];
    }
    // ==========================================================================
    // User Activity Management
    // ==========================================================================
    /**
     * Update user activity cache
     */
    async updateUserActivityCache(userId, updates) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        const updateOps = {
            lastActive: now,
            expiresAt,
            $inc: updates.searches || updates.views || updates.cartActions ? { sessionCount: 1 } : {},
        };
        if (updates.searches) {
            updateOps.$push = { searches: { $each: updates.searches } };
        }
        if (updates.views) {
            updateOps.$push = { ...updateOps.$push, views: { $each: updates.views } };
        }
        if (updates.cartActions) {
            updateOps.$push = { ...updateOps.$push, cartActions: { $each: updates.cartActions } };
        }
        await models_1.UserActivityCacheModel.findOneAndUpdate({ userId }, updateOps, { upsert: true, new: true });
    }
    /**
     * Track user activity
     */
    async trackUserActivity(userId, activityType, data) {
        const updates = {};
        if (activityType === 'search') {
            updates.searches = [{
                    query: data.query,
                    resultsCount: data.resultsCount || 0,
                    clickedResults: data.clickedResults || [],
                    intentDetected: data.intentDetected,
                }];
        }
        else if (activityType === 'view') {
            updates.views = [{
                    productId: data.productId,
                    productName: data.productName,
                    category: data.category,
                    durationSeconds: data.durationSeconds,
                    addedToCart: !!(data.addedToCart),
                }];
        }
        else if (activityType === 'cart') {
            updates.cartActions = [{
                    action: data.action,
                    productId: data.productId,
                    quantity: data.quantity,
                }];
        }
        await this.updateUserActivityCache(userId, updates);
    }
    // ==========================================================================
    // Batch Operations
    // ==========================================================================
    /**
     * Process all hot leads for re-engagement
     */
    async processHotLeadsBatch() {
        const hotLeads = await this.detectHotLeads({ limit: 1000 });
        let successful = 0;
        for (const lead of hotLeads) {
            const result = await this.triggerReEngagement(lead.userId);
            if (result.success)
                successful++;
        }
        return { processed: hotLeads.length, successful };
    }
    /**
     * Process abandoned carts for recovery
     */
    async processAbandonedCartsBatch() {
        const carts = await models_1.AbandonedCartModel.find({
            recovered: false,
            expiresAt: { $gt: new Date() },
            reminderCount: { $lt: config_1.default.reEngagement.maxAttempts },
        }).limit(100);
        let recovered = 0;
        for (const cart of carts) {
            // Check if enough time has passed since last reminder
            if (cart.lastReminderSent) {
                const hoursSinceReminder = (Date.now() - new Date(cart.lastReminderSent).getTime()) / (1000 * 60 * 60);
                if (hoursSinceReminder < config_1.default.reEngagement.minIntervalHours) {
                    continue;
                }
            }
            // Trigger re-engagement
            const result = await this.triggerReEngagement(cart.userId);
            if (result.success) {
                await models_1.AbandonedCartModel.findByIdAndUpdate(cart._id, {
                    lastReminderSent: new Date(),
                    $inc: { reminderCount: 1 },
                });
            }
            if (result.success)
                recovered++;
        }
        return { processed: carts.length, recovered };
    }
}
exports.LeadIntelligenceService = LeadIntelligenceService;
// Export singleton instance
exports.leadIntelligenceService = new LeadIntelligenceService();
exports.default = exports.leadIntelligenceService;
//# sourceMappingURL=LeadIntelligenceService.js.map