/*
  # Rollback Collection Number - Use Order Number Instead

  1. Changes
    - Drop collection_number column from shop_orders
    - Drop related functions and triggers
    - Restore original kms_get_orders function without collection_number

  2. Purpose
    - Collection number will be derived from last 4 digits of order_number
    - No database changes needed
    - Frontend-only solution
*/

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_assign_collection_number ON shop_orders;

-- Drop functions
DROP FUNCTION IF EXISTS assign_collection_number();
DROP FUNCTION IF EXISTS generate_collection_number();

-- Drop column
ALTER TABLE shop_orders 
DROP COLUMN IF EXISTS collection_number;

-- Drop index
DROP INDEX IF EXISTS idx_shop_orders_collection_number;

-- Restore original kms_get_orders function
DROP FUNCTION IF EXISTS kms_get_orders(uuid, integer);

CREATE OR REPLACE FUNCTION kms_get_orders(
  p_outlet_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  order_number text,
  outlet_id uuid,
  outlet_name text,
  outlet_location text,
  user_id uuid,
  user_name text,
  user_phone text,
  items jsonb,
  item_count integer,
  total_amount numeric,
  payment_status text,
  status text,
  fnbstatus text,
  fnbstatus_updated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    so.id,
    so.order_number,
    so.outlet_id,
    COALESCE(o.name, 'Unknown Outlet') as outlet_name,
    COALESCE(o.location, 'Unknown Location') as outlet_location,
    so.user_id,
    COALESCE(u.name, 'Unknown User') as user_name,
    COALESCE(u.phone, 'No Phone') as user_phone,
    COALESCE(so.items, '[]'::jsonb) as items,
    COALESCE(jsonb_array_length(so.items), 0) as item_count,
    so.total_amount,
    COALESCE(so.payment_status, 'unknown') as payment_status,
    COALESCE(so.status, 'unknown') as status,
    so.fnbstatus,
    so.fnbstatus_updated_at,
    so.created_at,
    so.updated_at,
    so.confirmed_at,
    so.completed_at
  FROM shop_orders so
  LEFT JOIN outlets o ON o.id = so.outlet_id
  LEFT JOIN users u ON u.id = so.user_id
  WHERE so.payment_status = 'paid'
    AND (p_outlet_id IS NULL OR so.outlet_id = p_outlet_id)
  ORDER BY so.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION kms_get_orders(uuid, integer) IS 'Returns orders for kitchen display system. Collection number derived from order_number on frontend.';
