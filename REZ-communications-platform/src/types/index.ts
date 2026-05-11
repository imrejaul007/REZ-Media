/**
 * Core type definitions for REZ Communications Platform
 */

import { z } from 'zod';

// ============================================
// ENUMS & CONSTANTS
// ============================================

export enum ChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push'
}

export enum MessageStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  UNSUBSCRIBED = 'unsubscribed'
}

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

// ============================================
// SCHEMAS (using Zod for runtime validation)
// ============================================

export const EmailAddressSchema = z.object({
  email: z.string().email(),
  name: z.string().optional()
});

export const PhoneNumberSchema = z.object({
  countryCode: z.string().min(1).max(4),
  number: z.string().min(7).max(15)
});

export const DeviceTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  deviceId: z.string().optional()
});

export const RecipientSchema = z.object({
  id: z.string().uuid(),
  email: EmailAddressSchema.optional(),
  phone: PhoneNumberSchema.optional(),
  deviceToken: DeviceTokenSchema.optional(),
  whatsapp: z.string().optional(),
  preferences: z.record(z.unknown()).optional()
});

export const EmailMessageSchema = z.object({
  to: EmailAddressSchema,
  from: EmailAddressSchema.optional(),
  subject: z.string().min(1).max(998),
  body: z.string(),
  html: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.union([z.string(), z.instanceof(Buffer)]),
    contentType: z.string().optional()
  })).optional(),
  headers: z.record(z.string()).optional()
});

export const SMSMessageSchema = z.object({
  to: PhoneNumberSchema,
  from: PhoneNumberSchema.optional(),
  body: z.string().min(1).max(1600),
  mediaUrl: z.string().url().optional()
});

export const WhatsAppMessageSchema = z.object({
  to: z.string(),
  from: z.string().optional(),
  body: z.string().min(1).max(4096),
  mediaUrl: z.string().url().optional(),
  mediaCaption: z.string().optional(),
  replyTo: z.string().optional()
});

export const PushNotificationSchema = z.object({
  to: DeviceTokenSchema,
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  data: z.record(z.unknown()).optional(),
  badge: z.number().int().min(0).optional(),
  sound: z.string().optional(),
  clickAction: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional()
});

export const CampaignSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  channels: z.array(z.nativeEnum(ChannelType)).min(1),
  templateId: z.string(),
  segmentId: z.string().optional(),
  scheduledAt: z.date().optional(),
  priority: z.nativeEnum(Priority).default(Priority.NORMAL),
  metadata: z.record(z.unknown()).optional()
});

export const DeliveryReportSchema = z.object({
  messageId: z.string(),
  channel: z.nativeEnum(ChannelType),
  status: z.nativeEnum(MessageStatus),
  timestamp: z.date(),
  details: z.record(z.unknown()).optional(),
  error: z.string().optional()
});

// ============================================
// INTERFACES
// ============================================

export interface IEmailService {
  send(message: EmailMessage): Promise<DeliveryResult>;
  sendBatch(messages: EmailMessage[]): Promise<DeliveryResult[]>;
  getTemplateEngine(): TemplateEngine;
}

export interface ISMSService {
  send(message: SMSMessage): Promise<DeliveryResult>;
  sendBatch(messages: SMSMessage[]): Promise<DeliveryResult[]>;
  validateNumber(phoneNumber: PhoneNumber): Promise<boolean>;
}

export interface IWhatsAppService {
  send(message: WhatsAppMessage): Promise<DeliveryResult>;
  sendTemplate(templateName: string, variables: Record<string, string>): Promise<DeliveryResult>;
  sendBatch(messages: WhatsAppMessage[]): Promise<DeliveryResult[]>;
}

export interface IPushService {
  send(notification: PushNotification): Promise<DeliveryResult>;
  sendToTopic(topic: string, notification: PushNotification): Promise<DeliveryResult>;
  sendBatch(notifications: PushNotification[]): Promise<DeliveryResult[]>;
  subscribeToTopic(tokens: string[], topic: string): Promise<void>;
}

export interface ICampaignOrchestrator {
  createCampaign(campaign: Campaign): Promise<CampaignResult>;
  executeCampaign(campaignId: string): Promise<CampaignExecutionResult>;
  cancelCampaign(campaignId: string): Promise<void>;
  getCampaignStatus(campaignId: string): Promise<CampaignStatusResult>;
  scheduleCampaign(campaign: Campaign, scheduledAt: Date): Promise<CampaignResult>;
}

export interface ITemplateEngine {
  render(templateId: string, variables: Record<string, unknown>): Promise<string>;
  renderRaw(template: string, variables: Record<string, unknown>): string;
  registerTemplate(templateId: string, template: string, metadata?: TemplateMetadata): void;
  listTemplates(): TemplateMetadata[];
}

// ============================================
// TYPES
// ============================================

export type EmailMessage = z.infer<typeof EmailMessageSchema>;
export type SMSMessage = z.infer<typeof SMSMessageSchema>;
export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;
export type PushNotification = z.infer<typeof PushNotificationSchema>;
export type Recipient = z.infer<typeof RecipientSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type DeliveryReport = z.infer<typeof DeliveryReportSchema>;
export type EmailAddress = z.infer<typeof EmailAddressSchema>;
export type PhoneNumber = z.infer<typeof PhoneNumberSchema>;
export type DeviceToken = z.infer<typeof DeviceTokenSchema>;

export interface DeliveryResult {
  messageId: string;
  channel: ChannelType;
  status: MessageStatus;
  timestamp: Date;
  providerMessageId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  channel: ChannelType;
  subject?: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignResult {
  campaignId: string;
  status: CampaignStatus;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CampaignExecutionResult {
  campaignId: string;
  totalRecipients: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  startTime: Date;
  endTime?: Date;
  errors: Array<{ recipientId: string; error: string }>;
}

export interface CampaignStatusResult {
  campaignId: string;
  status: CampaignStatus;
  progress: number;
  processedCount: number;
  totalCount: number;
  estimatedCompletion?: Date;
}

export interface QueuedMessage {
  id: string;
  channel: ChannelType;
  payload: EmailMessage | SMSMessage | WhatsAppMessage | PushNotification;
  recipientId: string;
  priority: Priority;
  scheduledAt?: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}

export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  latency?: number;
  error?: string;
  lastChecked: Date;
}

// ============================================
// CONFIG TYPES
// ============================================

export interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'mock';
  apiKey?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  trackingEnabled?: boolean;
  openTracking?: boolean;
  clickTracking?: boolean;
}

export interface SMSConfig {
  provider: 'twilio' | 'mock';
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  maxBatchSize?: number;
}

export interface WhatsAppConfig {
  provider: 'twilio' | 'whatsapp-web' | 'mock';
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  sessionPath?: string;
  qrCallback?: (qr: string) => void;
}

export interface PushConfig {
  provider: 'firebase' | 'mock';
  serviceAccountPath?: string;
  projectId?: string;
}

export interface QueueConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface PlatformConfig {
  email: EmailConfig;
  sms: SMSConfig;
  whatsapp: WhatsAppConfig;
  push: PushConfig;
  queue: QueueConfig;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
