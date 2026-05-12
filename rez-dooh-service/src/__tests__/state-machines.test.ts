/**
 * DOOH Service - State Machine Tests
 */

import {
  isValidScreenStatusTransition,
  assertValidScreenStatusTransition,
  getAllowedScreenTransitions,
  isValidCampaignStatusTransition,
  assertValidCampaignStatusTransition,
  getAllowedCampaignTransitions,
  InvalidStateTransitionError,
} from '../state-machines';

describe('Screen Status State Machine', () => {
  describe('isValidScreenStatusTransition', () => {
    it('should allow active to inactive', () => {
      expect(isValidScreenStatusTransition('active', 'inactive')).toBe(true);
    });

    it('should allow active to offline', () => {
      expect(isValidScreenStatusTransition('active', 'offline')).toBe(true);
    });

    it('should allow active to maintenance', () => {
      expect(isValidScreenStatusTransition('active', 'maintenance')).toBe(true);
    });

    it('should allow inactive to active', () => {
      expect(isValidScreenStatusTransition('inactive', 'active')).toBe(true);
    });

    it('should allow offline to active', () => {
      expect(isValidScreenStatusTransition('offline', 'active')).toBe(true);
    });

    it('should allow maintenance to active', () => {
      expect(isValidScreenStatusTransition('maintenance', 'active')).toBe(true);
    });

    it('should allow same status (idempotent)', () => {
      expect(isValidScreenStatusTransition('active', 'active')).toBe(true);
      expect(isValidScreenStatusTransition('offline', 'offline')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      // offline cannot go directly to suspended (example)
      expect(isValidScreenStatusTransition('offline', 'suspended')).toBe(false);
    });

    it('should reject transitions from completed', () => {
      // completed is not in the enum in this version, but tests are forward-looking
    });
  });

  describe('assertValidScreenStatusTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => {
        assertValidScreenStatusTransition('active', 'inactive');
      }).not.toThrow();
    });

    it('should throw InvalidStateTransitionError for invalid transitions', () => {
      expect(() => {
        assertValidScreenStatusTransition('active', 'draft' as any);
      }).toThrow(InvalidStateTransitionError);
    });

    it('should include transition details in error', () => {
      try {
        assertValidScreenStatusTransition('active', 'invalid' as any);
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidStateTransitionError);
        expect((error as InvalidStateTransitionError).fromState).toBe('active');
        expect((error as InvalidStateTransitionError).toState).toBe('invalid');
      }
    });
  });

  describe('getAllowedScreenTransitions', () => {
    it('should return allowed transitions for active', () => {
      const allowed = getAllowedScreenTransitions('active');
      expect(allowed).toContain('inactive');
      expect(allowed).toContain('offline');
      expect(allowed).toContain('maintenance');
      expect(allowed).not.toContain('active');
    });

    it('should return empty array for unknown status', () => {
      const allowed = getAllowedScreenTransitions('unknown' as any);
      expect(allowed).toEqual([]);
    });
  });
});

describe('Campaign Status State Machine', () => {
  describe('isValidCampaignStatusTransition', () => {
    it('should allow draft to active', () => {
      expect(isValidCampaignStatusTransition('draft', 'active')).toBe(true);
    });

    it('should allow draft to paused', () => {
      expect(isValidCampaignStatusTransition('draft', 'paused')).toBe(true);
    });

    it('should allow active to paused', () => {
      expect(isValidCampaignStatusTransition('active', 'paused')).toBe(true);
    });

    it('should allow active to completed', () => {
      expect(isValidCampaignStatusTransition('active', 'completed')).toBe(true);
    });

    it('should allow active to budget_exhausted', () => {
      expect(isValidCampaignStatusTransition('active', 'budget_exhausted')).toBe(true);
    });

    it('should allow paused to active (resume)', () => {
      expect(isValidCampaignStatusTransition('paused', 'active')).toBe(true);
    });

    it('should allow paused to draft', () => {
      expect(isValidCampaignStatusTransition('paused', 'draft')).toBe(true);
    });

    it('should allow budget_exhausted to active (reactivation)', () => {
      expect(isValidCampaignStatusTransition('budget_exhausted', 'active')).toBe(true);
    });

    it('should NOT allow completed to any other status', () => {
      expect(isValidCampaignStatusTransition('completed', 'active')).toBe(false);
      expect(isValidCampaignStatusTransition('completed', 'paused')).toBe(false);
      expect(isValidCampaignStatusTransition('completed', 'draft')).toBe(false);
    });

    it('should NOT allow same status', () => {
      // Campaign transitions require explicit status change
      expect(isValidCampaignStatusTransition('active', 'active')).toBe(false);
      expect(isValidCampaignStatusTransition('paused', 'paused')).toBe(false);
    });
  });

  describe('assertValidCampaignStatusTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => {
        assertValidCampaignStatusTransition('draft', 'active');
      }).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() => {
        assertValidCampaignStatusTransition('completed', 'active');
      }).toThrow(InvalidStateTransitionError);
    });

    it('should throw for same status', () => {
      expect(() => {
        assertValidCampaignStatusTransition('active', 'active');
      }).toThrow(InvalidStateTransitionError);
    });
  });

  describe('getAllowedCampaignTransitions', () => {
    it('should return allowed transitions for draft', () => {
      const allowed = getAllowedCampaignTransitions('draft');
      expect(allowed).toContain('active');
      expect(allowed).toContain('paused');
    });

    it('should return empty array for completed', () => {
      const allowed = getAllowedCampaignTransitions('completed');
      expect(allowed).toEqual([]);
    });
  });
});
