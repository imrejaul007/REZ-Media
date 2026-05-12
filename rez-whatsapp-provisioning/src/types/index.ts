export enum MerchantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  DELETED = 'deleted',
}

export enum SubaccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

export enum PhoneNumberStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  RELEASED = 'released',
  FAILED = 'failed',
}

export enum PhoneNumberType {
  LOCAL = 'local',
  MOBILE = 'mobile',
  TOLL_FREE = 'toll_free',
}

export enum TemplateStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
  DELETED = 'deleted',
}

export enum TemplateCategory {
  MARKETING = 'marketing',
  UTILITY = 'utility',
  AUTHENTICATION = 'authentication',
}

export enum WebhookEventType {
  INBOUND_MESSAGE = 'inbound_message',
  MESSAGE_STATUS = 'message_status',
  NUMBER_STATUS = 'number_status',
  TEMPLATE_STATUS = 'template_status',
  SUBACCOUNT_STATUS = 'subaccount_status',
}

export enum MessageStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  UNDELIVERED = 'undelivered',
}

export interface MerchantProvisionRequest {
  merchantId: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  industry: string;
  useCase: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SubaccountCreateRequest {
  merchantId: string;
  friendlyName: string;
  email?: string;
}

export interface PhoneNumberProvisionRequest {
  merchantId: string;
  subaccountSid: string;
  countryCode: string;
  type?: PhoneNumberType;
  areaCode?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface TemplateCreateRequest {
  merchantId: string;
  subaccountSid: string;
  name: string;
  language: string;
  category: TemplateCategory;
  components: TemplateComponent[];
  metadata?: Record<string, unknown>;
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  mediaUrl?: string;
  buttons?: TemplateButton[];
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
}

export interface TemplateButton {
  type: 'PHONE_NUMBER' | 'URL' | 'QUICK_REPLY';
  text: string;
  phoneNumber?: string;
  url?: string;
}

export interface WebhookPayload {
  accountSid: string;
  eventType: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ProvisioningResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface TwilioPhoneNumberResource {
  sid: string;
  accountSid: string;
  friendlyName: string;
  phoneNumber: string;
  status: string;
  voiceUrl?: string;
  voiceMethod?: string;
  smsUrl?: string;
  smsMethod?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    MMS: boolean;
  };
  dateCreated: Date;
  dateUpdated: Date;
}

export interface TwilioMessageResource {
  sid: string;
  accountSid: string;
  messagingServiceSid?: string;
  to: string;
  from: string;
  body: string;
  status: string;
  numSegments: string;
  numMedia: string;
  errorCode?: number;
  errorMessage?: string;
  dateCreated: Date;
  dateUpdated: Date;
}

export interface TwilioIncomingPhoneNumberResource {
  sid: string;
  accountSid: string;
  friendlyName: string;
  phoneNumber: string;
  countryCode: string;
  status: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    MMS: boolean;
  };
}

export interface TwilioMessageTemplateResource {
  accountSid: string;
  dateCreated: string;
  dateUpdated: string;
  friendlyName: string;
  language: string;
  sid: string;
  status: string;
  templateType: string;
  url: string;
}
