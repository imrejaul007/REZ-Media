import { z } from 'zod';
import type {
  TriggerType,
  StepType,
  ConditionOperator,
  ConditionField,
} from '../types';

// Workflow Step Schema
const conditionSchema = z.object({
  field: z.enum([
    'opened',
    'clicked',
    'purchased',
    'visited',
    'cart_value',
    'days_since_last_purchase',
    'tag',
    'segment',
  ] as const),
  operator: z.enum([
    'equals',
    'not_equals',
    'greater_than',
    'less_than',
    'contains',
    'not_contains',
  ] as const),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const stepConfigSchema = z.object({
  template: z.string().optional(),
  content: z.string().optional(),
  subject: z.string().optional(),
  duration: z.string().optional(),
  durationMinutes: z.number().optional(),
  channel: z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app']).optional(),
  templateId: z.string().optional(),
  variables: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH']).optional(),
  headers: z.record(z.string()).optional(),
  body: z.record(z.unknown()).optional(),
  conditions: z.array(conditionSchema).optional(),
  conditionLogic: z.enum(['AND', 'OR']).optional(),
  splits: z
    .array(
      z.object({
        name: z.string(),
        percentage: z.number().min(0).max(100),
      })
    )
    .optional(),
  discount: z.string().optional(),
  discountCode: z.string().optional(),
  aiPrompt: z.string().optional(),
  contentType: z.enum(['subject', 'body', 'image', 'video']).optional(),
});

const workflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'message',
    'email',
    'sms',
    'whatsapp',
    'push',
    'webhook',
    'condition',
    'delay',
    'end',
    'split',
    'ai_generated_content',
  ] as const),
  config: stepConfigSchema,
  position: positionSchema,
  edges: z.array(z.string()),
  label: z.string().optional(),
});

// Workflow Trigger Schema
const workflowTriggerSchema = z.object({
  type: z.enum([
    'abandoned_cart',
    'signup',
    'purchase',
    'manual',
    'schedule',
    'inactivity',
    'price_drop',
    'back_in_stock',
    'birthday',
    'win_back',
  ] as const),
  conditions: z.array(conditionSchema).optional(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
  days: z.number().optional(),
  cartValueMin: z.number().optional(),
  productIds: z.array(z.string()).optional(),
  trackInventory: z.boolean().optional(),
});

// Workflow Analytics Schema
const workflowAnalyticsSchema = z.object({
  trackOpens: z.boolean(),
  trackClicks: z.boolean(),
  trackConversions: z.boolean(),
  attributionWindow: z
    .object({
      click: z.number(),
      view: z.number(),
    })
    .optional(),
});

// Full Workflow Schema
export const workflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  trigger: workflowTriggerSchema,
  steps: z.array(workflowStepSchema).min(1),
  analytics: workflowAnalyticsSchema,
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Generate Workflow Request Schema
export const generateWorkflowRequestSchema = z.object({
  prompt: z.string().min(1).max(5000),
  options: z
    .object({
      includeABTest: z.boolean().optional(),
      maxSteps: z.number().min(1).max(50).optional(),
      preferredChannels: z
        .array(z.enum(['email', 'sms', 'whatsapp', 'push']))
        .optional(),
      outputFormat: z.enum(['full', 'minimal']).optional(),
    })
    .optional(),
});

// Generate Step Request Schema
export const generateStepRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  context: z
    .object({
      workflowId: z.string().optional(),
      previousSteps: z.array(workflowStepSchema).optional(),
      position: positionSchema.optional(),
    })
    .optional(),
});

// Validate Workflow Request Schema
export const validateWorkflowRequestSchema = z.object({
  workflow: workflowSchema,
});

// Optimize Workflow Request Schema
export const optimizeWorkflowRequestSchema = z.object({
  workflow: workflowSchema,
  goals: z
    .array(
      z.enum(['reduce_steps', 'increase_engagement', 'reduce_cost', 'improve_timing'])
    )
    .optional(),
});

