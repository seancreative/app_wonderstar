/*
  # Add Collection Number to Shop Orders

  1. Changes
    - Add `collection_number` field to shop_orders
    - Add auto-increment sequence for collection numbers
    - Create trigger to automatically assign collection numbers
    - Backfill existing orders with collection numbers

  2. Purpose
    - Provide a simpler, sequential number for kitchen staff to use
    - Format: CN-YYYYMMDD-#### (e.g., CN-20251212-0001)
    - Resets daily for easier tracking
*/

-- Add collection_number column
ALTER TABLE shop_orders 
ADD COLUMN IF NOT EXISTS collection_number text;

-- Create index for collection_number
CREATE INDEX IF NOT EXISTS idx_shop_orders_collection_number 
ON shop_orders(collection_number);

-- Create function to generate collection number
CREATE OR REPLACE FUNCTION generate_collection_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_date text;
  next_number integer;
  collection_num text;
BEGIN
  -- Get today's date in YYYYMMDD format
  today_date := to_char(now(), 'YYYYMMDD');
  
  -- Get the next number for today (count existing orders with today's date)
  SELECT COUNT(*) + 1 INTO next_number
  FROM shop_orders
  WHERE DATE(created_at) = CURRENT_DATE
    AND collection_number IS NOT NULL;
  
  -- Format: CN-YYYYMMDD-####
  collection_num := 'CN-' || today_date || '-' || LPAD(next_number::text, 4, '0');
  
  RETURN collection_num;
END;
$$;

-- Create trigger function to auto-assign collection number
CREATE OR REPLACE FUNCTION assign_collection_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign if not already set and payment is paid
  IF NEW.collection_number IS NULL AND NEW.payment_status = 'paid' THEN
    NEW.collection_number := generate_collection_number();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign on INSERT
DROP TRIGGER IF EXISTS trigger_assign_collection_number ON shop_orders;
CREATE TRIGGER trigger_assign_collection_number
  BEFORE INSERT ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION assign_collection_number();

-- Backfill existing orders without collection numbers
DO $$
DECLARE
  order_record RECORD;
  order_date text;
  daily_counter integer;
BEGIN
  -- Process each day's orders
  FOR order_date IN 
    SELECT DISTINCT DATE(created_at)::text as order_date
    FROM shop_orders
    WHERE payment_status = 'paid'
      AND collection_number IS NULL
    ORDER BY order_date
  LOOP
    daily_counter := 1;
    
    -- Update each order for this date
    FOR order_record IN
      SELECT id
      FROM shop_orders
      WHERE DATE(created_at)::text = order_date
        AND payment_status = 'paid'
        AND collection_number IS NULL
      ORDER BY created_at
    LOOP
      UPDATE shop_orders
      SET collection_number = 'CN-' || to_char(created_at, 'YYYYMMDD') || '-' || LPAD(daily_counter::text, 4, '0')
      WHERE id = order_record.id;
      
      daily_counter := daily_counter + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Backfilled collection numbers for existing paid orders';
END $$;

-- Drop and recreate kms_get_orders function to include collection_number
DROP FUNCTION IF EXISTS kms_get_orders(uuid, integer);

CREATE OR REPLACE FUNCTION kms_get_orders(
  p_outlet_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  order_number text,
  collection_number text,
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
    COALESCE(so.collection_number, 'N/A') as collection_number,
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

COMMENT ON COLUMN shop_orders.collection_number IS 'Sequential collection number for kitchen display (e.g., CN-20251212-0001)';
COMMENT ON FUNCTION generate_collection_number() IS 'Generates a sequential collection number for the current day';
COMMENT ON FUNCTION assign_collection_number() IS 'Trigger function to auto-assign collection numbers to new paid orders';
