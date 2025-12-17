/*
  # Enable CMS Admin Access to All Redemption Tables

  1. Purpose
    - Allow CMS admins to view all redemption data
    - Fix RLS policies blocking redemption queries
    - Enable proper data visibility in CMS Redemptions page

  2. Tables Affected
    - voucher_redemptions
    - bonus_transactions
    - redemptions (reward redemptions)
    - order_item_redemptions

  3. Security
    - Policies check for authenticated admin_users
    - Read-only access (SELECT only)
    - Admins can view all redemption records
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "CMS admins can view voucher redemptions" ON voucher_redemptions;
DROP POLICY IF EXISTS "CMS admins can view bonus transactions" ON bonus_transactions;
DROP POLICY IF EXISTS "CMS admins can view redemptions" ON redemptions;
DROP POLICY IF EXISTS "CMS admins can view order item redemptions" ON order_item_redemptions;

-- 1. Voucher Redemptions - Allow admins to view all voucher redemptions
CREATE POLICY "CMS admins can view voucher redemptions"
ON voucher_redemptions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.auth_id = auth.uid()
  )
);

-- 2. Bonus Transactions - Allow admins to view all bonus transactions
CREATE POLICY "CMS admins can view bonus transactions"
ON bonus_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.auth_id = auth.uid()
  )
);

-- 3. Redemptions (Rewards) - Allow admins to view all reward redemptions
CREATE POLICY "CMS admins can view redemptions"
ON redemptions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.auth_id = auth.uid()
  )
);

-- 4. Order Item Redemptions - Allow admins to view all order item redemptions
CREATE POLICY "CMS admins can view order item redemptions"
ON order_item_redemptions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.auth_id = auth.uid()
  )
);
