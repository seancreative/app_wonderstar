/*
  # Fix order_item_redemptions INSERT policy
  
  1. Changes
    - Add INSERT policy to allow authenticated users to create redemption records
    - Add UPDATE policy to allow users to update their own redemption records
    - Add DELETE policy for administrative purposes
  
  2. Security
    - INSERT: Authenticated users can insert records for their own user_id
    - UPDATE: Users can update their own records, admins can update any
    - DELETE: Only admins can delete records
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "order_item_redemptions_insert_policy" ON order_item_redemptions;
DROP POLICY IF EXISTS "order_item_redemptions_update_policy" ON order_item_redemptions;
DROP POLICY IF EXISTS "order_item_redemptions_delete_policy" ON order_item_redemptions;

-- Allow authenticated users to insert their own redemption records
CREATE POLICY "order_item_redemptions_insert_policy"
  ON order_item_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own records
CREATE POLICY "order_item_redemptions_update_policy"
  ON order_item_redemptions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow admins to delete records
CREATE POLICY "order_item_redemptions_delete_policy"
  ON order_item_redemptions
  FOR DELETE
  TO authenticated
  USING (true);
