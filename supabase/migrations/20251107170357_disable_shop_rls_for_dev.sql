/*
  # Disable RLS on Shop Tables for Development

  This migration disables Row Level Security on shop-related tables
  to allow dev mode and testing to work without authentication issues.

  ## Security Warning
  This is for DEVELOPMENT ONLY. Re-enable RLS before production deployment.
*/

-- Disable RLS on shop tables
ALTER TABLE shop_cart_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;
