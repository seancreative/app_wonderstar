/*
  # Fix F&B Status Default Value and Auto-Assignment

  1. Changes
    - Add DEFAULT 'preparing' to fnbstatus column
    - Create trigger to auto-set fnbstatus on new orders
    - Backfill all existing NULL fnbstatus values to 'preparing'

  2. Security
    - No RLS changes (RLS already disabled on shop_orders)

  3. Purpose
    - Ensures all F&B orders show up in KMS kitchen display immediately
    - Fixes issue where new orders have NULL fnbstatus and don't appear
*/

-- Add DEFAULT value to fnbstatus column
ALTER TABLE shop_orders
ALTER COLUMN fnbstatus SET DEFAULT 'preparing';

-- Create function to auto-set fnbstatus on INSERT
CREATE OR REPLACE FUNCTION set_fnbstatus_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set fnbstatus if not already set and if payment_status is 'paid'
  IF NEW.fnbstatus IS NULL AND NEW.payment_status = 'paid' THEN
    NEW.fnbstatus := 'preparing';
    NEW.fnbstatus_updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-set fnbstatus on INSERT
DROP TRIGGER IF EXISTS trigger_set_fnbstatus_on_insert ON shop_orders;
CREATE TRIGGER trigger_set_fnbstatus_on_insert
  BEFORE INSERT ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_fnbstatus_on_insert();

-- Backfill all NULL fnbstatus values to 'preparing' for paid orders
UPDATE shop_orders
SET
  fnbstatus = 'preparing',
  fnbstatus_updated_at = COALESCE(fnbstatus_updated_at, updated_at, created_at)
WHERE fnbstatus IS NULL
  AND payment_status = 'paid'
  AND status IN ('ready', 'waiting_payment', 'confirmed', 'pending');

-- Set collected status for completed orders with NULL fnbstatus
UPDATE shop_orders
SET
  fnbstatus = 'collected',
  fnbstatus_updated_at = COALESCE(fnbstatus_updated_at, updated_at, created_at)
WHERE fnbstatus IS NULL
  AND status = 'completed';

-- Set cancelled status for cancelled orders with NULL fnbstatus
UPDATE shop_orders
SET
  fnbstatus = 'cancelled',
  fnbstatus_updated_at = COALESCE(fnbstatus_updated_at, updated_at, created_at)
WHERE fnbstatus IS NULL
  AND status = 'cancelled';
