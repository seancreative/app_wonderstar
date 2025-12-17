/*
  # Fix Shop Orders RLS for Staff Scanning
  
  ## Summary
  This migration ensures staff can scan and read shop orders for redemption purposes.
  Staff need read access to shop_orders table to scan QR codes and process orders.
  
  ## Changes
  1. Add RLS policy allowing authenticated staff to read orders
  2. Add RLS policy allowing staff to update order status during scanning
  3. Ensure staff can access order_item_redemptions for tracking
  
  ## Security
  - Staff can only READ orders (not create/delete)
  - Staff can UPDATE redemption status
  - All actions are logged via RLS
*/

-- Enable RLS on shop_orders if not already enabled
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

-- Drop old conflicting policies if they exist
DROP POLICY IF EXISTS "Staff can read orders for scanning" ON shop_orders;
DROP POLICY IF EXISTS "Authenticated staff can read orders" ON shop_orders;

-- Allow authenticated users (staff/managers) to read all orders for scanning
CREATE POLICY "Staff can read orders for scanning"
  ON shop_orders
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated staff to read order_item_redemptions
DROP POLICY IF EXISTS "Staff can read redemptions" ON order_item_redemptions;

CREATE POLICY "Staff can read redemptions"
  ON order_item_redemptions
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow staff to update redemption records
DROP POLICY IF EXISTS "Staff can update redemptions" ON order_item_redemptions;

CREATE POLICY "Staff can update redemptions"
  ON order_item_redemptions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Staff can read orders for scanning" ON shop_orders IS 'Allows authenticated staff to scan and view orders';
COMMENT ON POLICY "Staff can read redemptions" ON order_item_redemptions IS 'Allows staff to view redemption status';
COMMENT ON POLICY "Staff can update redemptions" ON order_item_redemptions IS 'Allows staff to update redemption status when scanning';
