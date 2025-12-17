/*
  # Add topup_bonus Transaction Type to Bonus Transactions

  1. Changes
    - Extend bonus_transactions.transaction_type CHECK constraint
    - Add 'topup_bonus' to allowed values alongside 'redemption' and 'refund'

  2. Purpose
    - Track bonus balance awards from wallet top-ups
    - Provides complete audit trail of all bonus balance changes
    - Enables reporting on bonus sources (topups vs other sources)
*/

-- Drop the existing constraint
ALTER TABLE bonus_transactions
DROP CONSTRAINT IF EXISTS bonus_transactions_transaction_type_check;

-- Add new constraint with topup_bonus included
ALTER TABLE bonus_transactions
ADD CONSTRAINT bonus_transactions_transaction_type_check
CHECK (transaction_type IN ('redemption', 'refund', 'topup_bonus'));

-- Update comment for clarity
COMMENT ON COLUMN bonus_transactions.transaction_type IS 'Type of transaction: redemption (usage), refund (return), or topup_bonus (earned from topup)';
