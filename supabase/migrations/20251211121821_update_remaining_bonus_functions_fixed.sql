/*
  # Update Remaining Functions After Balance Unification

  Updates functions that still reference deleted users.bonus_balance column:
  1. sync_user_bonus_balance - Make it no-op (column no longer exists)
  2. verify_bonus_balance_consistency - Update to only check transaction calculations

  These functions are legacy and kept for backward compatibility but now work
  with the transaction-only approach.
*/

-- =====================================================
-- Drop and recreate sync_user_bonus_balance
-- =====================================================

DROP FUNCTION IF EXISTS sync_user_bonus_balance(UUID);

-- This function is now redundant since users.bonus_balance doesn't exist
-- But keep it for backward compatibility - it just returns calculated balance
CREATE FUNCTION sync_user_bonus_balance(p_user_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  old_balance NUMERIC,
  calculated_balance NUMERIC,
  difference NUMERIC,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calculated_balance NUMERIC;
BEGIN
  -- Calculate balance from transactions (single source of truth)
  v_calculated_balance := get_user_bonus_balance(p_user_id);

  -- Return success - there's nothing to sync since column doesn't exist
  RETURN QUERY SELECT
    TRUE,
    v_calculated_balance, -- "old" and "calculated" are the same now
    v_calculated_balance,
    0::NUMERIC, -- no difference
    'Balance calculated from transactions (users.bonus_balance column no longer exists)'::TEXT;
END;
$$;

COMMENT ON FUNCTION sync_user_bonus_balance IS
'Legacy function kept for backward compatibility.
Returns calculated balance from bonus_transactions.
users.bonus_balance column no longer exists - transactions are single source of truth.';

-- =====================================================
-- Drop and recreate verify_bonus_balance_consistency
-- =====================================================

DROP FUNCTION IF EXISTS verify_bonus_balance_consistency(UUID);

-- This function now only verifies that transactions can be calculated
-- Since there's no cached column, there's no consistency to check
CREATE FUNCTION verify_bonus_balance_consistency(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  stored_balance NUMERIC,
  calculated_balance NUMERIC,
  difference NUMERIC,
  is_consistent BOOLEAN,
  transaction_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    get_user_bonus_balance(u.id) as stored_balance, -- Calculate from transactions
    get_user_bonus_balance(u.id) as calculated_balance, -- Same calculation
    0::NUMERIC as difference, -- Always 0 since we calculate from same source
    TRUE as is_consistent, -- Always consistent (single source of truth)
    COUNT(bt.id) as transaction_count
  FROM users u
  LEFT JOIN bonus_transactions bt ON bt.user_id = u.id
  WHERE u.id = p_user_id
  GROUP BY u.id;
END;
$$;

COMMENT ON FUNCTION verify_bonus_balance_consistency IS
'Legacy function kept for backward compatibility.
Always returns consistent=true since transactions are the single source of truth.
users.bonus_balance column no longer exists.';
