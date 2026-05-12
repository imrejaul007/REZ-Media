/**
 * REZ Communications Platform - Routes Index
 *
 * Central export for all route modules.
 */

export { createMarketingRoutes, MarketingServices } from './marketing-routes';
export { createWebhookRoutes, WebhookConfig, WebhookEvent } from './webhook-routes';
export { createAgentRoutes, AgentServices, AgentType, AgentTriggerRequest, AgentInsightsRequest, AgentResponse } from './agent-routes';
