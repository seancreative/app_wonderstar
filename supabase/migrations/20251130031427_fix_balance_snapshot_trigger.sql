/*
  # Fix Balance Snapshot Trigger

  ## Issue
  The trigger was trying to access users.w_balance column which doesn't exist.
  The system now uses wallet_transactions to calculate balance.

  ## Fix
  Update the trigger to:
  1. Calculate wallet balance from wallet_transactions (same as user_balances view)
  2. Get bonus_balance from users table (which exists)
  3. Only capture snapshot, never modify user data
*/

-- Update function to use correct balance calculation
CREATE OR REPLACE FUNCTION capture_balance_snapshot_on_order_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only capture balance when order status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Fetch current balance using the same logic as user_balances view
    UPDATE shop_orders
    SET 
      w_balance_after = (
        SELECT COALESCE(SUM(
          CASE 
            WHEN transaction_type = 'topup' THEN amount 
            WHEN transaction_type = 'spend' THEN amount
            ELSE 0 
          END
        ), 0)
        FROM wallet_transactions 
        WHERE user_id = NEW.user_id AND status = 'completed'
      ),
      bonus_balance_after = (
        SELECT COALESCE(bonus_balance, 0) 
        FROM users 
        WHERE id = NEW.user_id
      )
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Captured balance snapshot for order %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION capture_balance_snapshot_on_order_completion IS 
'Automatically captures customer wallet balance snapshot when order status changes to completed. 
Balance is calculated from wallet_transactions table (single source of truth).
This function only reads data and captures snapshot - it NEVER modifies user balances.';
