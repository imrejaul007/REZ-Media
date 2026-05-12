import { getTwilioClient, twilioConfig } from '../config/twilio.config';
import { logger } from '../utils/logger';
import Template from '../models/Template';
import MerchantWhatsApp from '../models/MerchantWhatsApp';
import { TemplateCategory, TemplateStatus } from '../types';
import { provisioningLimits } from '../config/twilio.config';

export interface TemplateComponentInput {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  mediaUrl?: string;
  buttons?: {
    type: 'PHONE_NUMBER' | 'URL' | 'QUICK_REPLY';
    text: string;
    phoneNumber?: string;
    url?: string;
  }[];
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
}

export interface TemplateCreateRequest {
  merchantId: string;
  subaccountSid: string;
  name: string;
  language: string;
  category: TemplateCategory;
  components: TemplateComponentInput[];
}

export interface TemplateUpdateRequest {
  merchantId: string;
  twilioSid: string;
  components?: TemplateComponentInput[];
}

class TemplateService {
  private client = getTwilioClient();

  async createTemplate(request: TemplateCreateRequest): Promise<{
    template: typeof Template.prototype;
    twilioSid: string;
    status: string;
  }> {
    try {
      const merchant = await MerchantWhatsApp.findByMerchantId(request.merchantId);

      if (!merchant) {
        throw new Error('Merchant not found');
      }

      if (merchant.status !== 'active') {
        throw new Error('Merchant account is not active');
      }

      const existingCount = await Template.countDocuments({
        merchantId: request.merchantId,
        status: { $nin: [TemplateStatus.DELETED] },
      });

      if (existingCount >= provisioningLimits.maxTemplatesPerMerchant) {
        throw new Error(
          `Maximum template limit (${provisioningLimits.maxTemplatesPerMerchant}) reached`
        );
      }

      const existingTemplate = await Template.findByNameAndMerchant(
        request.merchantId,
        request.name
      );

      if (existingTemplate) {
        throw new Error(`Template with name "${request.name}" already exists`);
      }

      this.validateComponents(request.components);

      logger.info('Creating WhatsApp template', {
        merchantId: request.merchantId,
        templateName: request.name,
        language: request.language,
        category: request.category,
      });

      const templateParams = this.buildTwilioTemplateParams(request);

      const twilioTemplate = await this.client.conversations.v1
        .conversations('CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
        .webhooks.create({
          'PostWebhookAuthorization': [],
          'PostWebhookFilters': ['onMessageSend'],
          'PostWebhookUrl': templateParams.webhookUrl,
          'WebhookMethod': 'POST',
          'WebhookSource': 'Studio',
        });

      const friendlyName = `${request.name}_${request.language}_${Date.now()}`;

      const whatsappTemplate = await this.client.messages.v1
        .templates(friendlyName)
        .create({
          language: request.language,
          templateName: request.name,
          category: this.mapCategoryToTwilio(request.category),
          parts: this.buildTemplateParts(request.components),
        } as any);

      const templateRecord = new Template({
        merchantId: request.merchantId,
        subaccountSid: request.subaccountSid,
        twilioSid: whatsappTemplate.sid || twilioTemplate.sid,
        name: request.name,
        language: request.language,
        category: request.category,
        status: TemplateStatus.PENDING,
        components: request.components,
        twilioDetails: {
          friendlyName: whatsappTemplate.friendlyName || friendlyName,
          dateCreated: new Date(),
        },
        metadata: {},
      });

      await templateRecord.save();

      logger.info('Template created successfully', {
        merchantId: request.merchantId,
        templateName: request.name,
        twilioSid: templateRecord.twilioSid,
      });

      return {
        template: templateRecord,
        twilioSid: templateRecord.twilioSid,
        status: 'PENDING',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create template', {
        merchantId: request.merchantId,
        templateName: request.name,
        error: errorMessage,
      });
      throw error;
    }
  }

  async getTemplate(templateSid: string): Promise<typeof Template.prototype | null> {
    try {
      return await Template.findByTwilioSid(templateSid);
    } catch (error) {
      logger.error('Failed to get template', { templateSid });
      throw error;
    }
  }

