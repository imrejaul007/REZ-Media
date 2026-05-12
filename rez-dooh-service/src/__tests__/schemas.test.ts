/**
 * DOOH Service - Schema Validation Tests
 */

import {
  ScreenRegistrationSchema,
  ScreenHeartbeatSchema,
  ScreenFilterSchema,
  DeliveryRequestSchema,
  ImpressionEventSchema,
} from '../schemas';

describe('ScreenRegistrationSchema', () => {
  it('should validate a valid screen registration', () => {
    const validData = {
      name: 'Test Screen',
      type: 'cab_tablet',
      location_type: 'cab',
      location: {
        city: 'Bangalore',
        area: 'MG Road',
        lat: 12.9716,
        lng: 77.5946,
      },
      owner_id: 'owner_123',
      cpm: 15,
    };

    const result = ScreenRegistrationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const invalidData = {
      name: 'Test Screen',
      // missing type, location, owner_id
    };

    const result = ScreenRegistrationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid screen type', () => {
    const invalidData = {
      name: 'Test Screen',
      type: 'invalid_type',
      location_type: 'cab',
      location: {
        city: 'Bangalore',
        area: 'MG Road',
        lat: 12.9716,
        lng: 77.5946,
      },
      owner_id: 'owner_123',
    };

    const result = ScreenRegistrationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid coordinates', () => {
    const invalidData = {
      name: 'Test Screen',
      type: 'cab_tablet',
      location_type: 'cab',
      location: {
        city: 'Bangalore',
        area: 'MG Road',
        lat: 999, // Invalid latitude
        lng: 77.5946,
      },
      owner_id: 'owner_123',
    };

    const result = ScreenRegistrationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should validate optional email format', () => {
    const validData = {
      name: 'Test Screen',
      type: 'cab_tablet',
      location_type: 'cab',
      location: {
        city: 'Bangalore',
        area: 'MG Road',
        lat: 12.9716,
        lng: 77.5946,
      },
      owner_id: 'owner_123',
      owner_email: 'test@example.com',
    };

    const result = ScreenRegistrationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email format', () => {
    const invalidData = {
      name: 'Test Screen',
      type: 'cab_tablet',
      location_type: 'cab',
      location: {
        city: 'Bangalore',
        area: 'MG Road',
        lat: 12.9716,
        lng: 77.5946,
      },
      owner_id: 'owner_123',
      owner_email: 'not-an-email',
    };

    const result = ScreenRegistrationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid phone number', () => {
    const invalidData = {
      name: 'Test Screen',
      type: 'cab_tablet',
      location_type: 'cab',
      location: {
        city: 'Bangalore',
        area: 'MG Road',
        lat: 12.9716,
        lng: 77.5946,
      },
      owner_id: 'owner_123',
      owner_phone: '123', // Too short
    };

    const result = ScreenRegistrationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('ScreenHeartbeatSchema', () => {
  it('should validate a valid heartbeat', () => {
    const validData = {
      screen_id: 'screen_123',
      timestamp: '2024-01-15T10:30:00Z',
      status: 'active',
      playlist_version: 5,
      impressions_last_hour: 150,
    };

    const result = ScreenHeartbeatSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid screen_id format', () => {
    const invalidData = {
      screen_id: '', // Empty
      timestamp: '2024-01-15T10:30:00Z',
    };

    const result = ScreenHeartbeatSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid timestamp format', () => {
    const invalidData = {
      screen_id: 'screen_123',
      timestamp: 'not-a-date',
    };

    const result = ScreenHeartbeatSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should allow missing optional fields', () => {
    const minimalData = {
      screen_id: 'screen_123',
    };

    const result = ScreenHeartbeatSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });

  it('should reject negative impressions', () => {
    const invalidData = {
      screen_id: 'screen_123',
      impressions_last_hour: -10,
    };

    const result = ScreenHeartbeatSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('ScreenFilterSchema', () => {
  it('should validate empty filter', () => {
    const result = ScreenFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should validate filter with single field', () => {
    const result = ScreenFilterSchema.safeParse({ city: 'Bangalore' });
    expect(result.success).toBe(true);
  });

  it('should validate filter with all fields', () => {
    const result = ScreenFilterSchema.safeParse({
      type: 'cab_tablet',
      network_type: '1:1',
      city: 'Bangalore',
      area: 'MG Road',
      status: 'active',
      owner_id: 'owner_123',
      owner_type: 'partner',
      min_cpm: 10,
      max_cpm: 50,
      min_footfall: 100,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid screen type in filter', () => {
    const result = ScreenFilterSchema.safeParse({ type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('should reject negative CPM values', () => {
    const result = ScreenFilterSchema.safeParse({ min_cpm: -10 });
    expect(result.success).toBe(false);
  });
});

describe('DeliveryRequestSchema', () => {
  it('should validate a valid delivery request', () => {
    const validData = {
      screen_id: 'screen_123',
      available_slots: 5,
      context: {
        time: '14:00',
        day_type: 'weekday',
        audience: {
          primary: [{ type: 'office_workers', percentage: 60 }],
          peak_hours: [],
          avg_dwell_time: 300,
        },
      },
    };

    const result = DeliveryRequestSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid time format', () => {
    const invalidData = {
      screen_id: 'screen_123',
      available_slots: 5,
      context: {
        time: '25:00', // Invalid
        day_type: 'weekday',
        audience: {
          primary: [{ type: 'office_workers', percentage: 60 }],
          peak_hours: [],
          avg_dwell_time: 300,
        },
      },
    };

    const result = DeliveryRequestSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject zero slots', () => {
    const invalidData = {
      screen_id: 'screen_123',
      available_slots: 0,
      context: {
        time: '14:00',
        day_type: 'weekday',
        audience: {
          primary: [{ type: 'office_workers', percentage: 60 }],
          peak_hours: [],
          avg_dwell_time: 300,
        },
      },
    };

    const result = DeliveryRequestSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('ImpressionEventSchema', () => {
  it('should validate a valid impression event', () => {
    const validData = {
      screen_id: 'screen_123',
      campaign_id: 'camp_456',
      ad_id: 'ad_789',
      timestamp: '2024-01-15T10:30:00Z',
      duration_played: 15,
    };

    const result = ImpressionEventSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const invalidData = {
      screen_id: 'screen_123',
      // missing ad_id
    };

    const result = ImpressionEventSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should allow optional fields', () => {
    const minimalData = {
      screen_id: 'screen_123',
      ad_id: 'ad_789',
    };

    const result = ImpressionEventSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });
});
