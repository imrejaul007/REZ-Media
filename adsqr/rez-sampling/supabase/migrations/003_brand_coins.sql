-- Migration: 003_brand_coins
-- Date: 2026-05-03
-- Purpose: Add brand coin management tables for brand-specific rewards

-- Brand Coins table
CREATE TABLE IF NOT EXISTS brand_coins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL,

  -- Coin details
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,

  -- Supply
  initial_supply INTEGER DEFAULT 0,
  current_supply INTEGER DEFAULT 0,
  total_distributed INTEGER DEFAULT 0,
  max_supply INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(brand_id)
);

-- Brand Coin Balances table
CREATE TABLE IF NOT EXISTS brand_coin_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_coin_id UUID REFERENCES brand_coins(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL,
  user_id UUID NOT NULL,

  -- Balance
  balance INTEGER DEFAULT 0,
  locked INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(brand_coin_id, user_id)
);

-- Brand Coin Distributions table
CREATE TABLE IF NOT EXISTS brand_coin_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_coin_id UUID REFERENCES brand_coins(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL,
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES campaigns(id),

  -- Distribution details
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brand_coins_brand ON brand_coins(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_coins_status ON brand_coins(status);
CREATE INDEX IF NOT EXISTS idx_brand_coin_balances_coin ON brand_coin_balances(brand_coin_id);
CREATE INDEX IF NOT EXISTS idx_brand_coin_balances_user ON brand_coin_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_coin_distributions_coin ON brand_coin_distributions(brand_coin_id);
CREATE INDEX IF NOT EXISTS idx_brand_coin_distributions_user ON brand_coin_distributions(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_coin_distributions_campaign ON brand_coin_distributions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_brand_coin_distributions_idempotency ON brand_coin_distributions(idempotency_key);

-- Function to increment brand coin balance
CREATE OR REPLACE FUNCTION increment_brand_coin_balance(
  p_brand_coin_id UUID,
  p_user_id UUID,
  p_amount INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE brand_coin_balances
  SET
    balance = balance + p_amount,
    total_earned = total_earned + p_amount,
    updated_at = NOW()
  WHERE brand_coin_id = p_brand_coin_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement brand coin balance
CREATE OR REPLACE FUNCTION decrement_brand_coin_balance(
  p_brand_coin_id UUID,
  p_user_id UUID,
  p_amount INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  SELECT balance INTO v_current_balance
  FROM brand_coin_balances
  WHERE brand_coin_id = p_brand_coin_id AND user_id = p_user_id;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE brand_coin_balances
  SET
    balance = balance - p_amount,
    total_spent = total_spent + p_amount,
    updated_at = NOW()
  WHERE brand_coin_id = p_brand_coin_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
