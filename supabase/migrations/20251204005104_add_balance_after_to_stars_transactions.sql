/*
  # Add balance_after and description to stars_transactions
  
  1. Changes
    - Add `balance_after` column to track balance after each transaction
    - Add `description` column for optional transaction notes
    - Both columns are nullable to support existing records
  
  2. Purpose
    - Enable complete transaction history with running balances
    - Support admin notes and transaction descriptions
    - Facilitate auditing and reconciliation
*/

-- Add balance_after column to stars_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stars_transactions' AND column_name = 'balance_after'
  ) THEN
    ALTER TABLE stars_transactions ADD COLUMN balance_after numeric(10,2);
  END IF;
END $$;

-- Add description column to stars_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stars_transactions' AND column_name = 'description'
  ) THEN
    ALTER TABLE stars_transactions ADD COLUMN description text;
  END IF;
END $$;