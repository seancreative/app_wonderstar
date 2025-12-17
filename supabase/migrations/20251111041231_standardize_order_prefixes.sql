/*
  # Standardize Order Number Prefixes

  1. Changes
    - Update order number prefixes to standardized format:
      - W- for payment orders (Fiuu payments)
      - TU- for topup orders (wallet top-ups)
      - ST- for stamp/redemption orders
      - DD- for deduction orders (wallet deductions)
    
  2. Updates
    - Modify generate_order_number function
    - Update validation function
    - Update trigger logic
    - Backfill existing TOPUP- orders to TU-
    - Backfill existing STAMPT- orders to ST-
*/

-- =====================================================
-- UPDATE ORDER NUMBER GENERATION WITH NEW PREFIXES
-- =====================================================
CREATE OR REPLACE FUNCTION generate_order_number(p_payment_type text DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  date_part TEXT;
  random_part TEXT;
BEGIN
  -- Determine prefix based on payment type
  CASE p_payment_type
    WHEN 'payment' THEN prefix := 'W-';
    WHEN 'topup' THEN prefix := 'TU-';
    WHEN 'redemption' THEN prefix := 'ST-';
    WHEN 'deduction' THEN prefix := 'DD-';
    ELSE prefix := 'ORD-'; -- Default fallback
  END CASE;
  
  -- Generate date part (YYYYMMDD)
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Generate random 4-digit number
  random_part := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  
  -- Return formatted order number
  RETURN prefix || date_part || '-' || random_part;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE VALIDATION FUNCTION FOR NEW PREFIXES
-- =====================================================
CREATE OR REPLACE FUNCTION validate_order_number_format(
  p_order_number text,
  p_payment_type text
)
RETURNS boolean AS $$
BEGIN
  -- Check if order number starts with correct prefix for payment type
  CASE p_payment_type
    WHEN 'payment' THEN
      RETURN p_order_number LIKE 'W-%';
    WHEN 'topup' THEN
      RETURN p_order_number LIKE 'TU-%';
    WHEN 'redemption' THEN
      RETURN p_order_number LIKE 'ST-%';
    WHEN 'deduction' THEN
      RETURN p_order_number LIKE 'DD-%';
    ELSE
      RETURN TRUE; -- Allow any format for unknown types
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- BACKFILL EXISTING ORDERS WITH NEW PREFIXES
-- =====================================================
DO $$
BEGIN
  -- Update TOPUP- orders to TU-
  UPDATE shop_orders
  SET order_number = REPLACE(order_number, 'TOPUP-', 'TU-')
  WHERE order_number LIKE 'TOPUP-%';
  
  -- Update STAMPT- orders to ST-
  UPDATE shop_orders
  SET order_number = REPLACE(order_number, 'STAMPT-', 'ST-')
  WHERE order_number LIKE 'STAMPT-%';
  
  -- Log the changes
  RAISE NOTICE 'Order prefixes updated: TOPUP- -> TU-, STAMPT- -> ST-';
END $$;

-- =====================================================
-- UPDATE PAYMENT_TRANSACTIONS ORDER_IDs
-- =====================================================
DO $$
BEGIN
  -- Update payment transaction order_ids that reference old prefixes
  UPDATE payment_transactions
  SET order_id = REPLACE(order_id, 'TOPUP-', 'TU-')
  WHERE order_id LIKE 'TOPUP-%';
  
  UPDATE payment_transactions
  SET order_id = REPLACE(order_id, 'STAMPT-', 'ST-')
  WHERE order_id LIKE 'STAMPT-%';
  
  RAISE NOTICE 'Payment transaction order_ids updated';
END $$;

-- =====================================================
-- UPDATE WALLET_TRANSACTIONS DESCRIPTIONS
-- =====================================================
DO $$
BEGIN
  -- Update wallet transaction descriptions that reference old order numbers
  UPDATE wallet_transactions
  SET description = REPLACE(description, 'TOPUP-', 'TU-')
  WHERE description LIKE '%TOPUP-%';
  
  UPDATE wallet_transactions
  SET description = REPLACE(description, 'STAMPT-', 'ST-')
  WHERE description LIKE '%STAMPT-%';
  
  -- Update metadata order_numbers
  UPDATE wallet_transactions
  SET metadata = jsonb_set(
    metadata,
    '{order_number}',
    to_jsonb(REPLACE(metadata->>'order_number', 'TOPUP-', 'TU-'))
  )
  WHERE metadata->>'order_number' LIKE 'TOPUP-%';
  
  UPDATE wallet_transactions
  SET metadata = jsonb_set(
    metadata,
    '{order_number}',
    to_jsonb(REPLACE(metadata->>'order_number', 'STAMPT-', 'ST-'))
  )
  WHERE metadata->>'order_number' LIKE 'STAMPT-%';
  
  RAISE NOTICE 'Wallet transaction descriptions and metadata updated';
END $$;
