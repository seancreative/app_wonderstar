/*
  # Fix CMS Admin Access to Stars Transactions

  ## Changes
  1. Add RLS policy to allow CMS admins to view all stars transactions
  
  ## Security
  - Only authenticated users who exist in admin_users table can view all stars transactions
  - Regular users can still only see their own transactions (existing policy)
  
  ## Notes
  - This fixes the CustomerDetailModal showing 0 stars balance
  - CMS admins need this access to view customer details and transaction history
*/

-- Create policy for CMS admins to view all stars transactions
CREATE POLICY "CMS admins can view all stars transactions"
  ON stars_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM admin_users 
      WHERE admin_users.auth_id = auth.uid() 
        AND admin_users.is_active = true
    )
  );
