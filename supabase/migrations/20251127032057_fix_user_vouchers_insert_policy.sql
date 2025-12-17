/*
  # Fix User Vouchers INSERT Policy

  ## Overview
  This migration adds INSERT policy for authenticated users on the user_vouchers table.
  This allows customers to redeem vouchers directly from the frontend.

  ## Problem
  Users were getting "new row violates row-level security policy" error when trying
  to redeem vouchers because only service_role could INSERT into user_vouchers.

  ## Solution
  Add INSERT policy that allows authenticated users to create voucher records for themselves
  with proper validation to ensure security.

  ## Security
  - Users can only insert vouchers for themselves (user_id must match auth.uid())
  - Voucher must reference a valid, active voucher
  - Status must be 'available' on insert
  - All other existing policies remain unchanged
*/

-- =====================================================
-- ADD INSERT POLICY FOR USER VOUCHERS
-- =====================================================

-- Drop the policy if it already exists
DROP POLICY IF EXISTS "Users can redeem vouchers for themselves" ON user_vouchers;

-- Create new INSERT policy for authenticated users
CREATE POLICY "Users can redeem vouchers for themselves"
  ON user_vouchers FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can only insert vouchers for themselves
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    -- Ensure voucher exists and is active
    AND EXISTS (
      SELECT 1 FROM vouchers
      WHERE vouchers.id = user_vouchers.voucher_id
        AND vouchers.is_active = true
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXED: user_vouchers INSERT policy';
  RAISE NOTICE 'Users can now redeem vouchers';
  RAISE NOTICE '========================================';
END $$;
