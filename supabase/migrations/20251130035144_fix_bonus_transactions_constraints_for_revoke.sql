/*
  # Fix Bonus Transactions Constraints for Revoke Operations

  ## Issues Fixed
  1. Amount constraint violation - revoke function tried to insert negative amounts
  2. Transaction type constraint violation - 'revoke' type not allowed
  3. Ambiguous semantics - negative vs positive amounts

  ## Solution
  - Add 'revoke' and 'gacha_prize' to allowed transaction types
  - Keep amount constraint as >= 0 (always store absolute/positive values)
  - Use transaction_type to indicate direction:
    - redemption = deduct bonus (spending at shop)
    - refund = add bonus (order cancelled/refunded)
    - topup_bonus = add bonus (earned from wallet topup)
    - revoke = deduct bonus (admin removes gacha prize)
    - gacha_prize = add bonus (won from gacha)

  ## Best Practice
  This follows accounting best practices where amounts are always positive
  and the transaction type provides semantic meaning (debit vs credit).
*/

-- Drop existing constraint
ALTER TABLE bonus_transactions
DROP CONSTRAINT IF EXISTS bonus_transactions_transaction_type_check;

-- Add new constraint with revoke and gacha_prize types
ALTER TABLE bonus_transactions
ADD CONSTRAINT bonus_transactions_transaction_type_check
CHECK (transaction_type IN ('redemption', 'refund', 'topup_bonus', 'revoke', 'gacha_prize'));

-- Keep amount constraint as positive values only (best practice)
-- This ensures amounts are always stored as absolute values
ALTER TABLE bonus_transactions
DROP CONSTRAINT IF EXISTS bonus_transactions_amount_check;

ALTER TABLE bonus_transactions
ADD CONSTRAINT bonus_transactions_amount_check
CHECK (amount > 0);

-- Update column comments for clarity
COMMENT ON COLUMN bonus_transactions.amount IS 
'Amount of bonus balance change (always positive). Transaction type indicates direction: 
redemption/revoke = deduct, refund/topup_bonus/gacha_prize = add';

COMMENT ON COLUMN bonus_transactions.transaction_type IS 
'Type of transaction:
- redemption: bonus spent at shop (deduct)
- refund: order cancelled/refunded (add)
- topup_bonus: earned from wallet topup (add)
- revoke: admin removes gacha prize (deduct)
- gacha_prize: won from gacha (add)';

COMMENT ON TABLE bonus_transactions IS 
'Tracks all bonus balance changes. Amounts are always positive; transaction_type indicates if adding or deducting.
Deductions: redemption, revoke
Additions: refund, topup_bonus, gacha_prize';
