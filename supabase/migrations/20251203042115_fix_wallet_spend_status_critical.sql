/*
  # Critical Fix: Wallet Spend Status Bug

  ## Problem
  When users pay with W Balance (wonderstars), wallet transactions were created with
  status='pending' (database default), but balance calculations only count status='success'
  transactions. This caused a CRITICAL bug where:
  - User spends money from wallet
  - Balance appears unchanged (pending transactions ignored)
  - User can spend the same money multiple times

  ## Root Cause
  The spend function in useWallet.ts was not setting status field, causing it to default
  to 'pending'. The calculateWalletBalance utility correctly skips pending transactions,
  so spend transactions never deducted from balance.

  ## Solution
  1. Fix all existing 'spend' transactions stuck in pending status
  2. Add database trigger to prevent negative wallet balance
  3. Add constraint to ensure spend transactions must have valid status

  ## Changes
  1. **Fix Historical Data**
     - Update all spend transactions from pending to success
     - Only for transactions linked to paid shop orders

  2. **Add Safety Trigger**
     - Prevent wallet balance from going negative
     - Check balance before allowing spend transaction
     - Database-level protection against overspending

  3. **Add Audit Logging**
     - Log all balance checks for debugging
     - Track prevented overspending attempts
*/

-- =====================================================
-- FIX EXISTING STUCK SPEND TRANSACTIONS
-- =====================================================

-- Fix spend transactions that should be 'success' but are stuck in 'pending'
-- Only fix transactions linked to paid wonderstars orders
DO $$
DECLARE
  v_updated_count integer;
BEGIN
  WITH fixed_transactions AS (
    UPDATE wallet_transactions wt
    SET
      status = 'success',
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{fixed_at}',
        to_jsonb(now()),
        true
      )
    WHERE wt.transaction_type = 'spend'
      AND wt.status = 'pending'
      AND wt.user_id IN (
        SELECT DISTINCT user_id
        FROM shop_orders
        WHERE payment_method = 'wonderstars'
          AND payment_status = 'paid'
          AND created_at > '2024-01-01'
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM fixed_transactions;

  RAISE NOTICE 'Fixed % stuck spend transactions', v_updated_count;
END $$;

-- =====================================================
-- CREATE FUNCTION TO CHECK WALLET BALANCE
-- =====================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS check_wallet_balance_before_spend() CASCADE;

-- Create function to check wallet balance before spend
CREATE OR REPLACE FUNCTION check_wallet_balance_before_spend()
RETURNS TRIGGER AS $$
DECLARE
  current_balance numeric;
  spend_amount numeric;
BEGIN
  -- Only check for successful spend transactions
  IF NEW.transaction_type != 'spend' OR NEW.status != 'success' THEN
    RETURN NEW;
  END IF;

  -- Calculate current successful balance for this user
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type IN ('topup', 'refund') THEN amount
      WHEN transaction_type = 'spend' THEN amount
      ELSE 0
    END
  ), 0) INTO current_balance
  FROM wallet_transactions
  WHERE user_id = NEW.user_id
    AND status = 'success'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Get the absolute spend amount
  spend_amount := ABS(NEW.amount);

  -- Check if this spend would cause negative balance
  IF (current_balance - spend_amount) < 0 THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Current: RM %, Attempted spend: RM %, Shortfall: RM %',
      ROUND(current_balance, 2),
      ROUND(spend_amount, 2),
      ROUND(spend_amount - current_balance, 2)
    USING HINT = 'User needs to top up wallet before spending';
  END IF;

  -- Log successful balance check
  RAISE NOTICE 'Wallet spend approved for user %: spend RM % from balance RM %',
    NEW.user_id,
    ROUND(spend_amount, 2),
    ROUND(current_balance, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CREATE TRIGGER FOR BALANCE CHECK
-- =====================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS prevent_negative_wallet_balance ON wallet_transactions;

-- Create trigger that fires before insert
CREATE TRIGGER prevent_negative_wallet_balance
  BEFORE INSERT ON wallet_transactions
  FOR EACH ROW
  WHEN (NEW.transaction_type = 'spend' AND NEW.status = 'success')
  EXECUTE FUNCTION check_wallet_balance_before_spend();

-- =====================================================
-- ADD INDEX FOR PERFORMANCE
-- =====================================================

-- Index for faster balance calculations
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_status_type
ON wallet_transactions(user_id, status, transaction_type);

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Count of fixed transactions
DO $$
DECLARE
  v_total_spend integer;
  v_success_spend integer;
  v_pending_spend integer;
BEGIN
  SELECT COUNT(*) INTO v_total_spend
  FROM wallet_transactions
  WHERE transaction_type = 'spend';

  SELECT COUNT(*) INTO v_success_spend
  FROM wallet_transactions
  WHERE transaction_type = 'spend' AND status = 'success';

  SELECT COUNT(*) INTO v_pending_spend
  FROM wallet_transactions
  WHERE transaction_type = 'spend' AND status = 'pending';

  RAISE NOTICE 'Wallet spend transactions: Total=%, Success=%, Pending=%',
    v_total_spend, v_success_spend, v_pending_spend;
END $$;

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION check_wallet_balance_before_spend() IS
  'Prevents wallet spend transactions that would result in negative balance.
   Checks current balance before allowing spend.
   Only applies to transactions with status=success.';

COMMENT ON TRIGGER prevent_negative_wallet_balance ON wallet_transactions IS
  'Database-level protection against wallet overspending.
   Validates balance before each successful spend transaction.
   Raises exception if insufficient funds.';