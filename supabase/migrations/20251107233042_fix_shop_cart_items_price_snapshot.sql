/*
  # Fix shop_cart_items price_snapshot constraint

  1. Changes
    - Make price_snapshot column nullable (since we're using unit_price now)
    - Or alternatively, sync price_snapshot with unit_price automatically

  2. Notes
    - This fixes the NOT NULL constraint violation when adding items to cart
    - Maintains backward compatibility
*/

-- Make price_snapshot nullable
ALTER TABLE shop_cart_items ALTER COLUMN price_snapshot DROP NOT NULL;

-- Add a trigger to automatically sync price_snapshot with unit_price if needed
CREATE OR REPLACE FUNCTION sync_cart_item_prices()
RETURNS TRIGGER AS $$
BEGIN
  -- If unit_price is set but price_snapshot is not, copy it over
  IF NEW.unit_price IS NOT NULL AND NEW.price_snapshot IS NULL THEN
    NEW.price_snapshot = NEW.unit_price;
  END IF;
  
  -- If price_snapshot is set but unit_price is not, copy it over
  IF NEW.price_snapshot IS NOT NULL AND NEW.unit_price IS NULL THEN
    NEW.unit_price = NEW.price_snapshot;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before insert or update
DROP TRIGGER IF EXISTS sync_cart_prices_trigger ON shop_cart_items;
CREATE TRIGGER sync_cart_prices_trigger
  BEFORE INSERT OR UPDATE ON shop_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_cart_item_prices();