  async updateTemplate(
    merchantId: string,
    templateName: string,
    updates: {
      language?: string;
      components?: TemplateComponentInput[];
    }
  ): Promise<typeof Template.prototype> {
    try {
      const template = await Template.findOne({
        merchantId,
        name: templateName,
        status: { $nin: [TemplateStatus.DELETED] },
      });

      if (!template) {
        throw new Error('Template not found');
      }

      if (template.status === TemplateStatus.APPROVED) {
        throw new Error('Cannot update approved template. Create a new version.');
      }

      if (updates.components) {
        this.validateComponents(updates.components);
        template.components = updates.components;
      }

      if (updates.language) {
        template.language = updates.language;
      }

      await template.save();

      logger.info('Template updated', {
        merchantId,
        templateName,
      });

      return template;
    } catch (error) {
      logger.error('Failed to update template', {
        merchantId,
        templateName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async deleteTemplate(
    merchantId: string,
    templateSid: string
  ): Promise<{ success: boolean }> {
    try {
      const template = await Template.findOne({
        merchantId,
        twilioSid: templateSid,
      });

      if (!template) {
        throw new Error('Template not found');
      }

      if (template.status === TemplateStatus.DELETED) {
        throw new Error('Template already deleted');
      }

      template.status = TemplateStatus.DELETED;
      await template.save();

      logger.info('Template deleted', {
        merchantId,
        templateSid,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete template', {
        merchantId,
        templateSid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async listTemplates(
    merchantId: string,
    options: {
      status?: TemplateStatus;
      category?: TemplateCategory;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    templates: typeof Template[];
    total: number;
  }> {
    try {
      const query: Record<string, unknown> = {
        merchantId,
        status: { $ne: TemplateStatus.DELETED },
      };

      if (options.status) {
        query.status = options.status;
      }

      if (options.category) {
        query.category = options.category;
      }

      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const [templates, total] = await Promise.all([
        Template.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Template.countDocuments(query),
      ]);

      return { templates, total };
    } catch (error) {
      logger.error('Failed to list templates', {
        merchantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async handleTemplateStatusUpdate(
    twilioSid: string,
    status: string,
    reason?: string
  ): Promise<void> {
    try {
      const template = await Template.findByTwilioSid(twilioSid);

      if (!template) {
        logger.warn('Template not found for status update', { twilioSid });
        return;
      }

      const mappedStatus = this.mapTwilioStatus(status);

      template.status = mappedStatus;

      if (mappedStatus === TemplateStatus.REJECTED && reason) {
        template.rejection = {
          reason,
          rejectedAt: new Date(),
        };
      }

      if (mappedStatus === TemplateStatus.APPROVED) {
        const merchant = await MerchantWhatsApp.findByMerchantId(template.merchantId);
        if (merchant) {
          merchant.provisioning.templatesApproved += 1;
          await merchant.save();
        }
      }

      await template.save();

      logger.info('Template status updated', {
        twilioSid,
        previousStatus: template.status,
        newStatus: mappedStatus,
        reason,
      });
    } catch (error) {
      logger.error('Failed to handle template status update', {
        twilioSid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getApprovedTemplates(merchantId: string): Promise<typeof Template[]> {
    try {
      return await Template.findApprovedByMerchantId(merchantId);
    } catch (error) {
      logger.error('Failed to get approved templates', {
        merchantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private validateComponents(components: TemplateComponentInput[]): void {
    if (!components || components.length === 0) {
      throw new Error('Template must have at least one component');
    }

    const hasBody = components.some(c => c.type === 'BODY');
    if (!hasBody) {
      throw new Error('Template must have a BODY component');
    }

    for (const component of components) {
      if (component.type === 'HEADER') {
        if (!component.format) {
          throw new Error('HEADER component must have a format');
        }

        if (component.format === 'TEXT' && !component.text) {
          throw new Error('TEXT HEADER must have text content');
        }

        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format) && !component.mediaUrl) {
          throw new Error(`${component.format} HEADER must have a mediaUrl`);
        }
      }

      if (component.type === 'BUTTONS') {
        if (!component.buttons || component.buttons.length === 0) {
          throw new Error('BUTTONS component must have at least one button');
        }

        if (component.buttons.length > 3) {
          throw new Error('Maximum 3 buttons allowed per template');
        }

        for (const button of component.buttons) {
          if (button.type === 'URL' && !button.url) {
            throw new Error('URL button must have a url');
          }

          if (button.type === 'PHONE_NUMBER' && !button.phoneNumber) {
            throw new Error('PHONE_NUMBER button must have a phoneNumber');
          }
        }
      }
    }
  }

  private buildTwilioTemplateParams(request: TemplateCreateRequest): {
    webhookUrl: string;
  } {
    return {
      webhookUrl: `${process.env.WEBHOOK_BASE_URL || 'http://localhost:3005'}/webhooks/whatsapp/template`,
    };
  }

  private buildTemplateParts(components: TemplateComponentInput[]): any[] {
    const parts: any[] = [];

    for (const component of components) {
      const part: any = {
        type: component.type,
      };

      if (component.type === 'HEADER') {
        if (component.format === 'TEXT') {
          part.text = component.text;
        } else {
          part.mediaUrl = component.mediaUrl;
        }
      }

      if (component.type === 'BODY') {
        part.text = component.text;
        if (component.example?.body_text) {
          part.example = { body_text: component.example.body_text };
        }
      }

      if (component.type === 'FOOTER') {
        part.text = component.text;
      }

      if (component.type === 'BUTTONS') {
        part.buttons = component.buttons?.map(btn => ({
          type: btn.type,
          text: btn.text,
          phoneNumber: btn.phoneNumber,
          url: btn.url,
        }));
      }

      parts.push(part);
    }

    return parts;
  }

  private mapCategoryToTwilio(category: TemplateCategory): string {
    const mapping: Record<TemplateCategory, string> = {
      [TemplateCategory.MARKETING]: 'MARKETING',
      [TemplateCategory.UTILITY]: 'UTILITY',
      [TemplateCategory.AUTHENTICATION]: 'AUTHENTICATION',
    };

    return mapping[category] || 'MARKETING';
  }

  private mapTwilioStatus(status: string): TemplateStatus {
    const mapping: Record<string, TemplateStatus> = {
      APPROVED: TemplateStatus.APPROVED,
      PENDING: TemplateStatus.PENDING,
      REJECTED: TemplateStatus.REJECTED,
      FLAGGED: TemplateStatus.FLAGGED,
    };

    return mapping[status.toUpperCase()] || TemplateStatus.PENDING;
  }
}

export const templateService = new TemplateService();
export default templateService;
