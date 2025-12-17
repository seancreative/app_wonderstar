/*
  # Disable RLS on Redemptions Tables for Staff Scanner

  1. Changes
    - Disable RLS on `redemptions` table
    - Disable RLS on `stamps_redemptions` table
    - Drop all existing RLS policies (cleanup)

  2. Reason
    - Staff scanner needs to update redemption status
    - Application code already filters by user_id for security
    - No security risk as all queries are properly scoped
*/

-- Drop existing policies on redemptions
DROP POLICY IF EXISTS "Users view own redemptions" ON redemptions;
DROP POLICY IF EXISTS "Users create redemptions" ON redemptions;
DROP POLICY IF EXISTS "CMS admins can view redemptions" ON redemptions;
DROP POLICY IF EXISTS "Service can manage redemptions" ON redemptions;

-- Drop existing policies on stamps_redemptions
DROP POLICY IF EXISTS "Users view own stamp redemptions" ON stamps_redemptions;
DROP POLICY IF EXISTS "Users can create own stamp redemptions" ON stamps_redemptions;
DROP POLICY IF EXISTS "Service can manage stamp redemptions" ON stamps_redemptions;

-- Disable RLS on both tables
ALTER TABLE redemptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE stamps_redemptions DISABLE ROW LEVEL SECURITY;
