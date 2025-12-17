/*
  # Remove Automatic Trigger and Use Manual Redemption Creation

  ## Problem
  The automatic trigger is causing duplicate key violations that fail the entire
  order creation transaction, even with ON CONFLICT handling. This happens because:
  - Triggers run in the same transaction as the INSERT
  - Any error in the trigger fails the entire transaction
  - Race conditions or retry attempts can cause duplicates

  ## Solution
  Remove the automatic trigger and let the application code create redemption
  records after the order is successfully created. This gives us:
  - Better error handling
  - No transaction failures
  - Easier debugging
  - More control over the process

  ## Changes
  1. Drop the automatic trigger
  2. Keep the function for manual use if needed
  3. Application will handle redemption creation explicitly
*/

-- Drop the automatic trigger
DROP TRIGGER IF EXISTS create_order_redemptions_trigger ON shop_orders;

-- Keep the function but rename it for manual use
DROP FUNCTION IF EXISTS create_order_item_redemptions();

-- Create a manual function that can be called explicitly if needed
CREATE OR REPLACE FUNCTION manually_create_order_redemptions(p_order_id uuid)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
  order_record RECORD;
  item_data jsonb;
  item_idx integer := 0;
BEGIN
  -- Get the order
  SELECT id, user_id, outlet_id, items, status
  INTO order_record
  FROM shop_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Only create redemptions if they don't already exist
  IF NOT EXISTS (SELECT 1 FROM order_item_redemptions WHERE order_id = p_order_id) THEN
    -- Loop through items
    FOR item_data IN SELECT * FROM jsonb_array_elements(order_record.items)
    LOOP
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
        order_record.id,
        order_record.user_id,
        item_idx,
        (item_data->>'product_id')::uuid,
        item_data->>'product_name',
        (item_data->>'quantity')::integer,
        0,
        'pending',
        order_record.outlet_id,
        now(),
        now()
      )
      ON CONFLICT (order_id, item_index) DO NOTHING;

      item_idx := item_idx + 1;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;
