/*
  # Fix Revoke Prize Transaction Function - Use Positive Amounts

  ## Changes
  - Change amount from -v_amount to v_amount (always positive)
  - Transaction type 'revoke' now properly indicates this is a deduction
  - Follows best practice of storing absolute values with semantic types

  ## Fix
  The bonus_transactions table expects positive amounts with transaction_type
  indicating the direction. This migration updates the revoke function to comply.
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
  v_current_bonus numeric;
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
  
  -- Get current user bonus balance
  SELECT bonus_balance INTO v_current_bonus
  FROM users
  WHERE id = v_user_id;
  
  -- Check if user has sufficient balance
  IF v_current_bonus < v_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User has insufficient bonus balance'
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
  
  -- Update redemption (no updated_at column)
  UPDATE egg_redemptions
  SET revoked_at = now(),
      revoked_by_admin_id = p_admin_id
  WHERE prize_line_id = p_prize_line_id;
  
  -- Deduct bonus balance from user
  UPDATE users
  SET bonus_balance = bonus_balance - v_amount,
      updated_at = now()
  WHERE id = v_user_id;
  
  -- Record bonus transaction with POSITIVE amount
  -- The 'revoke' transaction_type indicates this is a deduction
  INSERT INTO bonus_transactions (
    user_id, 
    amount, 
    transaction_type,
    order_number,
    metadata,
    created_at
  ) VALUES (
    v_user_id, 
    v_amount,  -- POSITIVE value - transaction_type 'revoke' indicates deduction
    'revoke',  -- Type indicates this deducts from balance
    'GACHA-REVOKE-' || p_prize_line_id::text,
    jsonb_build_object(
      'description', 'Prize revoked: ' || p_reason,
      'prize_line_id', p_prize_line_id,
      'admin_id', p_admin_id,
      'reason', p_reason
    ),
    now()
  );
  
  -- Return success with details
  RETURN json_build_object(
    'success', true,
    'prize_line_id', p_prize_line_id,
    'user_id', v_user_id,
    'username', v_username,
    'amount_deducted', v_amount,
    'revoked_at', now()
  );
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION revoke_prize_transaction IS 
'Revokes a claimed gacha prize and deducts bonus balance from user.
Stores positive amount with "revoke" transaction type to indicate deduction.
Only works on claimed, non-revoked prizes with sufficient user balance.';
