import { AddressValidationService } from '../services/addressValidation';

describe('AddressValidationService', () => {
  let service: AddressValidationService;

  beforeEach(() => {
    service = new AddressValidationService();
  });

  describe('generateAddressHash', () => {
    it('should generate consistent hash for same address', () => {
      const address = {
        street: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
      };

      const hash1 = service.generateAddressHash(address);
      const hash2 = service.generateAddressHash(address);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different addresses', () => {
      const address1 = {
        street: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
      };

      const address2 = {
        street: '456 Other Street',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        country: 'India',
      };

      const hash1 = service.generateAddressHash(address1);
      const hash2 = service.generateAddressHash(address2);

      expect(hash1).not.toBe(hash2);
    });

    it('should normalize address before hashing', () => {
      const address1 = {
        street: '123 MAIN STREET',
        city: 'mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'INDIA',
      };

      const address2 = {
        street: '123 main street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
      };

      const hash1 = service.generateAddressHash(address1);
      const hash2 = service.generateAddressHash(address2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('calculateQualityScore', () => {
    it('should give high score to complete addresses', () => {
      const address = {
        fullAddress: '123 Main Street, Near Metro Station, Andheri West',
        street: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
        landmark: 'Near Metro Station',
        latitude: 19.1355,
        longitude: 72.8463,
      };

      const score = service.calculateQualityScore(address);
      expect(score).toBeGreaterThan(70);
    });

    it('should penalize incomplete addresses', () => {
      const address = {
        fullAddress: '123 Main',
        street: '123 Main',
        pincode: '400001',
      };

      const score = service.calculateQualityScore(address);
      expect(score).toBeLessThan(70);
    });

    it('should penalize invalid pincode', () => {
      const address = {
        fullAddress: '123 Main Street',
        street: '123 Main Street',
        city: 'Mumbai',
        pincode: '1234', // Invalid - should be 6 digits
      };

      const score = service.calculateQualityScore(address);
      expect(score).toBeLessThan(60);
    });
  });

  describe('validatePincode', () => {
    it('should return pincode data for valid pincodes', () => {
      const data = service.validatePincode('110001');
      expect(data).not.toBeNull();
      expect(data?.city).toBe('Delhi');
    });

    it('should return null for invalid pincodes', () => {
      const data = service.validatePincode('999999');
      expect(data).toBeNull();
    });
  });
});
