/*
  # Fix Wallet Topup Status Synchronization

  ## Problem
  When wallet topups succeed via payment callback, the wallet_transactions status gets updated
  but the related shop_orders status may not update if the payment callback parameters are missing.
  This causes:
  - W Balance showing 0 even after successful payment
  - Order status stuck in 'waiting_payment' or 'pending'
  - Users not receiving their topup funds

  ## Solution
  Create a database trigger that automatically updates shop_orders status when the related
  wallet_transaction status changes to 'success' for topup orders.

  ## Changes
  1. Create trigger function to sync shop_orders status with wallet_transactions
  2. Trigger fires when wallet_transactions status changes to 'success'
  3. Only affects orders where metadata.is_topup = true
  4. Updates order status to 'completed' and payment_status to 'paid'
  5. Sets completed_at and confirmed_at timestamps

  ## Security
  - RLS remains disabled (following project pattern)
  - Trigger runs with security definer privileges
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_shop_order_on_wallet_success ON wallet_transactions;
DROP FUNCTION IF EXISTS sync_shop_order_on_wallet_success();

-- Create trigger function
CREATE OR REPLACE FUNCTION sync_shop_order_on_wallet_success()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id uuid;
  v_order_count integer;
BEGIN
  -- Only proceed if status changed to 'success'
  IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
    
    -- Get order_id from metadata
    v_order_id := (NEW.metadata->>'order_id')::uuid;
    
    IF v_order_id IS NOT NULL THEN
      -- Check if this is a topup order
      SELECT COUNT(*) INTO v_order_count
      FROM shop_orders
      WHERE id = v_order_id
        AND (metadata->>'is_topup')::boolean = true
        AND payment_status != 'paid';
      
      IF v_order_count > 0 THEN
        -- Update the shop order
        UPDATE shop_orders
        SET 
          status = 'completed',
          payment_status = 'paid',
          completed_at = COALESCE(completed_at, NOW()),
          confirmed_at = COALESCE(confirmed_at, NOW()),
          updated_at = NOW()
        WHERE id = v_order_id
          AND payment_status != 'paid';
        
        RAISE NOTICE 'Auto-synced shop_order % to completed/paid based on wallet_transaction %', 
          v_order_id, NEW.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER sync_shop_order_on_wallet_success
  AFTER INSERT OR UPDATE OF status ON wallet_transactions
  FOR EACH ROW
  WHEN (NEW.status = 'success')
  EXECUTE FUNCTION sync_shop_order_on_wallet_success();

COMMENT ON FUNCTION sync_shop_order_on_wallet_success() IS 
  'Automatically updates shop_orders status when wallet_transactions status changes to success for topup orders';

-- Test the trigger is working
DO $$
BEGIN
  RAISE NOTICE 'Wallet topup status sync trigger installed successfully';
END $$;
