/*
  # Fix Order Redemptions Trigger Duplicate Key Error

  ## Problem
  When creating orders, duplicate key violations occur on order_item_redemptions
  even though we have ON CONFLICT DO NOTHING. This happens when:
  - Orders are being retried after failures
  - Trigger fires multiple times unexpectedly
  
  ## Solution
  Update the trigger function to check if redemption records already exist
  before attempting to insert them. This prevents the duplicate key error
  from ever being raised.

  ## Changes
  1. Add EXISTS check before INSERT to avoid conflict
  2. Keep ON CONFLICT as safety net
  3. Add better error handling
*/

-- Drop and recreate the function with improved duplicate handling
CREATE OR REPLACE FUNCTION create_order_item_redemptions()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  item_data jsonb;
  item_idx integer := 0;
  existing_count integer;
BEGIN
  -- Only create redemptions for orders that need them
  IF NEW.status IN ('pending', 'confirmed', 'ready') AND NEW.items IS NOT NULL THEN
    
    -- Check if redemption records already exist for this order
    SELECT COUNT(*) INTO existing_count
    FROM order_item_redemptions
    WHERE order_id = NEW.id;
    
    -- Only proceed if no redemption records exist yet
    IF existing_count = 0 THEN
      -- Loop through each item in the items array
      FOR item_data IN SELECT * FROM jsonb_array_elements(NEW.items)
      LOOP
        -- Insert redemption record for this item
        -- Use ON CONFLICT as a safety net in case of race conditions
        BEGIN
          INSERT INTO order_item_redemptions (
            order_id,
            user_id,
            item_index,
            product_id,
            product_name,
            quantity,
            redeemed_quantity,
            status,
            redeemed_at_outlet_id,
            created_at,
            updated_at
          ) VALUES (
            NEW.id,
            NEW.user_id,
            item_idx,
            (item_data->>'product_id')::uuid,
            item_data->>'product_name',
            (item_data->>'quantity')::integer,
            0,
            'pending',
            NEW.outlet_id,
            now(),
            now()
          )
          ON CONFLICT (order_id, item_index) DO NOTHING;
        EXCEPTION
          WHEN unique_violation THEN
            -- Silently ignore duplicate key errors
            NULL;
        END;

        item_idx := item_idx + 1;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists (it should already, but this is idempotent)
DROP TRIGGER IF EXISTS create_order_redemptions_trigger ON shop_orders;
CREATE TRIGGER create_order_redemptions_trigger
  AFTER INSERT ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_order_item_redemptions();
