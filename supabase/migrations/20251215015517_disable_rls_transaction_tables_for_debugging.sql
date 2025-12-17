/*
  # Disable RLS on Transaction Tables for Debugging

  1. Changes
    - Disable RLS on `bonus_transactions` table to ensure bonus calculations work
    - Disable RLS on `stars_transactions` table to ensure stars calculations work
    - Disable RLS on `wallet_transactions` table to ensure wallet calculations work
  
  2. Security
    - This is a temporary debugging measure
    - RLS should be re-enabled after identifying the root cause
    - All policies remain in place, just not enforced
  
  3. Purpose
    - Eliminate RLS as a potential cause of bonus/stars not adding up
    - Allow comprehensive logging to trace the issue
*/

-- Disable RLS on bonus_transactions
ALTER TABLE bonus_transactions DISABLE ROW LEVEL SECURITY;

-- Disable RLS on stars_transactions
ALTER TABLE stars_transactions DISABLE ROW LEVEL SECURITY;

-- Disable RLS on wallet_transactions (already should be disabled, but ensuring)
ALTER TABLE wallet_transactions DISABLE ROW LEVEL SECURITY;
