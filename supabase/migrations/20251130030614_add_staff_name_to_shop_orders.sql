/*
  # Add Staff Name Field for Order Activity Timeline

  ## Overview
  Adds a simple field to track staff member name who performed the last action
  on an order. This enables building a simple activity timeline without a separate
  logging table.

  ## Changes
  1. Add staff_name_last_action field to shop_orders
     - Stores the name of the staff member who performed the last manual action
     - Used for timeline display: "Roy scanned MyQR and changed..."
     - Nullable since not all actions are staff actions

  ## Notes
  - This is a lightweight solution for activity tracking
  - Timeline is generated on-the-fly from timestamp fields
  - No separate logging table needed
*/

-- Add staff_name_last_action field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'staff_name_last_action'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN staff_name_last_action text;
  END IF;
END $$;

COMMENT ON COLUMN shop_orders.staff_name_last_action IS 'Name of staff member who performed the last manual action on this order';
