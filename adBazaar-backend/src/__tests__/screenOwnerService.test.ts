/**
 * AdBazaar - Screen Owner Service Tests
 */

import {
  registerOwner,
  addScreen,
  getScreen,
  updateScreenPrice,
} from '../services/screenOwnerService';

describe('Screen Owner Service', () => {
  describe('registerOwner', () => {
    it('should register a new screen owner', () => {
      const owner = registerOwner({
        userId: 'user-123',
        businessName: 'Test Hotels',
        gstin: '27AABCU9603R1ZM',
      });

      expect(owner.ownerId).toBeDefined();
      expect(owner.businessName).toBe('Test Hotels');
      expect(owner.userId).toBe('user-123');
      expect(owner.stats.totalScreens).toBe(0);
    });
  });

  describe('addScreen', () => {
    it('should add a screen to owner', () => {
      const owner = registerOwner({
        userId: 'user-456',
        businessName: 'Hotel Mumbai',
      });

      const screen = addScreen(owner.ownerId, {
        name: 'Lobby TV',
        screenType: 'hotel_tv',
        address: {
          street: '123 MG Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          pincode: '400001',
        },
        coordinates: { lat: 19.076, lng: 72.8777 },
        dimensions: { width: 55, height: 32, unit: 'inches' as const },
        floorPrice: { cpm: 200, currency: 'INR', minCampaignBudget: 10000 },
        availability: {
          timezone: 'Asia/Kolkata',
          slots: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '22:00' },
          ],
        },
      });

      expect(screen).toBeDefined();
      expect(screen?.screenType).toBe('hotel_tv');
      expect(screen?.captivityLevel).toBe('captive_private');
      expect(screen?.floorPrice.cpm).toBe(200);
    });
  });

  describe('updateScreenPrice', () => {
    it('should update floor price', () => {
      const owner = registerOwner({
        userId: 'user-789',
        businessName: 'Cab Service',
      });

      const screen = addScreen(owner.ownerId, {
        name: 'Cab Screen 1',
        screenType: 'cab_screen',
        address: {
          street: 'Main Street',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
          pincode: '110001',
        },
        coordinates: { lat: 28.7041, lng: 77.1025 },
        dimensions: { width: 10, height: 6, unit: 'inches' as const },
        floorPrice: { cpm: 100, currency: 'INR', minCampaignBudget: 5000 },
        availability: {
          timezone: 'Asia/Kolkata',
          slots: [],
        },
      });

      const updated = updateScreenPrice(owner.ownerId, screen!.screenId, {
        cpm: 150,
        currency: 'INR',
        minCampaignBudget: 5000,
      });

      expect(updated?.floorPrice.cpm).toBe(150);
    });
  });
});
