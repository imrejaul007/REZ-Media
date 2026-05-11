-- Fraud Checks
CREATE TABLE IF NOT EXISTS fraud_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL,
  device_id VARCHAR(255),
  ip_address INET,
  location JSONB,
  risk_score DECIMAL(3,2) DEFAULT 0,
  checks_passed JSONB DEFAULT '[]',
  checks_failed JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pass',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fraud_checks_device ON fraud_checks(device_id);
CREATE INDEX idx_fraud_checks_status ON fraud_checks(status);

-- Brand Coins
CREATE TABLE IF NOT EXISTS brand_coins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL,
  coin_name VARCHAR(50) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  value_per_coin DECIMAL(10,2) DEFAULT 0.01,
  total_supply INTEGER,
  expiration_days INTEGER DEFAULT 365,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_brand_coins_brand ON brand_coins(brand_id);

-- Brand Coin Balances
CREATE TABLE IF NOT EXISTS brand_coin_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  balance INTEGER DEFAULT 0,
  earned_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(user_id, brand_id)
);

-- Brand Coin Transactions
CREATE TABLE IF NOT EXISTS brand_coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,
  source VARCHAR(50),
  campaign_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_brand_transactions_user ON brand_coin_transactions(user_id);
CREATE INDEX idx_brand_transactions_brand ON brand_coin_transactions(brand_id);

-- Sample Requests
CREATE TABLE IF NOT EXISTS sample_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  user_id UUID NOT NULL,
  sample_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  pickup_code VARCHAR(10) UNIQUE,
  pickup_expires_at TIMESTAMP,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sample_requests_user ON sample_requests(user_id);
CREATE INDEX idx_sample_requests_status ON sample_requests(status);
CREATE UNIQUE INDEX idx_sample_requests_code ON sample_requests(pickup_code);
