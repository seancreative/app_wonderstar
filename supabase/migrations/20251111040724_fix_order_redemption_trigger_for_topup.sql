/*
  # Fix Order Redemption Trigger for Topup Orders

  1. Problem
    - The create_order_redemption_items trigger tries to create redemption items for ALL orders
    - Topup orders don't have product_id or product_name in their items
    - This causes a NOT NULL constraint violation

  2. Solution
    - Update trigger to skip topup orders (payment_type = 'topup')
    - Only create redemption items for actual shop orders
*/

-- Update the trigger function to skip topup orders
CREATE OR REPLACE FUNCTION create_order_redemption_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip creating redemption items for topup orders
  IF NEW.payment_type = 'topup' THEN
    RETURN NEW;
  END IF;

  -- Insert redemption records for each item in the order
  INSERT INTO order_item_redemptions (
    order_id,
    user_id,
    item_index,
    product_id,
    product_name,
    quantity,
    redeemed_quantity,
    status
  )
  SELECT
    NEW.id,
    NEW.user_id,
    idx - 1,
    (item->>'product_id')::uuid,
    item->>'product_name',
    (item->>'quantity')::integer,
    0,
    'pending'
  FROM jsonb_array_elements(NEW.items) WITH ORDINALITY AS t(item, idx);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
