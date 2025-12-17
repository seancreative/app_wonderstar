/*
  # Update Shop Products RLS for Public Access

  1. Changes
    - Drop existing restrictive SELECT policy
    - Add new policy allowing public (anon + authenticated) to view active products
  
  2. Security
    - Maintains RLS enabled
    - Only allows viewing active products
    - No write permissions for public users
*/

DROP POLICY IF EXISTS "Anyone can view active products" ON shop_products;

CREATE POLICY "Public can view active products"
  ON shop_products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
