/*
  # Disable RLS on shop_orders for Development
  
  1. Changes
    - Disables Row Level Security on shop_orders table
  
  2. Security
    - This is for DEVELOPMENT ONLY
    - The app uses a custom authentication system with localStorage
    - RLS should be re-enabled and updated for production with proper auth
  
  3. Notes
    - Allows order creation without Supabase auth.uid()
    - Complements previous RLS disabling for shop_cart_items and shop_products
*/

-- Disable RLS on shop_orders table for development
ALTER TABLE shop_orders DISABLE ROW LEVEL SECURITY;
