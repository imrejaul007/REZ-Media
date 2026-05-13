/**
 * REZ Integration Connector for AdBazaar
 * Drop this file into: services/REZConnector.js
 */

const axios = require('axios');

class REZAdBazaarConnector {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.REZ_API_URL || 'http://localhost:4091',
      apiKey: config.apiKey || process.env.REZ_API_KEY,
      debug: config.debug || false
    };
    this.merchantId = null;
  }

  log(...args) {
    if (this.config.debug) console.log('[REZ-AdBazaar]', ...args);
  }

  async init(merchant) {
    this.merchantId = merchant.id;
  }

  // Track campaign created
  async trackCampaignCreated(campaign) {
    return this.track('campaign_created', {
      campaignId: campaign.id,
      budget: campaign.budget,
      targeting: campaign.targeting
    });
  }

  // Track ad impression
  async trackAdImpression(impression) {
    return this.track('ad_impression', {
      adId: impression.adId,
      campaignId: impression.campaignId,
      placement: impression.placement,
      userId: impression.userId,
      creatorId: impression.creatorId
    });
  }

  // Track ad click
  async trackAdClick(click) {
    return this.track('ad_click', {
      adId: click.adId,
      campaignId: click.campaignId,
      userId: click.userId
    });
  }

  // Track ad conversion
  async trackAdConversion(conversion) {
    return this.track('ad_conversion', {
      adId: conversion.adId,
      campaignId: conversion.campaignId,
      orderId: conversion.orderId,
      amount: conversion.amount,
      attribution: conversion.attribution
    });
  }

  // Track creator signup
  async trackCreatorSignup(creator) {
    return this.track('creator_signup', {
      creatorId: creator.id,
      platform: creator.platform,
      followers: creator.followers
    });
  }

  // Track content posted
  async trackContentPosted(content) {
    return this.track('content_posted', {
      contentId: content.id,
      creatorId: content.creatorId,
      platform: content.platform,
      engagement: content.engagement
    });
  }

  // Get ad targeting recommendations
  async getTargetingRecommendations(options = {}) {
    if (!this.merchantId) return [];

    try {
      const response = await axios.get(
        `${this.config.baseUrl}/api/recommendations/${this.merchantId}`,
        {
          params: {
            types: 'personalized',
            limit: options.limit || 20,
            context: 'ad_targeting'
          },
          headers: { 'X-REZ-API-Key': this.config.apiKey },
          timeout: 5000
        }
      );
      return response.data.recommendations || [];
    } catch (err) {
      this.log('Recommendations failed:', err.message);
      return [];
    }
  }

  // Send conversion feedback
  async trackConversion(campaignId, orderId, amount, metadata = {}) {
    try {
      await axios.post(`${this.config.baseUrl}/api/feedback/conversion`, {
        campaignId,
        userId: metadata.userId,
        appId: 'adbazaar',
        converted: true,
        orderId,
        amount,
        metadata
      }, {
        headers: { 'X-REZ-API-Key': this.config.apiKey },
        timeout: 5000
      });
    } catch (err) {
      this.log('Conversion tracking failed:', err.message);
    }
  }

  async track(eventType, properties) {
    try {
      await axios.post(`${this.config.baseUrl}/api/events/track`, {
        eventType,
        merchantId: this.merchantId,
        appId: 'adbazaar',
        properties,
        timestamp: new Date().toISOString()
      }, {
        headers: { 'X-REZ-API-Key': this.config.apiKey },
        timeout: 5000
      });
      this.log(`Tracked: ${eventType}`);
    } catch (err) {
      this.log(`Track failed: ${eventType}`, err.message);
    }
  }
}

function rezMiddleware(req, res, next) {
  req.rez = new REZAdBazaarConnector();
  if (req.merchant) req.rez.init(req.merchant).catch(() => {});
  next();
}

module.exports = { REZAdBazaarConnector, rezMiddleware };
