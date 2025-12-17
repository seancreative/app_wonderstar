/*
  # Unify Balance Storage - Single Source of Truth

  ## Problem
  Multiple tables were storing balance data causing confusion and sync issues:
  1. users.bonus_balance - Cached balance (duplicate of bonus_transactions)
  2. wallet_transactions.balance_after - Inconsistently populated (9%)
  3. bonus_transactions.balance_after - Inconsistently populated (52%)
  4. stars_transactions.balance_after - Inconsistently populated (31%)

  ## Solution
  Establish transaction tables as SINGLE source of truth:
  - Remove users.bonus_balance column
  - Remove balance_after from all transaction tables
  - Use calculation functions for all balances
  - Use user_balances view for queries

  ## Benefits
  - No sync issues (one source of truth)
  - Simpler architecture
  - Always accurate balances
  - Easier to debug and maintain
*/

-- =====================================================
-- STEP 1: Drop dependent views first
-- =====================================================

DROP VIEW IF EXISTS user_balances CASCADE;

-- =====================================================
-- STEP 2: Remove balance_after from transaction tables
-- =====================================================

-- These columns cause confusion as they're inconsistently populated
-- Balance is calculated from transaction sums, not snapshots

ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS balance_after;
ALTER TABLE bonus_transactions DROP COLUMN IF EXISTS balance_after;
ALTER TABLE stars_transactions DROP COLUMN IF EXISTS balance_after;

-- =====================================================
-- STEP 3: Remove users.bonus_balance column
-- =====================================================

-- This creates duplicate data with bonus_transactions table
-- Balance should be calculated from transactions only

ALTER TABLE users DROP COLUMN IF EXISTS bonus_balance;

-- Drop the index on bonus_balance
DROP INDEX IF EXISTS idx_users_bonus_balance;

-- =====================================================
-- STEP 4: Create helper functions for all balances
-- =====================================================

-- Function to get wallet balance
CREATE OR REPLACE FUNCTION get_user_wallet_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type IN ('topup', 'refund') THEN amount
      WHEN transaction_type = 'spend' THEN amount  -- spend amounts are stored as negative
      ELSE 0
    END
  ), 0)
  FROM wallet_transactions
  WHERE user_id = p_user_id
    AND status = 'completed';
$$;

COMMENT ON FUNCTION get_user_wallet_balance IS
'Calculates user wallet balance from wallet_transactions table.
Only counts completed transactions. This is the single source of truth for wallet balance.';

-- Function to get bonus balance
CREATE OR REPLACE FUNCTION get_user_bonus_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type IN ('earn', 'topup_bonus', 'grant', 'refund', 'adjustment') THEN amount
      WHEN transaction_type IN ('spend', 'revoke') THEN -amount
      ELSE 0
    END
  ), 0)
  FROM bonus_transactions
  WHERE user_id = p_user_id;
$$;

COMMENT ON FUNCTION get_user_bonus_balance IS
'Calculates user bonus balance from bonus_transactions table.
This is the single source of truth for bonus balance.';

-- =====================================================
-- STEP 5: Recreate user_balances view
-- =====================================================

CREATE OR REPLACE VIEW user_balances AS
SELECT
  u.id,
  u.name,
  u.email,
  u.phone,
  u.created_at,

  -- Calculate wallet balance from transactions (single source of truth)
  get_user_wallet_balance(u.id) as wallet_balance,

  -- Calculate bonus balance from transactions (single source of truth)
  get_user_bonus_balance(u.id) as bonus_balance,

  -- Calculate stars balance from transactions (single source of truth)
  get_user_stars_balance(u.id) as stars_balance,

  -- Lifetime topups from users table
  COALESCE(u.lifetime_topups, 0) as lifetime_topups

FROM users u;

COMMENT ON VIEW user_balances IS
'Consolidated view of all user balances calculated from transaction tables.
ALL balances are calculated on-the-fly from their respective transaction tables:
- wallet_balance: sum of completed wallet_transactions
- bonus_balance: sum of bonus_transactions
- stars_balance: sum of stars_transactions
- lifetime_topups: stored in users table

This is the ONLY way to query user balances.
Transaction tables are the single source of truth.';

-- =====================================================
-- STEP 6: Replace atomic bonus function
-- =====================================================

