/**
 * DOOH Service - Money Utilities Tests
 */

import {
  money,
  moneyFromCents,
  toCents,
  fromCents,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  calculateCPMCost,
  calculateCPM,
  calculateSlotPrice,
  formatMoney,
  formatMoneyCompact,
  isPositiveMoney,
  isNonNegativeMoney,
  zeroMoney,
} from '../money';

describe('Money Creation', () => {
  describe('money()', () => {
    it('should create money with default currency (INR)', () => {
      const m = money(100);
      expect(m.currency).toBe('INR');
      expect(m.amount).toBe(10000); // 100 * 100 cents
    });

    it('should create money with custom currency', () => {
      const m = money(50, 'USD');
      expect(m.currency).toBe('USD');
      expect(m.amount).toBe(5000);
    });

    it('should handle decimal amounts', () => {
      const m = money(99.99);
      expect(m.amount).toBe(9999); // Rounded
    });

    it('should handle zero', () => {
      const m = money(0);
      expect(m.amount).toBe(0);
    });
  });

  describe('moneyFromCents()', () => {
    it('should create money from cents', () => {
      const m = moneyFromCents(5000, 'INR');
      expect(m.amount).toBe(5000);
      expect(m.currency).toBe('INR');
    });
  });

  describe('toCents()', () => {
    it('should convert to cents for INR', () => {
      expect(toCents(100, 'INR')).toBe(10000);
      expect(toCents(99.99, 'INR')).toBe(9999);
    });

    it('should handle JPY (no decimals)', () => {
      expect(toCents(100, 'JPY')).toBe(100); // No multiplication
    });
  });

  describe('fromCents()', () => {
    it('should convert from cents for INR', () => {
      expect(fromCents(10000, 'INR')).toBe(100);
      expect(fromCents(9999, 'INR')).toBe(99.99);
    });
  });

  describe('zeroMoney()', () => {
    it('should create zero money', () => {
      const m = zeroMoney('INR');
      expect(m.amount).toBe(0);
      expect(m.currency).toBe('INR');
    });
  });
});

describe('Money Arithmetic', () => {
  describe('addMoney()', () => {
    it('should add two money amounts', () => {
      const a = money(100);
      const b = money(50);
      const result = addMoney(a, b);
      expect(result.amount).toBe(15000);
    });

    it('should throw for different currencies', () => {
      const a = money(100, 'INR');
      const b = money(50, 'USD');
      expect(() => addMoney(a, b)).toThrow();
    });
  });

  describe('subtractMoney()', () => {
    it('should subtract money amounts', () => {
      const a = money(100);
      const b = money(30);
      const result = subtractMoney(a, b);
      expect(result.amount).toBe(7000);
    });

    it('should handle negative results', () => {
      const a = money(30);
      const b = money(100);
      const result = subtractMoney(a, b);
      expect(result.amount).toBe(-7000);
    });
  });

  describe('multiplyMoney()', () => {
    it('should multiply money by a factor', () => {
      const m = money(100);
      const result = multiplyMoney(m, 1.5);
      expect(result.amount).toBe(15000);
    });

    it('should round the result', () => {
      const m = money(100);
      const result = multiplyMoney(m, 1.333);
      expect(result.amount).toBe(13330); // Rounded
    });
  });

  describe('divideMoney()', () => {
    it('should divide money by a number', () => {
      const m = money(100);
      const result = divideMoney(m, 4);
      expect(result.amount).toBe(2500);
    });

    it('should throw for division by zero', () => {
      const m = money(100);
      expect(() => divideMoney(m, 0)).toThrow();
    });
  });
});

describe('CPM Calculations', () => {
  describe('calculateCPMCost()', () => {
    it('should calculate cost for given impressions', () => {
      const cpm = money(10); // ₹10 per 1000 impressions
      const cost = calculateCPMCost(cpm, 10000); // 10k impressions
      expect(cost.amount).toBe(100); // ₹100
    });

    it('should handle zero impressions', () => {
      const cpm = money(10);
      const cost = calculateCPMCost(cpm, 0);
      expect(cost.amount).toBe(0);
    });

    it('should handle small impression counts', () => {
      const cpm = money(10);
      const cost = calculateCPMCost(cpm, 100); // 100 impressions
      expect(cost.amount).toBe(1); // ₹1
    });
  });

  describe('calculateCPM()', () => {
    it('should calculate CPM from cost and impressions', () => {
      const cost = money(100);
      const cpm = calculateCPM(cost, 10000);
      expect(cpm.amount).toBe(10); // ₹10
    });

    it('should return zero for zero impressions', () => {
      const cost = money(100);
      const cpm = calculateCPM(cost, 0);
      expect(cpm.amount).toBe(0);
    });
  });

  describe('calculateSlotPrice()', () => {
    it('should calculate slot price for 30-second slot', () => {
      const cpm = money(30); // ₹30 CPM
      const price = calculateSlotPrice(cpm, 30);
      expect(price.amount).toBe(3); // ₹3
    });

    it('should adjust price for different durations', () => {
      const cpm = money(30);
      const price15 = calculateSlotPrice(cpm, 15);
      const price60 = calculateSlotPrice(cpm, 60);

      expect(price15.amount).toBe(1.5);
      expect(price60.amount).toBe(6);
    });
  });
});

describe('Money Formatting', () => {
  describe('formatMoney()', () => {
    it('should format INR correctly', () => {
      const m = money(1234.56);
      const formatted = formatMoney(m);
      expect(formatted).toContain('₹');
      expect(formatted).toContain('1,234.56');
    });

    it('should format USD correctly', () => {
      const m = moneyFromCents(123456, 'USD');
      const formatted = formatMoney(m);
      expect(formatted).toContain('$');
      expect(formatted).toContain('1,234.56');
    });
  });

  describe('formatMoneyCompact()', () => {
    it('should format thousands as K', () => {
      const m = moneyFromCents(1500000, 'INR'); // ₹15,000
      const formatted = formatMoneyCompact(m);
      expect(formatted).toContain('15');
      expect(formatted.toLowerCase()).toContain('k');
    });

    it('should format lakhs as L', () => {
      const m = moneyFromCents(15000000, 'INR'); // ₹1,50,000
      const formatted = formatMoneyCompact(m);
      expect(formatted.toLowerCase()).toContain('l');
    });

    it('should format crores as Cr', () => {
      const m = moneyFromCents(150000000, 'INR'); // ₹1,50,00,000
      const formatted = formatMoneyCompact(m);
      expect(formatted.toLowerCase()).toContain('cr');
    });
  });
});

describe('Money Validation', () => {
  describe('isPositiveMoney()', () => {
    it('should return true for positive amounts', () => {
      const m = money(100);
      expect(isPositiveMoney(m)).toBe(true);
    });

    it('should return false for zero', () => {
      const m = zeroMoney();
      expect(isPositiveMoney(m)).toBe(false);
    });

    it('should return false for negative', () => {
      const m = money(-100);
      expect(isPositiveMoney(m)).toBe(false);
    });
  });

  describe('isNonNegativeMoney()', () => {
    it('should return true for positive amounts', () => {
      const m = money(100);
      expect(isNonNegativeMoney(m)).toBe(true);
    });

    it('should return true for zero', () => {
      const m = zeroMoney();
      expect(isNonNegativeMoney(m)).toBe(true);
    });

    it('should return false for negative', () => {
      const m = money(-100);
      expect(isNonNegativeMoney(m)).toBe(false);
    });
  });
});
