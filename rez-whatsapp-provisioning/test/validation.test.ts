import {
  merchantProvisionSchema,
  phoneNumberProvisionSchema,
  templateCreateSchema,
  paginationSchema,
  phoneNumberSearchSchema,
} from '../src/middleware/validation';

describe('Validation Schemas', () => {
  describe('merchantProvisionSchema', () => {
    it('should validate a valid merchant provision request', () => {
      const validData = {
        merchantId: 'merchant-123',
        businessName: 'Test Business',
        businessEmail: 'test@example.com',
        businessPhone: '+1234567890',
        industry: 'Retail',
        useCase: 'Customer Support',
      };

      const result = merchantProvisionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        merchantId: 'merchant-123',
        businessName: 'Test Business',
        businessEmail: 'not-an-email',
        businessPhone: '+1234567890',
        industry: 'Retail',
        useCase: 'Customer Support',
      };

      const result = merchantProvisionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        merchantId: 'merchant-123',
      };

      const result = merchantProvisionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional webhookUrl', () => {
      const validData = {
        merchantId: 'merchant-123',
        businessName: 'Test Business',
        businessEmail: 'test@example.com',
        businessPhone: '+1234567890',
        industry: 'Retail',
        useCase: 'Customer Support',
        webhookUrl: 'https://example.com/webhook',
      };

      const result = merchantProvisionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid webhookUrl', () => {
      const invalidData = {
        merchantId: 'merchant-123',
        businessName: 'Test Business',
        businessEmail: 'test@example.com',
        businessPhone: '+1234567890',
        industry: 'Retail',
        useCase: 'Customer Support',
        webhookUrl: 'not-a-url',
      };

      const result = merchantProvisionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('phoneNumberProvisionSchema', () => {
    it('should validate a valid phone number provision request', () => {
      const validData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        countryCode: 'US',
      };

      const result = phoneNumberProvisionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid country code length', () => {
      const invalidData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        countryCode: 'USA',
      };

      const result = phoneNumberProvisionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid phone number type', () => {
      const validData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        countryCode: 'US',
        type: 'toll_free',
      };

      const result = phoneNumberProvisionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone number type', () => {
      const invalidData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        countryCode: 'US',
        type: 'invalid',
      };

      const result = phoneNumberProvisionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('templateCreateSchema', () => {
    it('should validate a valid template create request', () => {
      const validData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'order_confirmation',
        language: 'en',
        category: 'transactional',
        components: [
          {
            type: 'BODY',
            text: 'Hello {{1}}, your order is confirmed.',
          },
        ],
      };

      const result = templateCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject template name with uppercase', () => {
      const invalidData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'OrderConfirmation',
        language: 'en',
        category: 'transactional',
        components: [
          {
            type: 'BODY',
            text: 'Hello',
          },
        ],
      };

      const result = templateCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject template without components', () => {
      const invalidData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'order_confirmation',
        language: 'en',
        category: 'transactional',
        components: [],
      };

      const result = templateCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate template with header', () => {
      const validData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'order_confirmation',
        language: 'en',
        category: 'transactional',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Order Confirmed!',
          },
          {
            type: 'BODY',
            text: 'Hello {{1}}',
          },
        ],
      };

      const result = templateCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate template with buttons', () => {
      const validData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'order_confirmation',
        language: 'en',
        category: 'transactional',
        components: [
          {
            type: 'BODY',
            text: 'Hello {{1}}',
          },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'URL',
                text: 'Track Order',
                url: 'https://example.com/track',
              },
              {
                type: 'QUICK_REPLY',
                text: 'Get Help',
              },
            ],
          },
        ],
      };

      const result = templateCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject more than 3 buttons', () => {
      const invalidData = {
        merchantId: 'merchant-123',
        subaccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'order_confirmation',
        language: 'en',
        category: 'transactional',
        components: [
          {
            type: 'BODY',
            text: 'Hello',
          },
          {
            type: 'BUTTONS',
            buttons: [
              { type: 'QUICK_REPLY', text: 'Button 1' },
              { type: 'QUICK_REPLY', text: 'Button 2' },
              { type: 'QUICK_REPLY', text: 'Button 3' },
              { type: 'QUICK_REPLY', text: 'Button 4' },
            ],
          },
        ],
      };

      const result = templateCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should validate valid pagination params', () => {
      const validData = {
        page: '1',
        limit: '20',
      };

      const result = paginationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should reject page less than 1', () => {
      const invalidData = {
        page: '0',
      };

      const result = paginationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const invalidData = {
        limit: '150',
      };

      const result = paginationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('phoneNumberSearchSchema', () => {
    it('should validate a valid search request', () => {
      const validData = {
        countryCode: 'US',
        type: 'local',
        areaCode: '415',
        limit: 10,
      };

      const result = phoneNumberSearchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid country code', () => {
      const invalidData = {
        countryCode: 'USA',
      };

      const result = phoneNumberSearchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
