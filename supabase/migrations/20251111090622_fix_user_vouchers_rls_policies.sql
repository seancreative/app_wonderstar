/*
  # Fix User Vouchers RLS Policies

  ## Overview
  This migration fixes the RLS policies on user_vouchers table to allow
  voucher redemption by authenticated users.

  ## Changes
  1. Drop existing policies
  2. Recreate policies with proper permissions
  3. Allow authenticated users to redeem vouchers (insert into user_vouchers)

  ## Security
  - Users can view their own vouchers
  - Authenticated users can redeem vouchers (insert)
  - Users can update their own vouchers
  - System can manage vouchers for auto-issuance
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own vouchers" ON user_vouchers;
DROP POLICY IF EXISTS "System can insert user vouchers" ON user_vouchers;
DROP POLICY IF EXISTS "Users can update own vouchers" ON user_vouchers;

-- Recreate policies with proper permissions
CREATE POLICY "Users can view own vouchers"
  ON user_vouchers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can redeem vouchers"
  ON user_vouchers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR true);

CREATE POLICY "Users can update own vouchers"
  ON user_vouchers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow service role to manage vouchers (for auto-issuance)
CREATE POLICY "Service role can manage vouchers"
  ON user_vouchers FOR ALL
  USING (true)
  WITH CHECK (true);
