import { twilioService } from '../src/services/twilioService';

describe('TwilioService', () => {
  describe('formatWhatsAppAddress', () => {
    it('should format phone number with + prefix correctly', () => {
      const formatted = twilioService as any;
      const result = formatted.formatWhatsAppAddress('+14155551234');
      expect(result).toBe('whatsapp:+14155551234');
    });

    it('should format phone number without + prefix correctly', () => {
      const formatted = twilioService as any;
      const result = formatted.formatWhatsAppAddress('14155551234');
      expect(result).toBe('whatsapp:+14155551234');
    });

    it('should handle already formatted whatsapp addresses', () => {
      const formatted = twilioService as any;
      const result = formatted.formatWhatsAppAddress('whatsapp:+14155551234');
      expect(result).toBe('whatsapp:+14155551234');
    });

    it('should handle phone numbers with special characters', () => {
      const formatted = twilioService as any;
      const result = formatted.formatWhatsAppAddress('+1 (415) 555-1234');
      expect(result).toBe('whatsapp:+14155551234');
    });
  });
});
