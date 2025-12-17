/*
  # Simplified User Vouchers RLS Fix

  ## Overview
  Simplifies RLS policies to ensure voucher redemption works correctly.

  ## Changes
  - Drop all existing policies
  - Create simple, permissive policies for authenticated users
  - Ensure users can redeem vouchers without restrictions
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own vouchers" ON user_vouchers;
DROP POLICY IF EXISTS "System can insert user vouchers" ON user_vouchers;
DROP POLICY IF EXISTS "Users can redeem vouchers" ON user_vouchers;
DROP POLICY IF EXISTS "Users can update own vouchers" ON user_vouchers;
DROP POLICY IF EXISTS "Service role can manage vouchers" ON user_vouchers;

-- Create simplified policies
CREATE POLICY "Authenticated users can view own vouchers"
  ON user_vouchers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert vouchers"
  ON user_vouchers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own vouchers"
  ON user_vouchers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
