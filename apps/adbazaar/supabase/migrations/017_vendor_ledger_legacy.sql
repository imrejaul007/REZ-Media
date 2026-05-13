-- AB-A1 FIX: Vendor Ledger Table
-- Table to track all earnings and refunds for accurate accounting

CREATE TABLE IF NOT EXISTS vendor_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,

  -- Transaction type and amount
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN (
      'earning',           -- Revenue from completed booking
      'refund_sent',       -- Refund to buyer
      'refund_received',   -- Refund from buyer (partial/complete)
      'payout',            -- Withdrawal to bank
      'adjustment',        -- Manual admin adjustment
      'commission_paid',   -- Commission deducted
      'bonus',             -- Promotional bonus
      'penalty'            -- Penalty/fine
    )
  ),

  -- Amount details
  gross_amount DECIMAL(12,2) NOT NULL DEFAULT 0,   -- Total before deductions
  commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0, -- Platform commission
  net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,       -- Actual earnings (gross - commission)

  -- Currency (for multi-currency support in future)
  currency TEXT NOT NULL DEFAULT 'INR',

  -- Balance tracking
  running_balance DECIMAL(12,2) NOT NULL DEFAULT 0, -- Balance after this transaction

  -- Status
  status TEXT NOT NULL DEFAULT 'completed' CHECK (
    status IN ('pending', 'completed', 'failed', 'cancelled')
  ),

  -- Description and reference
  description TEXT,
  reference_id TEXT,        -- External reference (e.g., payout ID)
  reference_type TEXT,      -- Type of reference (e.g., 'razorpay_payout')

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT positive_gross_amount CHECK (gross_amount >= 0),
  CONSTRAINT non_negative_commission CHECK (commission_amount >= 0),
  CONSTRAINT non_negative_net CHECK (net_amount >= 0)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor_id
  ON vendor_ledger(vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_ledger_booking_id
  ON vendor_ledger(booking_id);

CREATE INDEX IF NOT EXISTS idx_vendor_ledger_transaction_type
  ON vendor_ledger(transaction_type);

CREATE INDEX IF NOT EXISTS idx_vendor_ledger_status
  ON vendor_ledger(status);

CREATE INDEX IF NOT EXISTS idx_vendor_ledger_created_at
  ON vendor_ledger(created_at DESC);

-- Composite index for vendor balance lookups
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor_created
  ON vendor_ledger(vendor_id, created_at DESC);

-- Function to update running balance after insert
CREATE OR REPLACE FUNCTION update_vendor_running_balance()
RETURNS TRIGGER AS $$
DECLARE
  current_balance DECIMAL(12,2);
BEGIN
  -- Get the latest balance for this vendor
  SELECT COALESCE(running_balance, 0)
  INTO current_balance
  FROM vendor_ledger
  WHERE vendor_id = NEW.vendor_id
    AND id != NEW.id  -- Exclude the current row being inserted
  ORDER BY created_at DESC
  LIMIT 1;

  -- Set initial balance if this is the first transaction
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;

  -- Calculate new running balance based on transaction type
  NEW.running_balance := CASE
    WHEN NEW.transaction_type IN ('earning', 'refund_received', 'bonus') THEN
      current_balance + NEW.net_amount
    WHEN NEW.transaction_type IN ('refund_sent', 'payout', 'commission_paid', 'penalty', 'adjustment') THEN
      current_balance - NEW.net_amount
    ELSE
      current_balance
  END;

  -- Mark as processed
  NEW.processed_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update running balance
DROP TRIGGER IF EXISTS trigger_update_vendor_running_balance ON vendor_ledger;
CREATE TRIGGER trigger_update_vendor_running_balance
  BEFORE INSERT ON vendor_ledger
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_running_balance();

-- Function to get vendor's current balance
CREATE OR REPLACE FUNCTION get_vendor_balance(vendor_uuid UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  balance DECIMAL(12,2);
BEGIN
  SELECT running_balance
  INTO balance
  FROM vendor_ledger
  WHERE vendor_id = vendor_uuid
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql;

-- View for vendor earnings summary
CREATE OR REPLACE VIEW vendor_earnings_summary AS
SELECT
  vl.vendor_id,
  u.name AS vendor_name,
  u.email AS vendor_email,
  COUNT(*) FILTER (WHERE vl.transaction_type = 'earning') AS total_bookings,
  SUM(vl.gross_amount) FILTER (WHERE vl.transaction_type = 'earning') AS total_gross_earnings,
  SUM(vl.commission_amount) FILTER (WHERE vl.transaction_type = 'earning') AS total_commission,
  SUM(vl.net_amount) FILTER (WHERE vl.transaction_type = 'earning') AS total_net_earnings,
  SUM(vl.net_amount) FILTER (WHERE vl.transaction_type = 'refund_sent') AS total_refunds_sent,
  SUM(vl.net_amount) FILTER (WHERE vl.transaction_type = 'payout') AS total_payouts,
  get_vendor_balance(vl.vendor_id) AS current_balance,
  MAX(vl.created_at) AS last_transaction_at
FROM vendor_ledger vl
JOIN users u ON u.id = vl.vendor_id
GROUP BY vl.vendor_id, u.name, u.email;

-- =====================================================
-- DOWN MIGRATION: 017_vendor_ledger_legacy
-- =====================================================
-- This migration creates the vendor_ledger table with running balance functionality.
-- To rollback:
-- DROP VIEW IF EXISTS vendor_earnings_summary;
-- DROP FUNCTION IF EXISTS get_vendor_balance(UUID);
-- DROP TRIGGER IF EXISTS trigger_update_vendor_running_balance ON vendor_ledger;
-- DROP FUNCTION IF EXISTS update_vendor_running_balance();
-- DROP TABLE IF EXISTS vendor_ledger CASCADE;
