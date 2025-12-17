/*
  # Enhance Order Item Discount Tracking

  ## Overview
  This migration adds comprehensive discount tracking at the item level for e-receipts
  and financial reporting.

  ## Changes Made
  1. Drop and recreate views that depend on discount_amount
  2. Ensure discount columns can accept proper values
  3. Add helper functions and views for e-receipt generation
*/

-- =====================================================
-- DROP DEPENDENT VIEWS TEMPORARILY
-- =====================================================

DROP VIEW IF EXISTS order_financial_breakdown CASCADE;

-- =====================================================
-- ENSURE DISCOUNT COLUMNS CAN BE PROPERLY SET
-- =====================================================

-- Drop any check constraints that might prevent discount_amount updates
DO $$
BEGIN
  ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS shop_orders_discount_amount_check;
  ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS shop_orders_bonus_discount_amount_check;
  ALTER TABLE shop_orders DROP CONSTRAINT IF EXISTS shop_orders_permanent_discount_amount_check;
END $$;

-- Ensure all discount columns have proper defaults
ALTER TABLE shop_orders 
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN bonus_discount_amount SET DEFAULT 0,
  ALTER COLUMN permanent_discount_amount SET DEFAULT 0;

-- Add comments explaining the structure
COMMENT ON COLUMN shop_orders.items IS 'JSONB array of order items with structure: {product_id, product_name, quantity, unit_price, item_discount_amount, item_discount_type, total_price, metadata}';
COMMENT ON COLUMN shop_orders.discount_amount IS 'Total voucher discount applied across all items (DV - sum of all item-level voucher discounts)';
COMMENT ON COLUMN shop_orders.bonus_discount_amount IS 'Bonus balance used for payment (DB discount)';
COMMENT ON COLUMN shop_orders.permanent_discount_amount IS 'Tier or other permanent discounts (DO discount)';
COMMENT ON COLUMN shop_orders.gross_sales IS 'Total before any discounts (sum of all item unit_price × quantity)';

-- =====================================================
-- RECREATE FINANCIAL BREAKDOWN VIEW
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

-- =====================================================
-- CREATE E-RECEIPT DATA VIEW
-- =====================================================

CREATE OR REPLACE VIEW order_receipt_data AS
SELECT 
  o.id,
  o.order_number,
  o.created_at,
  o.status,
  o.payment_method,
  o.payment_type,
  u.name as customer_name,
  u.email as customer_email,
  u.phone as customer_phone,
  out.name as outlet_name,
  out.location as outlet_location,
  out.address as outlet_address,
  o.items,
  o.subtotal,
  o.gross_sales,
  o.discount_amount as voucher_discount,
  o.bonus_discount_amount as bonus_discount,
  o.permanent_discount_amount as tier_discount,
  (o.discount_amount + o.bonus_discount_amount + o.permanent_discount_amount) as total_discount,
  o.total_amount as total_paid,
  o.voucher_code,
  o.qr_code,
  o.metadata
FROM shop_orders o
LEFT JOIN users u ON u.id = o.user_id
LEFT JOIN outlets out ON out.id = o.outlet_id;

COMMENT ON VIEW order_receipt_data IS 'Complete order data formatted for e-receipt generation and customer order history';

-- =====================================================
-- CREATE FUNCTION TO CALCULATE ITEM TOTALS
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_order_item_totals(order_items JSONB)
RETURNS TABLE (
  total_items INTEGER,
  gross_amount NUMERIC,
  total_item_discounts NUMERIC,
  net_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(jsonb_array_length(order_items), 0)::INTEGER as total_items,
    COALESCE(SUM((item->>'unit_price')::numeric * (item->>'quantity')::integer), 0) as gross_amount,
    COALESCE(SUM(COALESCE((item->>'item_discount_amount')::numeric, 0)), 0) as total_item_discounts,
    COALESCE(SUM(COALESCE((item->>'total_price')::numeric, 0)), 0) as net_amount
  FROM jsonb_array_elements(order_items) as item;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_order_item_totals IS 'Helper function to calculate totals from order items JSONB array';
