/*
  # KMS Diagnostic and Query Functions

  1. New Functions
    - `kms_get_orders()` - Simplified, robust order fetching for KMS
    - `kms_diagnostic_info()` - Comprehensive diagnostic information
    - `kms_test_connection()` - Simple connection test

  2. Purpose
    - Provide reliable order data for Kitchen Management System
    - Enable comprehensive debugging and troubleshooting
    - Simplify client-side query logic

  3. Features
    - Returns all paid orders with proper joins
    - Includes outlet, user, and item information
    - Handles NULL values gracefully
    - Provides detailed diagnostic information
*/

-- =====================================================
-- Function: Get Orders for KMS
-- =====================================================
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

-- =====================================================
-- Function: KMS Diagnostic Information
-- =====================================================
CREATE OR REPLACE FUNCTION kms_diagnostic_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_orders integer;
  paid_orders integer;
  pending_orders integer;
  orders_with_fnbstatus integer;
  orders_null_fnbstatus integer;
  outlet_count integer;
  user_count integer;
  recent_order_sample jsonb;
BEGIN
  -- Count orders by various criteria
  SELECT COUNT(*) INTO total_orders FROM shop_orders;
  SELECT COUNT(*) INTO paid_orders FROM shop_orders WHERE payment_status = 'paid';
  SELECT COUNT(*) INTO pending_orders FROM shop_orders WHERE payment_status = 'pending';
  SELECT COUNT(*) INTO orders_with_fnbstatus FROM shop_orders WHERE fnbstatus IS NOT NULL;
  SELECT COUNT(*) INTO orders_null_fnbstatus FROM shop_orders WHERE fnbstatus IS NULL AND payment_status = 'paid';
  SELECT COUNT(*) INTO outlet_count FROM outlets;
  SELECT COUNT(*) INTO user_count FROM users;

  -- Get sample of recent paid orders
  SELECT jsonb_agg(
    jsonb_build_object(
      'order_number', order_number,
      'payment_status', payment_status,
      'fnbstatus', fnbstatus,
      'outlet_id', outlet_id,
      'created_at', created_at
    )
  ) INTO recent_order_sample
  FROM (
    SELECT order_number, payment_status, fnbstatus, outlet_id, created_at
    FROM shop_orders
    WHERE payment_status = 'paid'
    ORDER BY created_at DESC
    LIMIT 5
  ) sample;

  -- Build result object
  result := jsonb_build_object(
    'timestamp', now(),
    'database_status', 'connected',
    'orders', jsonb_build_object(
      'total', total_orders,
      'paid', paid_orders,
      'pending', pending_orders,
      'with_fnbstatus', orders_with_fnbstatus,
      'null_fnbstatus_paid', orders_null_fnbstatus
    ),
    'outlets', jsonb_build_object(
      'total', outlet_count
    ),
    'users', jsonb_build_object(
      'total', user_count
    ),
    'recent_paid_orders_sample', COALESCE(recent_order_sample, '[]'::jsonb),
    'fnbstatus_breakdown', (
      SELECT jsonb_object_agg(
        COALESCE(fnbstatus, 'null'),
        count
      )
      FROM (
        SELECT 
          fnbstatus,
          COUNT(*) as count
        FROM shop_orders
        WHERE payment_status = 'paid'
        GROUP BY fnbstatus
      ) breakdown
    )
  );

  RETURN result;
END;
$$;

-- =====================================================
-- Function: Test KMS Connection
-- =====================================================
CREATE OR REPLACE FUNCTION kms_test_connection()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'status', 'ok',
    'timestamp', now(),
    'database', current_database(),
    'message', 'KMS connection successful'
  );
END;
$$;

-- =====================================================
-- Add helpful comments
-- =====================================================
COMMENT ON FUNCTION kms_get_orders IS 'Returns all paid orders for Kitchen Management System with outlet and user details';
COMMENT ON FUNCTION kms_diagnostic_info IS 'Provides comprehensive diagnostic information for KMS troubleshooting';
COMMENT ON FUNCTION kms_test_connection IS 'Simple connection test for KMS system';
