/**
 * Template Engine - Handlebars-based template management
 * Provides template rendering, registration, and management for all channels
 */

import Handlebars from 'handlebars';
import { v4 as uuidv4 } from 'uuid';
import {
  ITemplateEngine,
  TemplateMetadata,
  ChannelType
} from '../types';
import { TemplateError } from '../utils/errors';
import { logger, LogContext } from '../utils/logger';

export class TemplateEngine implements ITemplateEngine {
  private templates: Map<string, { source: string; compiled: HandlebarsTemplateDelegate; metadata: TemplateMetadata }>;
  private log: LogContext;
  private builtInHelpers: boolean = false;

  constructor() {
    this.templates = new Map();
    this.log = new LogContext(logger, { service: 'TemplateEngine' });

    this.registerBuiltInHelpers();
    this.registerDefaultTemplates();
  }

  /**
   * Register built-in Handlebars helpers
   */
  private registerBuiltInHelpers(): void {
    if (this.builtInHelpers) return;

    // Conditional helper
    Handlebars.registerHelper('iff', (v1: unknown, operator: string, v2: unknown, options: Handlebars.HelperOptions) => {
      if (operator === '==' || operator === '===') {
        return v1 === v2 ? options.fn(this) : options.inverse(this);
      }
      if (operator === '!=' || operator === '!==') {
        return v1 !== v2 ? options.fn(this) : options.inverse(this);
      }
      if (operator === '>') {
        return (v1 as number) > (v2 as number) ? options.fn(this) : options.inverse(this);
      }
      if (operator === '<') {
        return (v1 as number) < (v2 as number) ? options.fn(this) : options.inverse(this);
      }
      return options.inverse(this);
    });

    // Format date helper
    Handlebars.registerHelper('formatDate', (date: Date | string, format: string = 'YYYY-MM-DD') => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    // Uppercase helper
    Handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    // Lowercase helper
    Handlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    // Capitalize helper
    Handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // Currency formatter
    Handlebars.registerHelper('currency', (amount: number, currency: string = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(amount);
    });

    // Number formatter
    Handlebars.registerHelper('formatNumber', (num: number, decimals: number = 0) => {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(num);
    });

    // Array index helper
    Handlebars.registerHelper('indexOf', (arr: unknown[], item: unknown) => {
      return arr ? arr.indexOf(item) : -1;
    });

    // Array length helper
    Handlebars.registerHelper('length', (arr: unknown[]) => {
      return arr ? arr.length : 0;
    });

    // First item helper
    Handlebars.registerHelper('first', (arr: unknown[]) => {
      return arr && arr.length > 0 ? arr[0] : null;
    });

    // Join array helper
    Handlebars.registerHelper('join', (arr: unknown[], separator: string = ', ') => {
      return arr ? arr.join(separator) : '';
    });

    // Default value helper
    Handlebars.registerHelper('default', (value: unknown, defaultValue: unknown) => {
      return value !== undefined && value !== null ? value : defaultValue;
    });

    // JSON stringify helper
    Handlebars.registerHelper('json', (obj: unknown) => {
      return JSON.stringify(obj);
    });

    // Increment helper
    Handlebars.registerHelper('inc', (num: number) => {
      return num + 1;
    });

    // Times/repeat helper
    Handlebars.registerHelper('times', (n: number, options: Handlebars.HelperOptions) => {
      let result = '';
      for (let i = 0; i < n; i++) {
        result += options.fn({ index: i });
      }
      return result;
    });

    this.builtInHelpers = true;
    this.log.debug('Registered built-in Handlebars helpers');
  }

  /**
   * Register default templates
   */
  private registerDefaultTemplates(): void {
    // Welcome email template
    this.registerTemplate('welcome-email', `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to {{companyName}}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c3e50;">Welcome, {{firstName}}!</h1>
          <p>Thank you for joining {{companyName}}. We're excited to have you on board.</p>
          <p>Here are some things you can do to get started:</p>
          <ul>
            <li>Complete your profile</li>
            <li>Explore our features</li>
            <li>Connect with other users</li>
          </ul>
          <p><a href="{{activationUrl}}" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #7f8c8d; font-size: 12px;">
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      </body>
      </html>
    `, {
      channel: ChannelType.EMAIL,
      subject: 'Welcome to {{companyName}}!',
      name: 'Welcome Email'
    });

    // Password reset template
    this.registerTemplate('password-reset', `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #e74c3c;">Password Reset Request</h1>
          <p>Hi {{firstName}},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="{{resetUrl}}" style="background-color: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          </p>
          <p>This link will expire in {{expiryHours}} hours.</p>
          <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
        </div>
      </body>
      </html>
    `, {
      channel: ChannelType.EMAIL,
      subject: 'Reset Your Password',
      name: 'Password Reset'
    });

    // Order confirmation template
    this.registerTemplate('order-confirmation', `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #27ae60;">Order Confirmed!</h1>
          <p>Thank you for your order, {{customerName}}!</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Order Number:</strong> {{orderNumber}}</p>
            <p><strong>Order Date:</strong> {{orderDate}}</p>
            <p><strong>Total Amount:</strong> {{totalAmount}}</p>
          </div>
          <h3>Items Ordered:</h3>
          <ul>
            {{#each items}}
            <li>{{name}} x {{quantity}} - {{price}}</li>
            {{/each}}
          </ul>
          <p>We'll send you another email when your order ships.</p>
        </div>
      </body>
      </html>
    `, {
      channel: ChannelType.EMAIL,
      subject: 'Order Confirmation - {{orderNumber}}',
      name: 'Order Confirmation'
    });

    // SMS templates
    this.registerTemplate('otp-sms', 'Your verification code is: {{code}}. It expires in {{expiryMinutes}} minutes. Do not share this code.', {
      channel: ChannelType.SMS,
      name: 'OTP SMS'
    });

    this.registerTemplate('order-status-sms', 'Hi {{customerName}}, your order {{orderNumber}} is now {{status}}. Track: {{trackingUrl}}', {
      channel: ChannelType.SMS,
      name: 'Order Status SMS'
    });

    // WhatsApp templates
    this.registerTemplate('welcome-whatsapp', 'Hello {{firstName}}! Welcome to {{companyName}}. We\'re thrilled to have you! 🎉\n\nNeed help? Reply anytime!', {
      channel: ChannelType.WHATSAPP,
      name: 'Welcome WhatsApp'
    });

    this.registerTemplate('appointment-reminder-whatsapp', 'Reminder: You have an appointment tomorrow at {{time}}.\n\nService: {{serviceName}}\nLocation: {{location}}', {
      channel: ChannelType.WHATSAPP,
      name: 'Appointment Reminder'
    });

    // Push notification templates
    this.registerTemplate('new-message-push', 'New message from {{senderName}}', {
      channel: ChannelType.PUSH,
      name: 'New Message Push'
    });

    this.registerTemplate('promo-push', '{{title}}\n{{description}}\n{{ctaText}}', {
      channel: ChannelType.PUSH,
      name: 'Promotional Push'
    });

    this.log.info('Registered default templates', { count: this.templates.size });
  }

  /**
   * Render a registered template with variables
   */
  async render(templateId: string, variables: Record<string, unknown>): Promise<string> {
    const template = this.templates.get(templateId);

    if (!template) {
      throw new TemplateError(`Template not found: ${templateId}`, 'TEMPLATE_NOT_FOUND');
    }

    try {
      const result = template.compiled(variables);
      this.log.debug('Template rendered', { templateId, variables: Object.keys(variables) });
      return result;
    } catch (error) {
      const err = error as Error;
      this.log.error('Template render failed', error, { templateId });
      throw new TemplateError(
        `Failed to render template: ${err.message}`,
        'RENDER_FAILED',
        { details: { templateId } }
      );
    }
  }

  /**
   * Render a raw template string with variables
   */
  renderRaw(template: string, variables: Record<string, unknown>): string {
    try {
      const compiled = Handlebars.compile(template);
      return compiled(variables);
    } catch (error) {
      const err = error as Error;
      throw new TemplateError(
        `Failed to compile template: ${err.message}`,
        'COMPILE_FAILED'
      );
    }
  }

  /**
   * Register a new template
   */
  registerTemplate(templateId: string, template: string, metadata?: Partial<TemplateMetadata>): void {
    try {
      const compiled = Handlebars.compile(template);
      const variables = this.extractVariables(template);

      const templateMetadata: TemplateMetadata = {
        id: templateId,
        name: metadata?.name || templateId,
        channel: metadata?.channel || ChannelType.EMAIL,
        subject: metadata?.subject,
        variables,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.templates.set(templateId, {
        source: template,
        compiled,
        metadata: templateMetadata
      });

      this.log.info('Template registered', { templateId, variables, channel: templateMetadata.channel });
    } catch (error) {
      const err = error as Error;
      throw new TemplateError(
        `Failed to register template: ${err.message}`,
        'REGISTER_FAILED',
        { details: { templateId } }
      );
    }
  }

  /**
   * List all registered templates
   */
  listTemplates(): TemplateMetadata[] {
    return Array.from(this.templates.values()).map(t => t.metadata);
  }

  /**
   * Get template metadata
   */
  getTemplate(templateId: string): TemplateMetadata | undefined {
    return this.templates.get(templateId)?.metadata;
  }

  /**
   * Delete a template
   */
  deleteTemplate(templateId: string): boolean {
    const deleted = this.templates.delete(templateId);
    if (deleted) {
      this.log.info('Template deleted', { templateId });
    }
    return deleted;
  }

  /**
   * Update a template
   */
  updateTemplate(templateId: string, template: string, metadata?: Partial<TemplateMetadata>): void {
    if (!this.templates.has(templateId)) {
      throw new TemplateError(`Template not found: ${templateId}`, 'TEMPLATE_NOT_FOUND');
    }

    this.registerTemplate(templateId, template, {
      ...this.templates.get(templateId)!.metadata,
      ...metadata,
      updatedAt: new Date()
    });
  }

  /**
   * Extract variable names from a template
   */
  private extractVariables(template: string): string[] {
    const variableRegex = /\{\{\s*(\w+)[^}]*\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      // Exclude built-in helpers
      if (!['if', 'each', 'unless', 'with', 'lookup', 'log'].includes(match[1])) {
        variables.add(match[1]);
      }
    }

    return Array.from(variables);
  }

  /**
   * Compile template for preview (returns a function that takes variables)
   */
  compilePreview(template: string): (variables: Record<string, unknown>) => string {
    return Handlebars.compile(template);
  }

  /**
   * Validate a template without rendering
   */
  validate(template: string): { valid: boolean; errors?: string[]; warnings?: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const variables = new Set<string>();

    try {
      // Try to compile
      Handlebars.compile(template);

      // Extract and check variables
      const extractedVars = this.extractVariables(template);
      extractedVars.forEach(v => variables.add(v));

      // Check for common issues
      if (template.includes('{{{' ) && !template.includes('{{{' )) {
        // Triple braces are safe, double check for unescaped HTML
        warnings.push('Template contains unescaped content');
      }

      if (variables.size === 0) {
        warnings.push('Template has no variables');
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: [(error as Error).message]
      };
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createTemplateEngine(): TemplateEngine {
  return new TemplateEngine();
}
