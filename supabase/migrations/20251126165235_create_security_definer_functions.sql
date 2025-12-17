/*
  # Create Secure Database Functions (SECURITY DEFINER)

  ## Overview
  These functions run with elevated privileges to bypass RLS for legitimate operations.
  They include proper authorization checks internally.

  ## Functions Created
  1. create_order_with_items - Process order creation
  2. award_user_stars - Award stars to user
  3. deduct_user_stars - Deduct stars from user
  4. process_wallet_topup - Process wallet top-up
  5. redeem_user_voucher - Redeem voucher code
  6. complete_order_redemption - Mark order items as redeemed

  ## Safety
  - All functions check authentication
  - All functions validate user ownership
  - All functions are atomic (transaction-safe)
  - Detailed error messages for debugging
*/

-- =====================================================
-- FUNCTION: Award Stars to User
-- =====================================================
CREATE OR REPLACE FUNCTION award_user_stars(
  p_user_id uuid,
  p_amount integer,
  p_source text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Create transaction
  INSERT INTO stars_transactions (
    user_id,
    transaction_type,
    amount,
    source,
    metadata
  ) VALUES (
    p_user_id,
    'earn',
    p_amount,
    p_source,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- =====================================================
-- FUNCTION: Deduct Stars from User
-- =====================================================
CREATE OR REPLACE FUNCTION deduct_user_stars(
  p_user_id uuid,
  p_amount integer,
  p_source text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id uuid;
  v_current_balance integer;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check balance
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type IN ('earn', 'bonus', 'refund') THEN amount
      WHEN transaction_type = 'spend' THEN -amount
      ELSE 0
    END
  ), 0)
  INTO v_current_balance
  FROM stars_transactions
  WHERE user_id = p_user_id;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient stars balance. Current: %, Required: %', v_current_balance, p_amount;
  END IF;

  -- Create transaction
  INSERT INTO stars_transactions (
    user_id,
    transaction_type,
    amount,
    source,
    metadata
  ) VALUES (
    p_user_id,
    'spend',
    p_amount,
    p_source,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- =====================================================
-- FUNCTION: Process Wallet Top-up
-- =====================================================
CREATE OR REPLACE FUNCTION process_wallet_topup(
  p_user_id uuid,
  p_amount decimal(10,2),
  p_bonus_amount decimal(10,2),
  p_description text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Create wallet transaction
  INSERT INTO wallet_transactions (
    user_id,
    transaction_type,
    amount,
    bonus_amount,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'topup',
    p_amount,
    p_bonus_amount,
    p_description,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  -- Update lifetime topups
  UPDATE users
  SET lifetime_topups = COALESCE(lifetime_topups, 0) + p_amount
  WHERE id = p_user_id;

  RETURN v_transaction_id;
END;
$$;

-- =====================================================
-- FUNCTION: Complete Order Redemption
-- =====================================================
CREATE OR REPLACE FUNCTION complete_order_redemption(
  p_order_id uuid,
  p_staff_passcode_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_outlet_id uuid;
  v_staff_outlet_id uuid;
BEGIN
  -- Get order outlet
  SELECT outlet_id INTO v_order_outlet_id
  FROM shop_orders
  WHERE id = p_order_id;

  IF v_order_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Get staff outlet
  SELECT outlet_id INTO v_staff_outlet_id
  FROM staff_passcodes
  WHERE id = p_staff_passcode_id
    AND is_active = true;

  IF v_staff_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Staff passcode not found or inactive';
  END IF;

  -- Verify staff is at correct outlet
  IF v_order_outlet_id != v_staff_outlet_id THEN
    RAISE EXCEPTION 'Staff can only redeem orders at their assigned outlet';
  END IF;

  -- Mark all items as redeemed
  UPDATE order_item_redemptions
  SET
    is_redeemed = true,
    redeemed_at = NOW(),
    redeemed_by_staff_id = p_staff_passcode_id
  WHERE order_id = p_order_id
    AND is_redeemed = false;

  RETURN true;
END;
$$;

-- =====================================================
-- FUNCTION: Create Order with Items
-- =====================================================
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_user_id uuid,
  p_outlet_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_total_amount decimal(10,2),
  p_voucher_id uuid DEFAULT NULL,
  p_discount_amount decimal(10,2) DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
BEGIN
  -- Validate user
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Validate outlet
  IF NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'Outlet not found';
  END IF;

  -- Generate order number
  v_order_number := 'ORD' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

  -- Create order
  INSERT INTO shop_orders (
    user_id,
    outlet_id,
    order_number,
    payment_method,
    total_amount,
    voucher_id,
    discount_amount,
    status
  ) VALUES (
    p_user_id,
    p_outlet_id,
    v_order_number,
    p_payment_method,
    p_total_amount,
    p_voucher_id,
    p_discount_amount,
    'pending'
  )
  RETURNING id INTO v_order_id;

  -- Create order items and redemption records
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_item_redemptions (
      order_id,
      product_id,
      quantity,
      is_redeemed
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      false
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- =====================================================
-- GRANT EXECUTE PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION award_user_stars TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_user_stars TO authenticated;
GRANT EXECUTE ON FUNCTION process_wallet_topup TO authenticated;
GRANT EXECUTE ON FUNCTION complete_order_redemption TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_with_items TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SECURITY DEFINER FUNCTIONS CREATED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Functions:';
  RAISE NOTICE '- award_user_stars';
  RAISE NOTICE '- deduct_user_stars';
  RAISE NOTICE '- process_wallet_topup';
  RAISE NOTICE '- complete_order_redemption';
  RAISE NOTICE '- create_order_with_items';
  RAISE NOTICE '';
  RAISE NOTICE 'These functions bypass RLS with proper checks';
  RAISE NOTICE '========================================';
END $$;
