/*
  # Add TOPUP Order Prefix for Wallet Top-ups

  1. Changes
    - Add 'topup' as valid payment_type for wallet top-ups
    - Update generate_order_number function to support TOPUP- prefix
    - Update validation function for TOPUP prefix
    - Update trigger to handle topup payment type
  
  2. Order Prefix Structure
    - W- for Fiuu payments (real money shop orders)
    - DD- for internal wallet deductions
    - STAMPT- for stamp redemptions
    - TOPUP- for wallet top-ups (NEW)
*/

-- =====================================================
-- UPDATE PAYMENT_TYPE CONSTRAINT TO INCLUDE TOPUP
-- =====================================================
ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS valid_payment_type;
ALTER TABLE shop_orders ADD CONSTRAINT valid_payment_type
  CHECK (payment_type IN ('payment', 'deduction', 'redemption', 'topup'));

-- =====================================================
-- UPDATE ORDER NUMBER GENERATION WITH TOPUP PREFIX
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
    WHEN 'deduction' THEN prefix := 'DD-';
    WHEN 'redemption' THEN prefix := 'STAMPT-';
    WHEN 'topup' THEN prefix := 'TOPUP-';
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
-- UPDATE VALIDATION FUNCTION FOR TOPUP PREFIX
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
    WHEN 'deduction' THEN
      RETURN p_order_number LIKE 'DD-%';
    WHEN 'redemption' THEN
      RETURN p_order_number LIKE 'STAMPT-%';
    WHEN 'topup' THEN
      RETURN p_order_number LIKE 'TOPUP-%';
    ELSE
      RETURN TRUE; -- Allow any format for unknown types
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE TRIGGER TO HANDLE TOPUP PAYMENT TYPE
-- =====================================================
CREATE OR REPLACE FUNCTION set_order_payment_type_and_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-detect payment_type if not set
  IF NEW.payment_type IS NULL THEN
    -- Determine payment type based on payment_method
    IF NEW.payment_method IN ('credit', 'debit', 'card', 'fpx', 'grabpay', 'tng', 'boost') THEN
      -- Check if this is a topup order based on metadata or items
      IF NEW.metadata ? 'is_topup' AND (NEW.metadata->>'is_topup')::boolean = true THEN
        NEW.payment_type := 'topup';
      ELSE
        NEW.payment_type := 'payment';
      END IF;
    ELSIF NEW.payment_method = 'wonderstars' THEN
      NEW.payment_type := 'deduction';
    ELSIF NEW.payment_method IN ('stamps', 'free_reward') THEN
      NEW.payment_type := 'redemption';
    ELSE
      -- Default to deduction for internal wallet
      NEW.payment_type := 'deduction';
    END IF;
  END IF;
  
  -- Generate order number with appropriate prefix if not set
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number(NEW.payment_type);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
