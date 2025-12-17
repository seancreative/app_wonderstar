/*
  # Add Financial Breakdown Columns to Shop Orders

  ## Overview
  This migration adds detailed financial breakdown columns to the shop_orders table
  to enable comprehensive tracking of gross sales, discounts, and net amounts for finance reporting.

  ## Changes Made

  1. **New Columns Added to shop_orders**
     - `bonus_discount_amount` (numeric) - Amount discounted using bonus balance (DB)
     - `permanent_discount_amount` (numeric) - Permanent/other discounts (DO)
     - `gross_sales` (numeric) - Total before any discounts
     - Move bonus_discount from metadata to dedicated column

  2. **Data Backfilling**
     - Extract bonus_discount_amount from existing metadata JSONB
     - Calculate gross_sales from subtotal + all discounts
     - Set defaults for new columns on existing orders

  3. **Financial Calculation Formula**
     - Gross Sales = subtotal (before discounts)
     - DV (Discount Voucher) = discount_amount (existing column)
     - DB (Discount Bonus) = bonus_discount_amount (new column)
     - DO (Discount Others) = permanent_discount_amount (new column)
     - Total Paid = gross_sales - discount_amount - bonus_discount_amount - permanent_discount_amount

  ## Notes
  - All discount amounts should be >= 0 (stored as positive, displayed with minus sign)
  - Gross sales represents the cart value before any discounts
  - This enables finance to see complete transaction breakdown
*/

-- =====================================================
-- ADD NEW FINANCIAL COLUMNS TO SHOP_ORDERS
-- =====================================================

-- Add bonus_discount_amount column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'bonus_discount_amount'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN bonus_discount_amount numeric(10,2) DEFAULT 0 CHECK (bonus_discount_amount >= 0);
  END IF;
END $$;

-- Add permanent_discount_amount column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'permanent_discount_amount'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN permanent_discount_amount numeric(10,2) DEFAULT 0 CHECK (permanent_discount_amount >= 0);
  END IF;
END $$;

-- Add gross_sales column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'gross_sales'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN gross_sales numeric(10,2) DEFAULT 0 CHECK (gross_sales >= 0);
  END IF;
END $$;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_shop_orders_bonus_discount ON shop_orders(bonus_discount_amount);
CREATE INDEX IF NOT EXISTS idx_shop_orders_gross_sales ON shop_orders(gross_sales);

-- =====================================================
-- BACKFILL EXISTING ORDERS
-- =====================================================

-- Extract bonus_discount_amount from metadata JSONB
DO $$
BEGIN
  UPDATE shop_orders
  SET bonus_discount_amount = COALESCE(
    (metadata->>'bonus_discount_amount')::numeric,
    0
  )
  WHERE bonus_discount_amount = 0
    AND metadata IS NOT NULL
    AND metadata ? 'bonus_discount_amount';
END $$;

-- Calculate gross_sales from subtotal (which is the original cart total)
-- Gross sales = subtotal (before discounts were applied)
DO $$
BEGIN
  UPDATE shop_orders
  SET gross_sales = subtotal
  WHERE gross_sales = 0;
END $$;

-- Set permanent_discount_amount to 0 for existing orders (no historical data)
DO $$
BEGIN
  UPDATE shop_orders
  SET permanent_discount_amount = 0
  WHERE permanent_discount_amount IS NULL;
END $$;

-- =====================================================
-- ADD VALIDATION COMMENTS
-- =====================================================

COMMENT ON COLUMN shop_orders.bonus_discount_amount IS 'Amount discounted using bonus balance (DB) - stored as positive value';
COMMENT ON COLUMN shop_orders.permanent_discount_amount IS 'Permanent or other discounts (DO) - stored as positive value';
COMMENT ON COLUMN shop_orders.gross_sales IS 'Total cart value before any discounts applied';
COMMENT ON COLUMN shop_orders.discount_amount IS 'Voucher discount amount (DV) - stored as positive value';

-- =====================================================
-- CREATE FINANCIAL BREAKDOWN VIEW (OPTIONAL)
-- =====================================================

CREATE OR REPLACE VIEW order_financial_breakdown AS
SELECT 
  id,
  order_number,
  user_id,
  outlet_id,
  payment_type,
  payment_method,
  gross_sales,
  discount_amount as voucher_discount,
  bonus_discount_amount as bonus_discount,
  permanent_discount_amount as other_discount,
  total_amount as total_paid,
  (gross_sales - discount_amount - bonus_discount_amount - permanent_discount_amount) as calculated_total,
  created_at,
  status
FROM shop_orders
ORDER BY created_at DESC;

COMMENT ON VIEW order_financial_breakdown IS 'Financial breakdown view showing gross sales, all discount types, and net payment for each order';
