/*
  # Add Admin Access to Orders and Financial Data

  ## Overview
  Enable CMS admin users to view all orders, payment transactions, and related
  financial data by adding RLS policies that check admin_users table.

  ## Problem
  CMS admin users cannot see orders or financial transactions because:
  1. Current policies only allow users to view their OWN data
  2. Admins use custom authentication (admin_users table)
  3. No policies exist for admin access to financial tables

  ## Solution
  Add RLS policies that allow authenticated users who are active admins
  (verified via admin_users table with auth_id) to view all:
  - shop_orders
  - payment_transactions
  - wallet_transactions
  - users (for displaying user info in CMS)
  - outlets (for displaying outlet info)

  ## Security
  - Admin access requires valid Supabase Auth session (auth.uid())
  - Admin must exist in admin_users table
  - Admin must have is_active = true
  - Admin's auth_id must match current auth.uid()
  - Regular users remain limited to their own data
  - Maintains separation between customer and admin access

  ## Requirements
  - Admins must have auth_id populated in admin_users table
  - Admins must sign in via Supabase Auth
  - AdminAuthContext will be updated to handle Supabase Auth signin
*/

-- =====================================================
-- SHOP ORDERS - Add Admin View Policy
-- =====================================================

CREATE POLICY "Admins view all orders"
  ON shop_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- =====================================================
-- PAYMENT TRANSACTIONS - Add Admin View Policy
-- =====================================================

CREATE POLICY "Admins view all payment transactions"
  ON payment_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- =====================================================
-- WALLET TRANSACTIONS - Add Admin View Policy
-- =====================================================

-- Check if policy already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wallet_transactions' 
    AND policyname = 'Admins view all wallet transactions'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins view all wallet transactions"
      ON wallet_transactions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.auth_id = auth.uid()
            AND admin_users.is_active = true
        )
      )';
  END IF;
END $$;

-- =====================================================
-- USERS - Add Admin View Policy
-- =====================================================

-- Admins need to view user info for CMS displays
CREATE POLICY "Admins view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- =====================================================
-- OUTLETS - Ensure Admin View Policy Exists
-- =====================================================

-- Drop existing if it exists to recreate with consistent pattern
DROP POLICY IF EXISTS "Admins view all outlets" ON outlets;

CREATE POLICY "Admins view all outlets"
  ON outlets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- =====================================================
-- ORDER ITEM REDEMPTIONS - Ensure Admin Access
-- =====================================================

-- Admins need to view redemptions for order details
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'order_item_redemptions' 
    AND policyname = 'Admins view all redemptions'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins view all redemptions"
      ON order_item_redemptions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users
          WHERE admin_users.auth_id = auth.uid()
            AND admin_users.is_active = true
        )
      )';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ADDED: Admin access policies';
  RAISE NOTICE '';
  RAISE NOTICE 'Admin Users Can Now View:';
  RAISE NOTICE '  ✓ All shop orders';
  RAISE NOTICE '  ✓ All payment transactions';
  RAISE NOTICE '  ✓ All wallet transactions';
  RAISE NOTICE '  ✓ All user profiles';
  RAISE NOTICE '  ✓ All outlets';
  RAISE NOTICE '  ✓ All order redemptions';
  RAISE NOTICE '';
  RAISE NOTICE 'Requirements:';
  RAISE NOTICE '  • Admin must have auth_id in admin_users';
  RAISE NOTICE '  • Admin must sign in via Supabase Auth';
  RAISE NOTICE '  • Admin must have is_active = true';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Step: Update AdminAuthContext to sign in';
  RAISE NOTICE '========================================';
END $$;
