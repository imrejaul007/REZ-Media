import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  AICheckType,
  AICheckConfig,
  AICheckResult,
  AICheckContext,
  AIModel,
  BUILT_IN_CHECKS,
  AICheckTestResult
} from '../types';
import { logger } from '../utils/logger';

/**
 * Configuration for the AI Check service
 */
interface AICheckServiceConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  defaultModel?: AIModel;
  timeout?: number;
  enableCache?: boolean;
}

/**
 * AI Check Service
 * Evaluates AI-based conditions for journey decisions
 */
export class AICheckService {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private config: Required<AICheckServiceConfig>;
  private cache: Map<string, { result: AICheckResult; timestamp: number }> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(config: AICheckServiceConfig = {}) {
    this.config = {
      anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY || '',
      defaultModel: config.defaultModel || 'claude',
      timeout: config.timeout || 30000,
      enableCache: config.enableCache ?? true,
    };
  }

  /**
   * Initialize the service with API clients
   */
  async initialize(): Promise<void> {
    if (this.anthropic && this.openai) return;

    if (this.config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: this.config.anthropicApiKey,
      });
      logger.info('AI Check Service initialized with Anthropic Claude');
    }

    if (this.config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: this.config.openaiApiKey,
      });
      logger.info('AI Check Service initialized with OpenAI');
    }

    if (!this.anthropic && !this.openai) {
      logger.warn('AI Check Service running without AI - using mock responses');
    }
  }

  /**
   * Generate a cache key for the check
   */
  private generateCacheKey(
    checkType: AICheckType,
    contactData: Record<string, unknown>,
    config: AICheckConfig
  ): string {
    const relevantData = {
      checkType,
      contactId: contactData.id || contactData.userId || contactData.email,
      // Include only relevant fields based on check type
      ...(checkType === 'lead_score' && {
        recentSearches: contactData.recentSearches,
        abandonedCarts: contactData.abandonedCarts,
        views: contactData.views,
      }),
      ...(checkType === 'churn_risk' && {
        lastActivity: contactData.lastActivity,
        engagementScore: contactData.engagementScore,
        supportTickets: contactData.supportTickets,
      }),
    };
    return `ai_check:${JSON.stringify(relevantData)}:${config.model}`;
  }

  /**
   * Check if cached result exists and is valid
   */
  private getCachedResult(cacheKey: string): AICheckResult | null {
    if (!this.config.enableCache) return null;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.debug('Using cached AI check result', { cacheKey });
      return cached.result;
    }

    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Cache a result
   */
  private cacheResult(cacheKey: string, result: AICheckResult): void {
    if (!this.config.enableCache) return;
    this.cache.set(cacheKey, { result, timestamp: Date.now() });

    // Cleanup old entries
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries());
      const toDelete = entries.slice(0, 100);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Evaluate an AI check
   */
  async evaluateCheck(
    config: AICheckConfig,
    context: AICheckContext
  ): Promise<AICheckResult> {
    await this.initialize();

    const startTime = Date.now();

    // Check cache first
    const cacheKey = this.generateCacheKey(config.checkType, context.contactData, config);
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Get the prompt for the check type
    const prompt = this.buildCheckPrompt(config, context);

    let score: number;
    let reasoning: string;
    let variables: Record<string, unknown> = {};
    let rawResponse: string = '';

    // Use the configured model or default
    const model = config.model || this.config.defaultModel;

    try {
      if (model === 'claude' && this.anthropic) {
        const response = await this.anthropic.messages.create({
          model: 'claude-opus-4-0',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
          system: this.getSystemPrompt(config.checkType),
        });

        rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
        const parsed = this.parseAIResponse(rawResponse, config.checkType);
        score = parsed.score;
        reasoning = parsed.reasoning;
        variables = parsed.variables;
      } else if (this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: this.getSystemPrompt(config.checkType) },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        });

        rawResponse = completion.choices[0]?.message?.content || '';
        const parsed = this.parseAIResponse(rawResponse, config.checkType);
        score = parsed.score;
        reasoning = parsed.reasoning;
        variables = parsed.variables;
      } else {
        // Fallback to mock response for development
        const mockResult = this.getMockResponse(config.checkType);
        score = mockResult.score;
        reasoning = mockResult.reasoning;
        variables = mockResult.variables;
        rawResponse = JSON.stringify(mockResult);
      }
    } catch (error) {
      logger.error('AI check evaluation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checkType: config.checkType,
      });

      // Return a safe fallback
      return {
        stepId: config.trueNextStepId || '',
        checkType: config.checkType,
        score: 0,
        passed: false,
        reasoning: `AI evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Defaulting to fail.`,
        confidence: 0,
        model,
        evaluatedAt: new Date(),
        evaluationTimeMs: Date.now() - startTime,
      };
    }

    const evaluationTimeMs = Date.now() - startTime;
    const passed = score >= config.threshold;

    const result: AICheckResult = {
      stepId: config.trueNextStepId || '',
      checkType: config.checkType,
      score,
      passed,
      reasoning,
      confidence: this.calculateConfidence(config.checkType, context),
      model,
      evaluatedAt: new Date(),
      evaluationTimeMs,
      variables,
    };

    // Cache the result
    this.cacheResult(cacheKey, result);

    logger.info('AI check evaluated', {
      checkType: config.checkType,
      score,
      passed,
      threshold: config.threshold,
      evaluationTimeMs,
    });

    return result;
  }

  /**
   * Build the prompt for the check
   */
  private buildCheckPrompt(config: AICheckConfig, context: AICheckContext): string {
    const checkInfo = BUILT_IN_CHECKS.find(c => c.checkType === config.checkType);
    const checkDescription = checkInfo?.description || 'Custom AI evaluation';

    // Add type-specific context
    let contextSection = '';

    switch (config.checkType) {
      case 'lead_score':
        contextSection = this.buildLeadScoreContext(context);
        break;
      case 'purchase_probability':
        contextSection = this.buildPurchaseProbabilityContext(context);
        break;
      case 'churn_risk':
        contextSection = this.buildChurnRiskContext(context);
        break;
      case 'upsell_eligibility':
        contextSection = this.buildUpsellEligibilityContext(context);
        break;
      case 'channel_preference':
        contextSection = this.buildChannelPreferenceContext(context);
        break;
      case 'custom':
        contextSection = this.buildCustomContext(config.prompt || '', context);
        break;
    }

    return `Evaluate the following contact for ${checkDescription}:

${contextSection}

Return your evaluation with a score and reasoning.`;
  }

  /**
   * Build context for lead score check
   */
  private buildLeadScoreContext(context: AICheckContext): string {
    const { contactData, historicalData } = context;
    const historical = historicalData || {};

    return `
Contact Information:
- Email: ${contactData.email || 'N/A'}
- Name: ${contactData.firstName || ''} ${contactData.lastName || ''}
- User ID: ${contactData.id || contactData.userId || 'N/A'}

Activity Signals:
- Recent searches: ${(historical.recentSearches || contactData.recentSearches || []).slice(0, 10).join(', ') || 'None'}
- Abandoned carts: ${((historical.abandonedCarts || contactData.abandonedCarts || []) as Array<{items: string[]}>).length} items
- Product views: ${(historical.views || contactData.views || []).slice(0, 10).join(', ') || 'None'}
- Last activity: ${historical.lastActivity || contactData.lastActivity || 'Unknown'}
- Engagement score: ${historical.engagementScore || contactData.engagementScore || 'N/A'}

Provide a lead score from 0-100 where:
- 0-25: Cold lead (minimal activity)
- 26-50: Warm lead (some engagement)
- 51-75: Hot lead (active engagement)
- 76-100: Very hot lead (high intent)`;
  }

  /**
   * Build context for purchase probability check
   */
  private buildPurchaseProbabilityContext(context: AICheckContext): string {
    const { contactData, historicalData } = context;
    const historical = historicalData || {};
    const purchases = historical.purchases || contactData.purchases || [];

    return `
Contact Information:
- Email: ${contactData.email || 'N/A'}
- Customer tier: ${contactData.customerTier || contactData.tier || 'Standard'}
- Average order value: ${contactData.aov || contactData.averageOrderValue || 'N/A'}

Purchase History:
- Total purchases: ${(purchases as Array<unknown>).length}
- Total spent: ${contactData.totalSpent || 'N/A'}
- Last purchase: ${contactData.lastPurchase || 'Never'}

Current Session:
- Cart value: ${contactData.cartValue || contactData.currentCartValue || 'N/A'}
- Cart items: ${(contactData.cartItems || []).slice(0, 5).join(', ') || 'None'}
- Browsing: ${contactData.currentlyViewing || 'N/A'}

Provide a purchase probability from 0.0 to 1.0 where:
- 0.0-0.2: Very unlikely to purchase
- 0.2-0.4: May purchase
- 0.4-0.6: Probably will purchase
- 0.6-0.8: Likely to purchase
- 0.8-1.0: Almost certain to purchase`;
  }

  /**
   * Build context for churn risk check
   */
  private buildChurnRiskContext(context: AICheckContext): string {
    const { contactData, historicalData } = context;
    const historical = historicalData || {};

    return `
Contact Information:
- Email: ${contactData.email || 'N/A'}
- Member since: ${contactData.createdAt || contactData.memberSince || 'Unknown'}
- Last active: ${historical.lastActivity || contactData.lastActivity || 'Unknown'}
- Account status: ${contactData.status || 'Active'}

Engagement Metrics:
- Engagement score: ${historical.engagementScore || contactData.engagementScore || 'N/A'}/100
- Support tickets: ${historical.supportTickets || contactData.supportTickets || 0}
- Email opens (30 days): ${contactData.emailOpensLast30Days || 0}
- Purchases (90 days): ${contactData.purchasesLast90Days || 0}

Warning Signs:
- Declining engagement: ${contactData.decliningEngagement ? 'Yes' : 'No'}
- Unresolved complaints: ${contactData.openTickets || 0}
- Subscription status: ${contactData.subscriptionStatus || 'Active'}

Provide a churn risk score from 0.0 to 1.0 where:
- 0.0-0.2: Healthy customer
- 0.2-0.4: Some concern
- 0.4-0.6: At risk
- 0.6-0.8: High risk
- 0.8-1.0: Very likely to churn`;
  }

  /**
   * Build context for upsell eligibility check
   */
  private buildUpsellEligibilityContext(context: AICheckContext): string {
    const { contactData, historicalData } = context;
    const historical = historicalData || {};

    return `
Contact Information:
- Email: ${contactData.email || 'N/A'}
- Customer tier: ${contactData.customerTier || contactData.tier || 'Standard'}
- Account age: ${contactData.accountAge || contactData.memberSince ? `${Math.floor((Date.now() - new Date(contactData.memberSince as string || contactData.createdAt as string).getTime()) / (1000 * 60 * 60 * 24))} days` : 'N/A'}

Purchase History:
- Total purchases: ${((historical.purchases || contactData.purchases || []) as Array<unknown>).length}
- Total spent: ${contactData.totalSpent || 'N/A'}
- Average order value: ${contactData.aov || contactData.averageOrderValue || 'N/A'}
- Categories purchased: ${(contactData.categories || []).slice(0, 5).join(', ') || 'None'}

Current State:
- Current cart value: ${contactData.cartValue || contactData.currentCartValue || 'N/A'}
- Items in cart: ${(contactData.cartItems || []).length}
- Recently viewed premium items: ${(contactData.viewedPremiumItems || []).length}

Provide an upsell eligibility score from 0.0 to 1.0 indicating how likely this customer is to respond positively to an upsell offer.`;
  }

  /**
   * Build context for channel preference check
   */
  private buildChannelPreferenceContext(context: AICheckContext): string {
    const { contactData } = context;

    return `
Contact Information:
- Email: ${contactData.email || 'N/A'}
- Phone: ${contactData.phone ? '***' + (contactData.phone as string).slice(-4) : 'N/A'}
- WhatsApp: ${contactData.whatsappNumber ? 'Yes' : 'No'}

Channel Engagement History:
- Email opens: ${contactData.emailOpenRate || 0}%
- SMS delivery rate: ${contactData.smsDeliveryRate || 0}%
- Push notification rate: ${contactData.pushOpenRate || 0}%
- WhatsApp response rate: ${contactData.whatsappResponseRate || 0}%

Preferences:
- Preferred contact method: ${contactData.preferredChannel || 'Not specified'}
- Opted out of: ${(contactData.unsubscribedFrom || []).join(', ') || 'Nothing'}
- Do not disturb: ${contactData.dndHours ? `${contactData.dndHours.start}-${contactData.dndHours.end}` : 'No'}

Device info:
- Has mobile app: ${contactData.hasMobileApp ? 'Yes' : 'No'}
- Push enabled: ${contactData.pushEnabled ? 'Yes' : 'No'}

Provide:
1. A channel preference score from 0.0 to 1.0 for each channel (email, SMS, WhatsApp, Push)
2. The recommended primary channel
3. A fallback channel in case primary fails`;
  }

  /**
   * Build context for custom check
   */
  private buildCustomContext(customPrompt: string, context: AICheckContext): string {
    return `
${customPrompt}

Contact Data:
${JSON.stringify(context.contactData, null, 2)}

Journey Data:
${context.journeyData ? JSON.stringify(context.journeyData, null, 2) : 'None'}

Entry Data:
${context.entryData ? JSON.stringify(context.entryData, null, 2) : 'None'}

Provide a score from 0.0 to 1.0 (or 0-100 if appropriate) with clear reasoning.`;
  }

  /**
   * Get system prompt for the check type
   */
  private getSystemPrompt(checkType: AICheckType): string {
    const prompts: Record<AICheckType, string> = {
      lead_score: `You are an expert at evaluating leads. Analyze the contact's behavior and engagement to determine their likelihood of converting. Return a JSON object with score (0-100), reasoning (detailed explanation), and variables (relevant insights like lead_signals, lead_quality).`,
      purchase_probability: `You are an expert e-commerce analyst. Predict the likelihood of a purchase based on browsing behavior, cart data, and purchase history. Return a JSON object with score (0.0-1.0), reasoning, and variables (urgency, intent level).`,
      churn_risk: `You are a customer success expert. Identify customers at risk of churning based on engagement patterns and warning signs. Return a JSON object with score (0.0-1.0), reasoning, and variables (risk factors, churn indicators).`,
      upsell_eligibility: `You are a sales optimization expert. Determine if a customer is a good candidate for upselling based on their profile and purchase history. Return a JSON object with score (0.0-1.0), reasoning, and variables (eligibility factors, upsell potential).`,
      channel_preference: `You are a multi-channel marketing expert. Predict the optimal communication channel for each contact. Return a JSON object with score (0.0-1.0), reasoning, and variables (preferred_channel, channel_confidence, fallback_channel).`,
      custom: `You are an AI assistant evaluating customer data. Analyze the provided context and return a JSON object with score, reasoning, and any relevant variables that should be stored.`,
    };

    return prompts[checkType] || prompts.custom;
  }

  /**
   * Parse AI response into structured result
   */
  private parseAIResponse(
    response: string,
    checkType: AICheckType
  ): { score: number; reasoning: string; variables: Record<string, unknown> } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parsed.score ?? parsed.probability ?? parsed.risk ?? 0,
          reasoning: parsed.reasoning || parsed.explanation || 'No reasoning provided',
          variables: parsed.variables || parsed.insights || {},
        };
      }
    } catch {
      // If JSON parsing fails, extract score from text
    }

    // Fallback: extract score from text
    const scoreMatch = response.match(/score[:\s]*(\d+\.?\d*)/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5;

    return {
      score: checkType.includes('probability') || checkType.includes('risk') || checkType.includes('eligibility') || checkType.includes('preference')
        ? Math.min(1, Math.max(0, score / 100))
        : score,
      reasoning: response.substring(0, 500),
      variables: {},
    };
  }

  /**
   * Calculate confidence based on available data
   */
  private calculateConfidence(
    checkType: AICheckType,
    context: AICheckContext
  ): number {
    let dataPoints = 0;
    const requiredDataPoints = 5;

    // Count available data points
    if (Object.keys(context.contactData).length > 0) dataPoints++;
    if (context.historicalData) dataPoints++;
    if (context.historicalData?.purchases?.length) dataPoints++;
    if (context.historicalData?.recentSearches?.length) dataPoints++;
    if (context.historicalData?.views?.length) dataPoints++;

    const baseConfidence = Math.min(1, dataPoints / requiredDataPoints);

    // Boost confidence if we have specific data for the check type
    switch (checkType) {
      case 'lead_score':
        return baseConfidence + (context.historicalData?.recentSearches?.length ? 0.2 : 0);
      case 'purchase_probability':
        return baseConfidence + (context.historicalData?.purchases?.length ? 0.2 : 0);
      case 'churn_risk':
        return baseConfidence + (context.historicalData?.lastActivity ? 0.2 : 0);
      default:
        return baseConfidence;
    }
  }

  /**
   * Get mock response for development
   */
  private getMockResponse(
    checkType: AICheckType
  ): { score: number; reasoning: string; variables: Record<string, unknown> } {
    switch (checkType) {
      case 'lead_score':
        return {
          score: 75,
          reasoning: 'Mock: Contact has recent searches, abandoned carts, and high engagement.',
          variables: { lead_quality: 'high', lead_signals: ['recent_activity', 'cart_abandonment'] },
        };
      case 'purchase_probability':
        return {
          score: 0.65,
          reasoning: 'Mock: High cart value with multiple items suggests purchase intent.',
          variables: { urgency: 'medium', intent: 'high' },
        };
      case 'churn_risk':
        return {
          score: 0.3,
          reasoning: 'Mock: Recent activity and engagement indicate healthy customer.',
          variables: { risk_factors: [], health_score: 'good' },
        };
      case 'upsell_eligibility':
        return {
          score: 0.7,
          reasoning: 'Mock: High-value customer with premium product interest.',
          variables: { tier: 'premium', potential: 'high' },
        };
      case 'channel_preference':
        return {
          score: 0.85,
          reasoning: 'Mock: High email engagement and WhatsApp availability.',
          variables: { preferred_channel: 'whatsapp', channel_confidence: 0.9, fallback_channel: 'email' },
        };
      default:
        return {
          score: 0.5,
          reasoning: 'Mock response for development',
          variables: {},
        };
    }
  }

  /**
   * Test an AI check with sample data
   */
  async testCheck(
    config: AICheckConfig,
    testData: AICheckContext
  ): Promise<AICheckTestResult> {
    await this.initialize();

    const startTime = Date.now();
    let rawResponse = '';

    const model = config.model || this.config.defaultModel;

    try {
      const prompt = this.buildCheckPrompt(config, testData);

      if (model === 'claude' && this.anthropic) {
        const response = await this.anthropic.messages.create({
          model: 'claude-opus-4-0',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
          system: this.getSystemPrompt(config.checkType),
        });

        rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
      } else if (this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: this.getSystemPrompt(config.checkType) },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        });

        rawResponse = completion.choices[0]?.message?.content || '';
      }
    } catch (error) {
      rawResponse = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    const result = await this.evaluateCheck(config, testData);

    return {
      checkType: config.checkType,
      model,
      testData,
      result,
      rawResponse,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('AI Check cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL,
    };
  }
}

// Export singleton instance
export const aiCheckService = new AICheckService();
export default aiCheckService;
