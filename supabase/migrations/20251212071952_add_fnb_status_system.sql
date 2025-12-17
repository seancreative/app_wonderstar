/*
  # Add F&B Kitchen Status System

  1. New Fields
    - `fnbstatus` (text) - Kitchen preparation status for F&B orders
      - Values: 'preparing', 'ready', 'collected', 'cancelled'
      - Default: 'preparing'
    - `fnbstatus_updated_at` (timestamptz) - When status was last changed
    - `fnbstatus_updated_by` (uuid) - Staff member who changed the status

  2. Functions
    - `update_fnb_status` - Updates fnbstatus with tracking
    - Auto-backfill existing orders with appropriate fnbstatus

  3. Changes
    - Add fnbstatus column to shop_orders table
    - Add index for query performance
    - Create status update function
    - Backfill existing F&B orders

  Note: This is completely independent from payment_status and fulfillment status
*/

-- Add fnbstatus fields to shop_orders table
ALTER TABLE shop_orders
ADD COLUMN IF NOT EXISTS fnbstatus text
CHECK (fnbstatus IN ('preparing', 'ready', 'collected', 'cancelled'));

ALTER TABLE shop_orders
ADD COLUMN IF NOT EXISTS fnbstatus_updated_at timestamptz;

ALTER TABLE shop_orders
ADD COLUMN IF NOT EXISTS fnbstatus_updated_by uuid REFERENCES staff_passcodes(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_shop_orders_fnbstatus ON shop_orders(fnbstatus) WHERE fnbstatus IS NOT NULL;

-- Create function to update fnbstatus
CREATE OR REPLACE FUNCTION update_fnb_status(
  p_order_id uuid,
  p_new_status text,
  p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Validate status
  IF p_new_status NOT IN ('preparing', 'ready', 'collected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid fnbstatus: %', p_new_status;
  END IF;

  -- Update the order
  UPDATE shop_orders
  SET
    fnbstatus = p_new_status,
    fnbstatus_updated_at = now(),
    fnbstatus_updated_by = p_staff_id
  WHERE id = p_order_id
  RETURNING jsonb_build_object(
    'id', id,
    'order_number', order_number,
    'fnbstatus', fnbstatus,
    'fnbstatus_updated_at', fnbstatus_updated_at
  ) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  RETURN v_result;
END;
$$;

-- Backfill existing orders with fnbstatus based on their current status
UPDATE shop_orders
SET
  fnbstatus = CASE
    WHEN status IN ('completed') THEN 'collected'
    WHEN status IN ('cancelled') THEN 'cancelled'
    WHEN status IN ('ready', 'confirmed', 'waiting_payment', 'pending') THEN 'preparing'
    ELSE 'preparing'
  END,
  fnbstatus_updated_at = updated_at
WHERE fnbstatus IS NULL;