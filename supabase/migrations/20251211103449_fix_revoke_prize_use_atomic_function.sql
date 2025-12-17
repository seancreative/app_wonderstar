/*
  # Fix Revoke Prize Transaction to Use Atomic Function

  ## Changes
  - Replace manual balance update + transaction insert with atomic function call
  - Use update_bonus_balance_atomic to ensure consistency
  - Prevents race conditions and ensures balance_after is correct

  ## Benefits
  - Consistent with rest of system
  - Atomic operation with proper locking
  - Automatic balance_after calculation
  - Better error handling
*/

CREATE OR REPLACE FUNCTION revoke_prize_transaction(
  p_prize_line_id bigint,
  p_admin_id uuid,
  p_reason text
) RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric;
  v_username text;
  v_atomic_result record;
  v_result json;
BEGIN
  -- Get prize details
  SELECT claimed_by_user_id, reward_amount, claimed_by_username
  INTO v_user_id, v_amount, v_username
  FROM egg_prize_lines
  WHERE id = p_prize_line_id AND is_claimed = true AND is_revoked = false;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Prize not found or already revoked'
    );
  END IF;

  -- Update prize line
  UPDATE egg_prize_lines
  SET is_revoked = true,
      revoked_at = now(),
      revoked_by_admin_id = p_admin_id,
      revoke_reason = p_reason,
      updated_at = now()
  WHERE id = p_prize_line_id;

  -- Update redemption
  UPDATE egg_redemptions
  SET revoked_at = now(),
      revoked_by_admin_id = p_admin_id
  WHERE prize_line_id = p_prize_line_id;

  -- Use atomic function to deduct bonus balance
  -- This handles balance checking, updating, and transaction creation atomically
  SELECT * INTO v_atomic_result
  FROM update_bonus_balance_atomic(
    v_user_id,
    v_amount,
    'revoke',
    'Prize revoked: ' || p_reason,
    NULL, -- order_id
    'GACHA-REVOKE-' || p_prize_line_id::text,
    jsonb_build_object(
      'prize_line_id', p_prize_line_id,
      'admin_id', p_admin_id,
      'reason', p_reason,
      'source', 'egg_gacha_revoke'
    )
  );

  -- Check if atomic operation succeeded
  IF NOT v_atomic_result.success THEN
    -- Rollback the prize line and redemption updates
    -- (Transaction will rollback automatically if we raise exception)
    RAISE EXCEPTION 'Failed to deduct bonus balance: %', v_atomic_result.message;
  END IF;

  -- Return success with details
  RETURN json_build_object(
    'success', true,
    'prize_line_id', p_prize_line_id,
    'user_id', v_user_id,
    'username', v_username,
    'amount_deducted', v_amount,
    'revoked_at', now(),
    'new_bonus_balance', v_atomic_result.new_balance,
    'transaction_id', v_atomic_result.transaction_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION revoke_prize_transaction IS
'Revokes a claimed gacha prize and deducts bonus balance from user using atomic function.
Uses update_bonus_balance_atomic for consistency and proper transaction handling.
Only works on claimed, non-revoked prizes with sufficient user balance.';