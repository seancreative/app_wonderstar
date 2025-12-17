/*
  # Enable Realtime for Kitchen Management System

  1. Purpose
     - Enable Supabase Realtime for shop_orders table
     - Enable Supabase Realtime for kitchen_item_tracking table
     - Ensure real-time updates work properly for KMS

  2. Changes
     - Add shop_orders to realtime publication
     - Add kitchen_item_tracking to realtime publication

  3. Notes
     - This allows the KMS to receive instant notifications when orders are created/updated
     - No data migration needed, just configuration
*/

-- Enable realtime for shop_orders table
ALTER PUBLICATION supabase_realtime ADD TABLE shop_orders;

-- Enable realtime for kitchen_item_tracking table
ALTER PUBLICATION supabase_realtime ADD TABLE kitchen_item_tracking;
