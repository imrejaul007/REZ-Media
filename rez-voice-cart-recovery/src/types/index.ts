import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export enum CallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  ANSWERED = 'answered',
  SPEAKING = 'speaking',
  LISTENING = 'listening',
  CONCLUDED = 'concluded',
  FAILED = 'failed',
  BUSY = 'busy',
  NO_ANSWER = 'no_answer',
  CANCELLED = 'cancelled',
  TRANSFERRED = 'transferred'
}

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum CampaignTrigger {
  CART_ABANDONED = 'cart_abandoned',
  COD_UNCONFIRMED = 'cod_unconfirmed',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  ORDER_DELAYED = 'order_delayed'
}

export enum CallPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ConversationState {
  GREETING = 'greeting',
  MESSAGE = 'message',
  CONFIRM_INTENT = 'confirm_intent',
  DECLINE_INTENT = 'decline_intent',
  TRANSFER_TO_AGENT = 'transfer_to_agent',
  GOODBYE = 'goodbye',
  CONCLUDED = 'concluded'
}

export enum UserIntent {
  CONFIRM = 'confirm',
  DECLINE = 'decline',
  TRANSFER = 'transfer',
  SILENCE = 'silence',
  UNKNOWN = 'unknown',
  ASK_QUESTION = 'ask_question'
}

// ============================================
// ZOD SCHEMAS
// ============================================

export const PhoneNumberSchema = z.string().regex(
  /^\+?[1-9]\d{1,14}$/,
  'Invalid phone number format (E.164)'
);

export const VoiceTemplateSchema = z.object({
  id: z.string(),
  greeting: z.string(),
  message: z.string(),
  confirmIntent: z.string(),
  declineIntent: z.string(),
  transferToAgent: z.string(),
  goodbye: z.string()
});

export const InitiateCallSchema = z.object({
  to: PhoneNumberSchema,
  campaignId: z.string().optional(),
  trigger: z.nativeEnum(CampaignTrigger).optional(),
  customerId: z.string().optional(),
  cartId: z.string().optional(),
  orderId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  trigger: z.nativeEnum(CampaignTrigger),
  templateId: z.string(),
  priority: z.nativeEnum(CallPriority).default(CallPriority.MEDIUM),
  maxAttempts: z.number().int().min(1).max(5).default(3),
  retryDelayMinutes: z.number().int().min(5).default(60),
  businessHours: z.object({
    enabled: z.boolean().default(true),
    timezone: z.string().default('Asia/Kolkata'),
    startHour: z.number().int().min(0).max(23).default(9),
    endHour: z.number().int().min(0).max(23).default(21)
  }).optional(),
  callingWindow: z.object({
    enabled: z.boolean().default(true),
    maxCallsPerHour: z.number().int().min(1).default(60)
  }).optional(),
  filters: z.object({
    excludeDnc: z.boolean().default(true),
    minOrderValue: z.number().optional(),
    customerTags: z.array(z.string()).optional()
  }).optional(),
  schedule: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    cronExpression: z.string().optional()
  }).optional()
});

export const AddToDncSchema = z.object({
  phone: PhoneNumberSchema,
  reason: z.string().optional(),
  source: z.string().optional(),
  expiresAt: z.string().datetime().optional()
});

// ============================================
// TYPES
// ============================================

export interface VoiceConfig {
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  voiceWebhookUrl: string;
  port: number;
}

export interface BusinessHours {
  enabled: boolean;
  timezone: string;
  startHour: number;
  endHour: number;
}

export interface CallingWindow {
  enabled: boolean;
  maxCallsPerHour: number;
}

export interface CampaignFilters {
  excludeDnc: boolean;
  minOrderValue?: number;
  customerTags?: string[];
}

export interface CampaignSchedule {
  startDate?: string;
  endDate?: string;
  cronExpression?: string;
}

export interface CallContext {
  customerName?: string;
  storeName?: string;
  itemCount?: number;
  totalAmount?: string;
  orderId?: string;
  cartId?: string;
  appointmentTime?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  [key: string]: unknown;
}

export interface ConversationTurn {
  timestamp: Date;
  speaker: 'ai' | 'user';
  transcript: string;
  intent?: UserIntent;
  confidence?: number;
}

export interface VoiceTemplate {
  id: string;
  greeting: string;
  message: string;
  confirmIntent: string;
  declineIntent: string;
  transferToAgent: string;
  goodbye: string;
}

export interface CallDocument {
  _id: string;
  callSid?: string;
  twilioCallSid?: string;
  to: string;
  from: string;
  status: CallStatus;
  campaignId?: string;
  trigger?: CampaignTrigger;
  customerId?: string;
  cartId?: string;
  orderId?: string;
  priority: CallPriority;
  context: CallContext;
  attempts: number;
  maxAttempts: number;
  conversationState: ConversationState;
  conversationHistory: ConversationTurn[];
  duration?: number;
  recordingUrl?: string;
  transcriptId?: string;
  transferredToAgent: boolean;
  errorMessage?: string;
  scheduledAt?: Date;
  startedAt?: Date;
  answeredAt?: Date;
  concludedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignDocument {
  _id: string;
  name: string;
  trigger: CampaignTrigger;
  templateId: string;
  status: CampaignStatus;
  priority: CallPriority;
  businessHours: BusinessHours;
  callingWindow: CallingWindow;
  filters: CampaignFilters;
  schedule?: CampaignSchedule;
  stats: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    answeredCalls: number;
    transferredCalls: number;
    conversionRate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptDocument {
  _id: string;
  callId: string;
  callSid: string;
  recordingSid?: string;
  transcriptionText?: string;
  confidence?: number;
  segments: Array<{
    startTime: number;
    endTime: number;
    speaker: 'ai' | 'user' | 'unknown';
    text: string;
    confidence: number;
  }>;
  summary?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  keyTopics?: string[];
  createdAt: Date;
}

export interface DncEntry {
  _id: string;
  phone: string;
  reason?: string;
  source?: string;
  addedAt: Date;
  expiresAt?: Date;
}

// ============================================
// TWILIO TYPES
// ============================================

export interface TwilioCallStatus {
  callSid: string;
  accountSid: string;
  from: string;
  to: string;
  callStatus: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  apiVersion: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  timestamp: string;
  callbackSource: string;
}

export interface TwilioVoiceWebhook {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  ApiVersion: string;
  Direction: string;
  CallerName?: string;
  ForwardedFrom?: string;
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
  TranscriptionText?: string;
  Digits?: string;
  AnsweredBy?: string;
}

// ============================================
// CAMPAIGN QUEUE TYPES
// ============================================

export interface CampaignQueueJob {
  id: string;
  campaignId: string;
  callData: {
    to: string;
    customerId?: string;
    cartId?: string;
    orderId?: string;
    context: CallContext;
  };
  priority: CallPriority;
  scheduledFor: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

export interface CampaignExecutionStats {
  campaignId: string;
  startedAt: Date;
  completedAt?: Date;
  totalTargets: number;
  processedCalls: number;
  successfulCalls: number;
  failedCalls: number;
  pendingCalls: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
