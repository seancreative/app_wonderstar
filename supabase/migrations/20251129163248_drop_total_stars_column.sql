/*
  # Drop total_stars Column from Users Table

  1. Removes Deprecated Column
    - `users.total_stars` - No longer needed
    - `idx_users_total_stars` - Associated index

  2. Why Remove
    - Column causes confusion (shows wrong balance)
    - Creates sync issues with transaction-based balance
    - Redundant (balance calculated from stars_transactions)
    - No code depends on it anymore

  3. Safety
    - All gacha functions now use transaction-based balance
    - Frontend calculates from transactions
    - CMS uses user_balances view
    - Helper function provides balance calculation

  4. Single Source of Truth
    - `stars_transactions` table is the ONLY source for balance
    - Balance = SUM(earn + bonus) + SUM(spend)
    - No separate balance column needed
    - Prevents sync issues forever

  5. Migration Notes
    - Index dropped first (required before column drop)
    - Column dropped with IF EXISTS for safety
    - Comment added to stars_transactions for future developers
    - No data loss (all data is in transactions)
*/

-- Drop the index first (required)
DROP INDEX IF EXISTS idx_users_total_stars;

-- Drop the deprecated total_stars column
ALTER TABLE users DROP COLUMN IF EXISTS total_stars;

-- Add comment to stars_transactions table for future developers
COMMENT ON TABLE stars_transactions IS 
'Single source of truth for user stars balance.
Balance is calculated by summing all transactions:
- transaction_type = earn or bonus: add amount
- transaction_type = spend: add amount (stored as negative)

IMPORTANT: DO NOT add a balance column to users table.
Always calculate balance from transactions using get_user_stars_balance(user_id).

This prevents sync issues and ensures accuracy.';

-- Add comment to discourage future developers from recreating the column
COMMENT ON TABLE users IS 
'User accounts table.
Stars balance is calculated from stars_transactions table.
DO NOT add total_stars column - use get_user_stars_balance(user_id) function.';
