/**
 * Validation utilities for REZ Communications Platform
 */

import joi from 'joi';
import { z } from 'zod';

// ============================================
// JOI SCHEMAS (for runtime validation)
// ============================================

export const schemas = {
  emailAddress: joi.object({
    email: joi.string().email().required(),
    name: joi.string().max(255).optional()
  }),

  phoneNumber: joi.object({
    countryCode: joi.string().min(1).max(4).required(),
    number: joi.string().min(7).max(15).pattern(/^\+?[0-9]+$/).required()
  }),

  deviceToken: joi.object({
    token: joi.string().min(1).required(),
    platform: joi.string().valid('ios', 'android', 'web').required(),
    deviceId: joi.string().optional()
  }),

  emailMessage: joi.object({
    to: joi.object({
      email: joi.string().email().required(),
      name: joi.string().max(255).optional()
    }).required(),
    from: joi.object({
      email: joi.string().email().required(),
      name: joi.string().max(255).optional()
    }).optional(),
    subject: joi.string().min(1).max(998).required(),
    body: joi.string().min(1).required(),
    html: joi.string().optional(),
    attachments: joi.array().items(joi.object({
      filename: joi.string().required(),
      content: joi.alternatives().try(joi.string(), joi.binary()).required(),
      contentType: joi.string().optional()
    })).optional(),
    headers: joi.object().pattern(joi.string(), joi.string()).optional()
  }),

  smsMessage: joi.object({
    to: joi.object({
      countryCode: joi.string().min(1).max(4).required(),
      number: joi.string().min(7).max(15).pattern(/^\+?[0-9]+$/).required()
    }).required(),
    from: joi.object({
      countryCode: joi.string().min(1).max(4).required(),
      number: joi.string().min(7).max(15).pattern(/^\+?[0-9]+$/).required()
    }).optional(),
    body: joi.string().min(1).max(1600).required(),
    mediaUrl: joi.string().uri().optional()
  }),

  whatsappMessage: joi.object({
    to: joi.string().required(),
    from: joi.string().optional(),
    body: joi.string().min(1).max(4096).required(),
    mediaUrl: joi.string().uri().optional(),
    mediaCaption: joi.string().max(300).optional(),
    replyTo: joi.string().optional()
  }),

  pushNotification: joi.object({
    to: joi.object({
      token: joi.string().min(1).required(),
      platform: joi.string().valid('ios', 'android', 'web').required(),
      deviceId: joi.string().optional()
    }).required(),
    title: joi.string().min(1).max(100).required(),
    body: joi.string().min(1).max(500).required(),
    data: joi.object().unknown(true).optional(),
    badge: joi.number().integer().min(0).optional(),
    sound: joi.string().optional(),
    clickAction: joi.string().optional(),
    icon: joi.string().optional(),
    color: joi.string().optional()
  }),

  campaign: joi.object({
    name: joi.string().min(1).max(255).required(),
    channels: joi.array().items(joi.string().valid('email', 'sms', 'whatsapp', 'push')).min(1).required(),
    templateId: joi.string().required(),
    segmentId: joi.string().uuid().optional(),
    scheduledAt: joi.date().iso().optional(),
    priority: joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
    metadata: joi.object().unknown(true).optional()
  })
};

// ============================================
// VALIDATOR CLASS
// ============================================

export class Validator {
  static validateEmailAddress(data: unknown): { valid: boolean; error?: string; value?: unknown } {
    const result = schemas.emailAddress.validate(data, { abortEarly: false });
    return result.error
      ? { valid: false, error: result.error.details.map(d => d.message).join(', ') }
      : { valid: true, value: result.value };
  }

  static validatePhoneNumber(data: unknown): { valid: boolean; error?: string; value?: unknown } {
    const result = schemas.phoneNumber.validate(data, { abortEarly: false });
    return result.error
      ? { valid: false, error: result.error.details.map(d => d.message).join(', ') }
      : { valid: true, value: result.value };
  }

  static validateDeviceToken(data: unknown): { valid: boolean; error?: string; value?: unknown } {
    const result = schemas.deviceToken.validate(data, { abortEarly: false });
    return result.error
      ? { valid: false, error: result.error.details.map(d => d.message).join(', ') }
      : { valid: true, value: result.value };
  }

  static validateEmailMessage(data: unknown): { valid: boolean; error?: string; value?: unknown } {
    const result = schemas.emailMessage.validate(data, { abortEarly: false });
    return result.error
      ? { valid: false, error: result.error.details.map(d => d.message).join(', ') }
      : { valid: true, value: result.value };
  }

  static validateSMSMessage(data: unknown): { valid: boolean; error?: string; value?: string } {
    const result = schemas.smsMessage.validate(data, { abortEarly: false });
    return result.error
      ? { valid: false, error: result.error.details.map(d => d.message).join(', ') }
      : { valid: true, value: result.value };
  }

  static validateWhatsAppMessage(data: unknown): { valid: boolean; error?: string; value?: unknown } {
    const result = schemas.whatsappMessage.validate(data, { abortEarly: false });
    return result.error
      ? { valid: false, error: result.error.details.map(d => d.message).join(', ') }
      : { valid: true, value: result.value };
  }

  static validatePushNotification(data: unknown): { valid: boolean; error?: string; value?: unknown } {
    const result = schemas.pushNotification.validate(data, { abortEarly: false });
    return result.error
      ? { valid: false, error: result.error.details.map(d => d.message).join(', ') }
      : { valid: true, value: result.value };
  }

  static validateCampaign(data: unknown): { valid: boolean; error?: string; value?: unknown } {
    const result = schemas.campaign.validate(data, { abortEarly: false });
    return result.error
      ? { valid: false, error: result.error.details.map(d => d.message).join(', ') }
      : { valid: true, value: result.value };
  }

  /**
   * Validate using Zod schema
   */
  static validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown): { valid: boolean; error?: string; value?: T } {
    const result = schema.safeParse(data);
    if (!result.success) {
      return {
        valid: false,
        error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      };
    }
    return { valid: true, value: result.data };
  }
}
