/*
  # Create Stars Balance Helper Function

  1. New Functions
    - `get_user_stars_balance(user_id)` - Calculates user stars balance from transaction history
      - Returns accurate balance based on all earn/bonus/spend transactions
      - Always returns non-negative value (minimum 0)
      - Single source of truth for stars balance

  2. Purpose
    - Provides consistent way to calculate stars balance across all database operations
    - Replaces reliance on the deprecated `total_stars` column
    - Ensures balance is always accurate and based on transaction history

  3. Usage
    - Check if user can afford action: `SELECT get_user_stars_balance('uuid') >= 50`
    - Get balance in queries: `SELECT id, name, get_user_stars_balance(id) as stars FROM users`
    - Use in functions instead of reading `total_stars` field

  4. Important Notes
    - This function calculates balance on-the-fly from `stars_transactions` table
    - Balance = SUM(earn + bonus) + SUM(spend) where spend amounts are negative
    - Returns 0 if balance would be negative (safety check)
    - Transaction-based calculation prevents sync issues
*/

-- Create function to calculate user stars balance from transactions
CREATE OR REPLACE FUNCTION get_user_stars_balance(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Calculate stars balance from all transactions
  -- earn/bonus: positive amounts
  -- spend: negative amounts (already stored as negative)
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type IN ('earn', 'bonus') THEN amount 
      WHEN transaction_type = 'spend' THEN amount
      ELSE 0 
    END
  ), 0) INTO v_balance
  FROM stars_transactions
  WHERE user_id = p_user_id;
  
  -- Return balance, never negative (safety check)
  RETURN GREATEST(0, v_balance);
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION get_user_stars_balance(uuid) IS 
'Calculates user stars balance from transaction history. 
Single source of truth for stars balance.
Returns 0 if balance would be negative (safety check).
Use this instead of the deprecated total_stars column.';
