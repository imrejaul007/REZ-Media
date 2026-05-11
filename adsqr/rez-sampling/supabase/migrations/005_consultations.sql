-- Migration: 005_consultations
-- Date: 2026-05-03
-- Purpose: Add consultation booking tables

-- Consultation Types table
CREATE TABLE IF NOT EXISTS consultation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Type details
  name TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('in_store', 'video', 'phone')),
  duration_minutes INTEGER DEFAULT 30,

  -- Pricing
  coin_cost INTEGER DEFAULT 0,
  is_free BOOLEAN DEFAULT false,

  -- Availability
  max_bookings_per_day INTEGER DEFAULT 10,
  current_day_bookings INTEGER DEFAULT 0,

  -- Requirements
  required_documents TEXT[] DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'fully_booked')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consultation Bookings table
CREATE TABLE IF NOT EXISTS consultation_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_type_id UUID REFERENCES consultation_types(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID NOT NULL,

  -- Booking details
  confirmation_code TEXT UNIQUE,
  preferred_date DATE NOT NULL,
  preferred_time TIME,
  confirmed_date DATE,
  confirmed_time TIME,

  -- Duration
  duration_minutes INTEGER DEFAULT 30,
  mode TEXT CHECK (mode IN ('in_store', 'video', 'phone')),

  -- Cost
  coin_cost INTEGER DEFAULT 0,

  -- Contact
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),

  -- Cancellation
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,

  -- Completion
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,

  -- Reschedule tracking
  reschedule_count INTEGER DEFAULT 0,
  original_booking_id UUID REFERENCES consultation_bookings(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consultation Slots table (for managing availability)
CREATE TABLE IF NOT EXISTS consultation_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_type_id UUID REFERENCES consultation_types(id) ON DELETE CASCADE,

  -- Slot details
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_bookings INTEGER DEFAULT 1,
  current_bookings INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'full', 'blocked')),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(consultation_type_id, slot_date, start_time)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consultation_types_campaign ON consultation_types(campaign_id);
CREATE INDEX IF NOT EXISTS idx_consultation_types_status ON consultation_types(status);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_type ON consultation_bookings(consultation_type_id);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_user ON consultation_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_date ON consultation_bookings(preferred_date);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_status ON consultation_bookings(status);
CREATE INDEX IF NOT EXISTS idx_consultation_bookings_code ON consultation_bookings(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_consultation_slots_type ON consultation_slots(consultation_type_id);
CREATE INDEX IF NOT EXISTS idx_consultation_slots_date ON consultation_slots(slot_date);

-- Function to increment consultation day bookings
CREATE OR REPLACE FUNCTION increment_consultation_day_bookings(
  p_consultation_type_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE consultation_types
  SET
    current_day_bookings = current_day_bookings + 1,
    updated_at = NOW()
  WHERE id = p_consultation_type_id;

  -- Reset if it's a new day (simplified - production should use proper date tracking)
  UPDATE consultation_types
  SET current_day_bookings = 0
  WHERE id = p_consultation_type_id
    AND current_day_bookings > (max_bookings_per_day * 2);
END;
$$ LANGUAGE plpgsql;