// Generate Template Request Schema
export const generateTemplateRequestSchema = z.object({
  category: z
    .enum(['welcome', 'abandoned_cart', 'post_purchase', 'win_back', 'reengagement', 'promotional'])
    .optional(),
  complexity: z.enum(['simple', 'moderate', 'complex']).optional(),
});

// Template With Prompt Request Schema
export const templateWithPromptRequestSchema = z.object({
  templateId: z.string(),
  prompt: z.string().min(1).max(5000),
  modifications: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      trigger: workflowTriggerSchema.optional(),
      analytics: workflowAnalyticsSchema.optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

// Import Workflow Request Schema
export const importWorkflowRequestSchema = z.object({
  workflow: workflowSchema,
  targetJourneyId: z.string().optional(),
  duplicateCheck: z.boolean().optional(),
});

// Export type inference
export type WorkflowSchema = z.infer<typeof workflowSchema>;
export type GenerateWorkflowRequestSchema = z.infer<typeof generateWorkflowRequestSchema>;
export type GenerateStepRequestSchema = z.infer<typeof generateStepRequestSchema>;
export type ValidateWorkflowRequestSchema = z.infer<typeof validateWorkflowRequestSchema>;
export type OptimizeWorkflowRequestSchema = z.infer<typeof optimizeWorkflowRequestSchema>;
export type GenerateTemplateRequestSchema = z.infer<typeof generateTemplateRequestSchema>;
export type TemplateWithPromptRequestSchema = z.infer<typeof templateWithPromptRequestSchema>;
export type ImportWorkflowRequestSchema = z.infer<typeof importWorkflowRequestSchema>;

// JSON Schema for OpenAI response validation
export const workflowJsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Name of the workflow' },
    description: { type: 'string', description: 'Description of the workflow' },
    trigger: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'abandoned_cart',
            'signup',
            'purchase',
            'manual',
            'schedule',
            'inactivity',
            'price_drop',
            'back_in_stock',
            'birthday',
            'win_back',
          ],
          description: 'The type of trigger that starts this workflow',
        },
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                enum: ['opened', 'clicked', 'purchased', 'visited', 'cart_value', 'days_since_last_purchase', 'tag', 'segment'],
              },
              operator: {
                type: 'string',
                enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains'],
              },
              value: {
                oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
              },
            },
          },
        },
        days: { type: 'number', description: 'For inactivity type: number of days' },
        cartValueMin: { type: 'number', description: 'For abandoned_cart type: minimum cart value' },
        cron: { type: 'string', description: 'For schedule type: cron expression' },
        timezone: { type: 'string', description: 'Timezone for schedule' },
      },
      required: ['type'],
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: ['message', 'email', 'sms', 'whatsapp', 'push', 'webhook', 'condition', 'delay', 'end', 'split', 'ai_generated_content'],
          },
          config: {
            type: 'object',
            properties: {
              template: { type: 'string' },
              content: { type: 'string' },
              subject: { type: 'string' },
              duration: { type: 'string', description: 'e.g., "1 hour", "2 days"' },
              durationMinutes: { type: 'number' },
              channel: { type: 'string', enum: ['email', 'sms', 'whatsapp', 'push', 'in_app'] },
              templateId: { type: 'string' },
              variables: { type: 'object', additionalProperties: { type: 'string' } },
              url: { type: 'string' },
              method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH'] },
              conditions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    operator: { type: 'string' },
                    value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
                  },
                },
              },
              discount: { type: 'string' },
              discountCode: { type: 'string' },
            },
          },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
            },
          },
          edges: {
            type: 'array',
            items: { type: 'string' },
          },
          label: { type: 'string' },
        },
        required: ['id', 'type', 'config', 'position', 'edges'],
      },
    },
    analytics: {
      type: 'object',
      properties: {
        trackOpens: { type: 'boolean' },
        trackClicks: { type: 'boolean' },
        trackConversions: { type: 'boolean' },
        attributionWindow: {
          type: 'object',
          properties: {
            click: { type: 'number' },
            view: { type: 'number' },
          },
        },
      },
    },
    status: { type: 'string', enum: ['draft', 'active', 'paused', 'archived'] },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'description', 'trigger', 'steps', 'analytics'],
};
