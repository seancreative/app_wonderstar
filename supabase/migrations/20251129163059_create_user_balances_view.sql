/*
  # Create User Balances View

  1. New View
    - `user_balances` - Consolidated view of all user balances
      - wallet_balance: calculated from wallet_transactions
      - bonus_balance: from users.bonus_balance
      - stars_balance: calculated from stars_transactions using helper function
      - lifetime_topups: from users.lifetime_topups

  2. Purpose
    - Provides single query location for all user financial data
    - Used by CMS for accurate balance reporting
    - All balances calculated from transaction tables (single source of truth)
    - Eliminates need for deprecated balance columns

  3. Usage in CMS
    - Get all balances: `SELECT * FROM user_balances WHERE id = 'user-uuid'`
    - Find high balance users: `SELECT * FROM user_balances WHERE stars_balance > 5000`
    - Analytics queries: Easy to join and aggregate

  4. Benefits
    - Always accurate (calculated from transactions)
    - No sync issues
    - Consistent across system
    - Easy to query
*/

-- Create view for consolidated user balances
CREATE OR REPLACE VIEW user_balances AS
SELECT 
  u.id,
  u.name,
  u.email,
  u.phone,
  u.created_at,
  
  -- Calculate wallet balance from completed transactions
  COALESCE((
    SELECT SUM(
      CASE 
        WHEN transaction_type = 'topup' THEN amount 
        WHEN transaction_type = 'spend' THEN amount
        ELSE 0 
      END
    )
    FROM wallet_transactions 
    WHERE user_id = u.id AND status = 'completed'
  ), 0) as wallet_balance,
  
  -- Bonus balance from users table (still needed for bonus system)
  COALESCE(u.bonus_balance, 0) as bonus_balance,
  
  -- Calculate stars balance using helper function
  get_user_stars_balance(u.id) as stars_balance,
  
  -- Lifetime topups from users table
  COALESCE(u.lifetime_topups, 0) as lifetime_topups
  
FROM users u;

-- Add helpful comment
COMMENT ON VIEW user_balances IS
'Consolidated view of all user balances calculated from transaction tables.
All balances are calculated on-the-fly for accuracy:
- wallet_balance: sum of completed wallet transactions
- bonus_balance: stored in users table
- stars_balance: calculated using get_user_stars_balance() function
- lifetime_topups: sum of all topups from users table

Use this view in CMS for accurate balance reporting.
DO NOT rely on deprecated balance columns in users table.';
