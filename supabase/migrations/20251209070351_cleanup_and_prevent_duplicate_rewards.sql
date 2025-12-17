/*
  # Cleanup and Prevent Duplicate Payment Rewards

  1. Security Fix
    - Remove duplicate star/bonus awards that were created by reloading payment callback
    - Keep only the first (earliest) transaction for each wallet topup
    - Add unique constraints to prevent future duplicates

  2. Changes
    - Delete duplicate stars_transactions (keep earliest)
    - Delete duplicate bonus_transactions (keep earliest)
    - Add unique indexes to prevent future duplicates
*/

-- Step 1: Remove duplicate star awards (keep only the first one per wallet_transaction_id)
DELETE FROM stars_transactions
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, metadata->>'wallet_transaction_id'
        ORDER BY created_at ASC
      ) as rn
    FROM stars_transactions
    WHERE source = 'wallet_topup'
      AND transaction_type = 'earn'
      AND metadata->>'wallet_transaction_id' IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Remove duplicate bonus awards (keep only the first one per wallet_transaction_id)
DELETE FROM bonus_transactions
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, metadata->>'wallet_transaction_id'
        ORDER BY created_at ASC
      ) as rn
    FROM bonus_transactions
    WHERE transaction_type = 'topup_bonus'
      AND metadata->>'wallet_transaction_id' IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 3: Add unique constraint for star awards
CREATE UNIQUE INDEX IF NOT EXISTS idx_stars_transactions_unique_wallet_topup
  ON stars_transactions (user_id, (metadata->>'wallet_transaction_id'))
  WHERE source = 'wallet_topup'
    AND transaction_type = 'earn'
    AND metadata->>'wallet_transaction_id' IS NOT NULL;

-- Step 4: Add unique constraint for bonus awards
CREATE UNIQUE INDEX IF NOT EXISTS idx_bonus_transactions_unique_topup
  ON bonus_transactions (user_id, (metadata->>'wallet_transaction_id'))
  WHERE transaction_type = 'topup_bonus'
    AND metadata->>'wallet_transaction_id' IS NOT NULL;
