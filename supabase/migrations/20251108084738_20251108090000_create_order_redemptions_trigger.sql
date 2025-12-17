/*
  # Create Order Item Redemptions Trigger

  ## Overview
  Automatically creates redemption tracking records for each item in a shop order.
  When a new order is created, this trigger parses the items JSONB array and creates
  individual redemption records that staff can mark as completed when items are picked up.

  ## Changes

  1. **Function: create_order_item_redemptions()**
     - Triggered after INSERT on shop_orders table
     - Parses the items JSONB array from the order
     - Creates one order_item_redemptions record per item
     - Sets initial status to 'pending'
     - Captures product_id, product_name, quantity, and item position

  2. **Trigger: create_order_redemptions_trigger**
     - Fires AFTER INSERT on shop_orders
     - Only processes orders with 'pending', 'confirmed', or 'ready' status
     - Automatically called for each new order

  3. **Backfill Script**
     - Creates redemption records for all existing orders that don't have them
     - Only processes orders with redeemable status
     - Ensures item_index matches the array position

  ## Example Flow

  When order created with 3 items:
  ```json
  {
    "items": [
      {"product_id": "abc", "product_name": "Coffee", "quantity": 2},
      {"product_id": "def", "product_name": "Cake", "quantity": 1},
      {"product_id": "ghi", "product_name": "Cookie", "quantity": 3}
    ]
  }
  ```

  Creates 3 redemption records:
  - item_index: 0, product_name: "Coffee", quantity: 2, status: "pending"
  - item_index: 1, product_name: "Cake", quantity: 1, status: "pending"
  - item_index: 2, product_name: "Cookie", quantity: 3, status: "pending"

  ## Security
  - Uses SECURITY DEFINER to ensure trigger runs with proper permissions
  - No RLS policy changes needed
*/

-- Function to create redemption records for order items
CREATE OR REPLACE FUNCTION create_order_item_redemptions()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  item_data jsonb;
  item_idx integer := 0;
BEGIN
  -- Only create redemptions for orders that need them
  IF NEW.status IN ('pending', 'confirmed', 'ready') AND NEW.items IS NOT NULL THEN
    -- Loop through each item in the items array
    FOR item_data IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      -- Insert redemption record for this item
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

      item_idx := item_idx + 1;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create redemption records
DROP TRIGGER IF EXISTS create_order_redemptions_trigger ON shop_orders;
CREATE TRIGGER create_order_redemptions_trigger
  AFTER INSERT ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_order_item_redemptions();

-- Backfill: Create redemption records for existing orders that don't have them
DO $$
DECLARE
  order_record RECORD;
  item_data jsonb;
  item_idx integer;
BEGIN
  -- Loop through all existing orders that should have redemptions
  FOR order_record IN
    SELECT id, user_id, outlet_id, items, status
    FROM shop_orders
    WHERE status IN ('pending', 'confirmed', 'ready', 'completed')
    AND items IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM order_item_redemptions WHERE order_id = shop_orders.id
    )
  LOOP
    item_idx := 0;

    -- Loop through each item in this order
    FOR item_data IN SELECT * FROM jsonb_array_elements(order_record.items)
    LOOP
      -- Insert redemption record
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
        CASE
          WHEN order_record.status = 'completed' THEN 'completed'
          ELSE 'pending'
        END,
        order_record.outlet_id,
        now(),
        now()
      )
      ON CONFLICT (order_id, item_index) DO NOTHING;

      item_idx := item_idx + 1;
    END LOOP;

    RAISE NOTICE 'Created redemption records for order %', order_record.id;
  END LOOP;
END $$;