-- New function only manages transactions, no users table update
CREATE OR REPLACE FUNCTION update_bonus_balance_atomic(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_order_number TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  transaction_id UUID,
  new_balance NUMERIC,
  success BOOLEAN,
  message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_is_deduction BOOLEAN;
BEGIN
  -- Validate amount is positive
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, FALSE, 'Amount must be positive';
    RETURN;
  END IF;

  -- Validate transaction type
  IF p_transaction_type NOT IN ('earn', 'spend', 'topup_bonus', 'grant', 'refund', 'adjustment', 'revoke') THEN
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, FALSE, 'Invalid transaction type';
    RETURN;
  END IF;

  -- Determine if this is a deduction or addition
  v_is_deduction := p_transaction_type IN ('spend', 'revoke');

  -- Calculate current balance from transactions (single source of truth)
  v_current_balance := get_user_bonus_balance(p_user_id);

  -- Calculate new balance
  IF v_is_deduction THEN
    v_new_balance := v_current_balance - p_amount;

    -- Prevent negative balance for deductions
    IF v_new_balance < 0 THEN
      RETURN QUERY SELECT NULL::UUID, v_current_balance, FALSE, 'Insufficient bonus balance';
      RETURN;
    END IF;
  ELSE
    v_new_balance := v_current_balance + p_amount;
  END IF;

  -- Insert bonus transaction record (source of truth)
  INSERT INTO bonus_transactions (
    user_id,
    order_id,
    amount,
    transaction_type,
    order_number,
    description,
    metadata,
    created_at
  )
  VALUES (
    p_user_id,
    p_order_id,
    p_amount,
    p_transaction_type,
    p_order_number,
    p_description,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- Return success with calculated balance
  RETURN QUERY SELECT v_transaction_id, v_new_balance, TRUE, 'Success'::TEXT;
END;
$$;

COMMENT ON FUNCTION update_bonus_balance_atomic IS
'Atomically creates bonus transaction and returns calculated balance.
Balance is ALWAYS calculated from bonus_transactions table (single source of truth).
Does NOT update any cached columns - use user_balances view to query balances.';

-- =====================================================
-- STEP 7: Update balance snapshot trigger for orders
-- =====================================================

-- Update the trigger to use calculation functions
CREATE OR REPLACE FUNCTION capture_balance_snapshot_on_order_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only capture balance when order status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Calculate balances using helper functions (single source of truth)
    UPDATE shop_orders
    SET
      w_balance_after = get_user_wallet_balance(NEW.user_id),
      bonus_balance_after = get_user_bonus_balance(NEW.user_id)
    WHERE id = NEW.id;

    RAISE NOTICE 'Captured balance snapshot for order % using calculated balances', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION capture_balance_snapshot_on_order_completion IS
'Automatically captures customer balance snapshot when order status changes to completed.
Balances are calculated from transaction tables (single source of truth).
This function only reads and captures snapshot - it NEVER modifies user balances.';

-- =====================================================
-- STEP 8: Add documentation to tables
-- =====================================================

COMMENT ON TABLE users IS
'User accounts table.
IMPORTANT: This table does NOT store balance columns.
All balances (wallet, bonus, stars) are calculated from their respective transaction tables.
Use user_balances view or get_user_*_balance() functions to query balances.';

COMMENT ON TABLE wallet_transactions IS
'Single source of truth for wallet balance.
Balance = SUM of completed transactions (topup/refund positive, spend negative).
Use get_user_wallet_balance(user_id) to calculate current balance.';

COMMENT ON TABLE bonus_transactions IS
'Single source of truth for bonus balance.
Balance = SUM of transactions (earn/topup_bonus/grant/refund positive, spend/revoke negative).
Use get_user_bonus_balance(user_id) to calculate current balance.';

COMMENT ON TABLE stars_transactions IS
'Single source of truth for stars balance.
Balance = SUM of transactions (earn/bonus positive, spend negative).
Use get_user_stars_balance(user_id) to calculate current balance.';

-- =====================================================
-- STEP 9: Create indexes for better performance
-- =====================================================

-- Indexes on user_id + created_at for fast balance calculations
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
  ON wallet_transactions(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_bonus_transactions_user_created
  ON bonus_transactions(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_stars_transactions_user_created
  ON stars_transactions(user_id, created_at);

-- Partial indexes for completed wallet transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_completed
  ON wallet_transactions(user_id, status)
  WHERE status = 'completed';
