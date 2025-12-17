/*
  # Atomic Bonus Balance Updates

  1. Changes
    - Creates atomic function to update bonus balance safely
    - Prevents race conditions when multiple processes update simultaneously
    - Ensures balance_after is always calculated correctly
    - Includes validation and error handling

  2. Security
    - Uses database-level atomicity with row locking
    - Validates bonus amount is positive
    - Returns updated balance for verification
    - Transaction-safe with SECURITY DEFINER
*/

-- Create atomic function to update bonus balance
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

  -- Determine if this is a deduction (spend, revoke) or addition (earn, topup_bonus, grant, refund, adjustment)
  v_is_deduction := p_transaction_type IN ('spend', 'revoke');

  -- Lock the user row for update to prevent race conditions
  SELECT bonus_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Handle NULL bonus_balance (treat as 0)
  v_current_balance := COALESCE(v_current_balance, 0);

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

  -- Update user's bonus balance atomically
  UPDATE users
  SET
    bonus_balance = v_new_balance,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Insert bonus transaction record with balance_after
  INSERT INTO bonus_transactions (
    user_id,
    order_id,
    amount,
    transaction_type,
    order_number,
    description,
    balance_after,
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
    v_new_balance,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- Return success
  RETURN QUERY SELECT v_transaction_id, v_new_balance, TRUE, 'Success'::TEXT;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION update_bonus_balance_atomic IS
'Atomically updates user bonus balance with proper locking and validation.
Prevents race conditions and ensures balance_after is always correct.
Handles both additions (earn, topup_bonus, grant, refund, adjustment) and deductions (spend, revoke).';

-- Create index on bonus_transactions metadata->>'wallet_transaction_id' for performance
CREATE INDEX IF NOT EXISTS idx_bonus_transactions_wallet_tx_id
  ON bonus_transactions ((metadata->>'wallet_transaction_id'))
  WHERE transaction_type = 'topup_bonus';

-- Add partial index for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_bonus_transactions_order_number_type
  ON bonus_transactions (order_number, transaction_type)
  WHERE order_number IS NOT NULL;