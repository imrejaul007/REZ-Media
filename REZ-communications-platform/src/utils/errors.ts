/**
 * Custom error classes for REZ Communications Platform
 */

export class CommunicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly channel?: string;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'COMMUNICATION_ERROR',
    statusCode: number = 500,
    options?: {
      channel?: string;
      retryable?: boolean;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = 'CommunicationError';
    this.code = code;
    this.statusCode = statusCode;
    this.channel = options?.channel;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      channel: this.channel,
      retryable: this.retryable,
      details: this.details,
      stack: this.stack
    };
  }
}

export class EmailError extends CommunicationError {
  constructor(
    message: string,
    code: string = 'EMAIL_ERROR',
    options?: {
      retryable?: boolean;
      details?: Record<string, unknown>;
    }
  ) {
    super(message, code, 500, { channel: 'email', ...options });
    this.name = 'EmailError';
  }
}

export class SMSError extends CommunicationError {
  constructor(
    message: string,
    code: string = 'SMS_ERROR',
    options?: {
      retryable?: boolean;
      details?: Record<string, unknown>;
    }
  ) {
    super(message, code, 500, { channel: 'sms', ...options });
    this.name = 'SMSError';
  }
}

export class WhatsAppError extends CommunicationError {
  constructor(
    message: string,
    code: string = 'WHATSAPP_ERROR',
    options?: {
      retryable?: boolean;
      details?: Record<string, unknown>;
    }
  ) {
    super(message, code, 500, { channel: 'whatsapp', ...options });
    this.name = 'WhatsAppError';
  }
}

export class PushError extends CommunicationError {
  constructor(
    message: string,
    code: string = 'PUSH_ERROR',
    options?: {
      retryable?: boolean;
      details?: Record<string, unknown>;
    }
  ) {
    super(message, code, 500, { channel: 'push', ...options });
    this.name = 'PushError';
  }
}

export class ValidationError extends CommunicationError {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string }>
  ) {
    super(message, 'VALIDATION_ERROR', 400, { retryable: false });
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

export class ProviderError extends CommunicationError {
  public readonly provider: string;
  public readonly originalError?: Error;

  constructor(
    message: string,
    provider: string,
    originalError?: Error,
    options?: { retryable?: boolean }
  ) {
    super(message, 'PROVIDER_ERROR', 502, { retryable: options?.retryable ?? true });
    this.name = 'ProviderError';
    this.provider = provider;
    this.originalError = originalError;
  }
}

export class TemplateError extends CommunicationError {
  constructor(
    message: string,
    code: string = 'TEMPLATE_ERROR',
    options?: { details?: Record<string, unknown> }
  ) {
    super(message, code, 500, options);
    this.name = 'TemplateError';
  }
}

export class CampaignError extends CommunicationError {
  public readonly campaignId?: string;

  constructor(
    message: string,
    campaignId?: string,
    code: string = 'CAMPAIGN_ERROR'
  ) {
    super(message, code, 500, { retryable: false });
    this.name = 'CampaignError';
    this.campaignId = campaignId;
  }
}

export class RateLimitError extends CommunicationError {
  public readonly retryAfter?: number;
  public readonly limit?: number;

  constructor(
    message: string,
    retryAfter?: number,
    limit?: number
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, { retryable: true });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.limit = limit;
  }
}

export class QueueError extends CommunicationError {
  constructor(
    message: string,
    options?: { retryable?: boolean }
  ) {
    super(message, 'QUEUE_ERROR', 503, { channel: 'queue', ...options });
    this.name = 'QueueError';
  }
}
