/*
  # Add balance_after to wallet_transactions
  
  1. Changes
    - Add `balance_after` column to track balance after each transaction
    - Nullable to support existing records
  
  2. Purpose
    - Enable complete transaction history with running balances
    - Facilitate auditing and reconciliation
    - Match consistency with other transaction tables
*/

-- Add balance_after column to wallet_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallet_transactions' AND column_name = 'balance_after'
  ) THEN
    ALTER TABLE wallet_transactions ADD COLUMN balance_after numeric(10,2);
  END IF;
END $$;