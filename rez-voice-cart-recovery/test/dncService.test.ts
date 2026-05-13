import mongoose from 'mongoose';
import { DncService } from '../src/services/dncService';

// Mock mongoose
jest.mock('mongoose', () => {
  const mDocument = {
    save: jest.fn().mockResolvedValue(true),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    bulkWrite: jest.fn()
  };

  const mModel = jest.fn().mockImplementation(() => mDocument);

  mModel.findOne = jest.fn();
  mModel.find = jest.fn();
  mModel.countDocuments = jest.fn();
  mModel.bulkWrite = jest.fn();
  mModel.deleteMany = jest.fn();

  return {
    Schema: jest.fn(),
    model: jest.fn(() => mModel),
    connect: jest.fn(),
    connection: {
      close: jest.fn()
    }
  };
});

describe('DncService', () => {
  let service: DncService;
  let mockDncModel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DncService();
    mockDncModel = mongoose.model('DNC');
  });

  describe('isPhoneDnc', () => {
    it('should return true for phone on DNC list', async () => {
      mockDncModel.findOne = jest.fn().mockResolvedValue({
        phone: '+919876543210',
        expiresAt: null
      });

      const result = await service.isPhoneDnc('+919876543210');
      expect(result).toBe(true);
    });

    it('should return false for phone not on DNC list', async () => {
      mockDncModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await service.isPhoneDnc('+919876543210');
      expect(result).toBe(false);
    });

    it('should return true for expired entry', async () => {
      mockDncModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await service.isPhoneDnc('+919876543210');
      expect(result).toBe(false);
    });
  });

  describe('addToDnc', () => {
    it('should add phone to DNC list', async () => {
      const mockEntry = {
        phone: '+919876543210',
        reason: 'Customer request',
        source: 'test',
        addedAt: new Date()
      };

      mockDncModel.findOneAndUpdate = jest.fn().mockResolvedValue(mockEntry);

      const result = await service.addToDnc('+919876543210', {
        reason: 'Customer request',
        source: 'test'
      });

      expect(result.phone).toBe('+919876543210');
      expect(mockDncModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should normalize Indian phone numbers', async () => {
      mockDncModel.findOneAndUpdate = jest.fn().mockResolvedValue({
        phone: '+919876543210'
      });

      await service.addToDnc('9876543210', { source: 'test' });

      const callArgs = mockDncModel.findOneAndUpdate.mock.calls[0];
      expect(callArgs[0].phone).toBe('+919876543210');
    });
  });

  describe('removeFromDnc', () => {
    it('should remove phone from DNC list', async () => {
      const mockModel = mongoose.model('DNC') as any;
      mockModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

      const result = await service.removeFromDnc('+919876543210');
      expect(result).toBe(true);
    });

    it('should return false if phone not found', async () => {
      const mockModel = mongoose.model('DNC') as any;
      mockModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 0 });

      const result = await service.removeFromDnc('+919876543210');
      expect(result).toBe(false);
    });
  });

  describe('bulkAddToDnc', () => {
    it('should add multiple entries', async () => {
      const mockModel = mongoose.model('DNC') as any;
      mockModel.bulkWrite = jest.fn().mockResolvedValue({
        upsertedCount: 2,
        modifiedCount: 0
      });

      const entries = [
        { phone: '+919876543210', source: 'test' },
        { phone: '+919876543211', source: 'test' }
      ];

      const result = await service.bulkAddToDnc(entries);

      expect(result.added).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return DNC statistics', async () => {
      const mockModel = mongoose.model('DNC') as any;
      mockModel.countDocuments = jest.fn()
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(90)  // active
        .mockResolvedValueOnce(10); // expired

      mockModel.aggregate = jest.fn().mockResolvedValue([
        { _id: 'customer_request', count: 50 },
        { _id: 'spam_reports', count: 40 }
      ]);

      const stats = await service.getStats();

      expect(stats.total).toBe(100);
      expect(stats.active).toBe(90);
      expect(stats.expired).toBe(10);
      expect(stats.bySource.customer_request).toBe(50);
    });
  });
});
