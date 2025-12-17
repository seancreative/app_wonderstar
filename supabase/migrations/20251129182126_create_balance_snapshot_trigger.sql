/*
  # Create Trigger to Auto-Capture Balance Snapshot

  1. Function
    - Automatically captures customer's wallet balance when order is completed
    - Updates w_balance_after and bonus_balance_after fields
    - Runs when order status changes to 'completed'

  2. Trigger
    - Fires AFTER UPDATE on shop_orders table
    - Only executes when status changes to 'completed'
    - Captures balance snapshot at that exact moment

  3. Logic
    - Fetches current w_balance and bonus_balance from users table
    - Stores snapshot in the order record
    - Provides point-in-time balance for historical tracking
*/

-- Create function to capture balance snapshot
CREATE OR REPLACE FUNCTION capture_balance_snapshot_on_order_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only capture balance when order status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Fetch current balance from users table
    UPDATE shop_orders
    SET 
      w_balance_after = (SELECT COALESCE(w_balance, 0) FROM users WHERE id = NEW.user_id),
      bonus_balance_after = (SELECT COALESCE(bonus_balance, 0) FROM users WHERE id = NEW.user_id)
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Captured balance snapshot for order %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_capture_balance_snapshot ON shop_orders;

-- Create trigger
CREATE TRIGGER trigger_capture_balance_snapshot
  AFTER UPDATE ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION capture_balance_snapshot_on_order_completion();

COMMENT ON FUNCTION capture_balance_snapshot_on_order_completion IS 'Automatically captures customer wallet balance when order status changes to completed';
