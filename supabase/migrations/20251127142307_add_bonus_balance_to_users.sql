/*
  # Add Bonus Balance System to Users

  ## Overview
  This migration adds a bonus_balance column to the users table to track bonus credits
  that can be earned through wallet top-ups and used as additional discounts on purchases.

  ## Changes

  1. **users table enhancement**
     - Add `bonus_balance` (decimal) - Tracks user's bonus balance
     - Default value: 0
     - Can only be used as discount, not for direct purchases

  ## Business Rules
  - Bonus balance is separate from W Balance (wallet balance)
  - Bonus can only be earned through wallet top-ups
  - Bonus can only be used as discount on shop purchases
  - Bonus is applied on top of voucher discounts
  - Bonus cannot make order total negative

  ## Top-up Bonus Rewards
  - RM30 top-up: Get RM2 Bonus
  - RM50 top-up: Get RM5 Bonus
  - RM100 top-up: Get RM12 Bonus
  - RM200 top-up: Get RM25 Bonus
  - RM500 top-up: Get RM60 Bonus

  ## Security
  - No changes to RLS policies needed
  - Bonus balance follows existing user security model
*/

-- Add bonus_balance column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'bonus_balance'
  ) THEN
    ALTER TABLE users ADD COLUMN bonus_balance decimal(10,2) DEFAULT 0 NOT NULL;
    RAISE NOTICE 'Added bonus_balance column to users table';
  ELSE
    RAISE NOTICE 'bonus_balance column already exists in users table';
  END IF;
END $$;

-- Initialize bonus_balance to 0 for all existing users
UPDATE users
SET bonus_balance = 0
WHERE bonus_balance IS NULL;

-- Create index for performance on bonus_balance queries
CREATE INDEX IF NOT EXISTS idx_users_bonus_balance ON users(bonus_balance);

-- Add comment to column for documentation
COMMENT ON COLUMN users.bonus_balance IS 'Bonus balance earned from wallet top-ups, can only be used as discount on purchases';