/*
  # Expand bonus_transactions types and add tracking fields
  
  1. Changes
    - Update existing transaction types to standardized values
    - Expand transaction_type to include 'earn', 'spend', 'topup_bonus', 'grant', 'refund', 'adjustment', 'revoke'
    - Add `balance_after` column to track balance after each transaction
    - Add `description` column for optional transaction notes
    - Both new columns are nullable to support existing records
  
  2. Purpose
    - Support all bonus earning scenarios (gacha, topups, admin grants)
    - Enable complete transaction history with running balances
    - Support admin notes and transaction descriptions
    - Facilitate auditing and reconciliation
  
  3. Data Migration
    - 'gacha_prize' -> 'earn' (standard earning from gacha)
    - 'redemption' -> 'spend' (using bonus balance)
    - Keep 'topup_bonus', 'refund', 'revoke' as-is
*/

-- Drop existing constraint first to allow updates
ALTER TABLE bonus_transactions 
DROP CONSTRAINT IF EXISTS bonus_transactions_transaction_type_check;

-- Update existing data to use standardized types
UPDATE bonus_transactions SET transaction_type = 'earn' WHERE transaction_type = 'gacha_prize';
UPDATE bonus_transactions SET transaction_type = 'spend' WHERE transaction_type = 'redemption';

-- Add new constraint with expanded types
ALTER TABLE bonus_transactions
ADD CONSTRAINT bonus_transactions_transaction_type_check 
CHECK (transaction_type IN ('earn', 'spend', 'topup_bonus', 'grant', 'refund', 'adjustment', 'revoke'));

-- Add balance_after column to bonus_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bonus_transactions' AND column_name = 'balance_after'
  ) THEN
    ALTER TABLE bonus_transactions ADD COLUMN balance_after numeric(10,2);
  END IF;
END $$;

-- Add description column to bonus_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bonus_transactions' AND column_name = 'description'
  ) THEN
    ALTER TABLE bonus_transactions ADD COLUMN description text;
  END IF;
END $$;