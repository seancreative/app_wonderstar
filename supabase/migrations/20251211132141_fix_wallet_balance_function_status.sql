/*
  # Fix Wallet Balance Function Status Value

  ## Problem
  The get_user_wallet_balance function uses status='completed' but wallet_transactions
  actually use status='success'. This causes the function to return 0 for all users,
  making the verification page show blank.

  ## Solution
  Update the function to use status='success' to match the actual transaction status values.

  ## Changes
  1. Update get_user_wallet_balance to filter by status='success'
  2. Update comment to reflect correct status value
*/

-- =====================================================
-- Fix get_user_wallet_balance function
-- =====================================================

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
    AND status = 'success';  -- Fixed from 'completed' to 'success'
$$;

COMMENT ON FUNCTION get_user_wallet_balance IS
'Calculates user wallet balance from wallet_transactions table.
Only counts successful transactions (status=success). This is the single source of truth for wallet balance.';
