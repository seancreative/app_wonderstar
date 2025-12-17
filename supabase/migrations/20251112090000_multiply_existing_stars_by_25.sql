/*
  # Multiply All Existing Stars by 25

  ## Overview
  Since we updated the stars earning system from 1 star per RM1 to 25 stars per RM1,
  we need to retroactively adjust all existing stars balances to maintain fairness
  and consistency across all users.

  ## Changes
  1. **Update All Stars Transactions**
     - Multiply all existing star amounts by 25
     - Update multiplier values to reflect new system
     - Preserve transaction history and metadata

  2. **Rationale**
     - Users who earned stars under the old system (1 star/RM) should have equivalent
       value in the new system (25 stars/RM)
     - Example: User who spent RM100 and earned 100 stars should now have 2,500 stars
     - This ensures no user loses value from the system upgrade

  ## Impact
  - All users' star balances will be multiplied by 25
  - Historical transaction records will be updated
  - Frontend will automatically reflect new balances
  - No user action required

  ## Notes
  - This is a one-time retroactive adjustment
  - Future stars will be earned at the new rate (25+ per RM)
  - Transaction integrity is maintained
*/

-- Multiply all stars transaction amounts by 25
UPDATE stars_transactions
SET
  amount = amount * 25,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{retroactive_adjustment}',
    'true'::jsonb
  )
WHERE amount != 0;

-- Update multiplier values in stars_transactions to reflect new system
-- Old multipliers were 1.0, 1.2, 1.5, 2.0, 2.5
-- New multipliers are 25.0, 30.0, 37.5, 50.0, 62.5
UPDATE stars_transactions
SET multiplier = CASE
  WHEN multiplier = 1.0 THEN 25.0
  WHEN multiplier = 1.2 THEN 30.0
  WHEN multiplier = 1.5 THEN 37.5
  WHEN multiplier = 2.0 THEN 50.0
  WHEN multiplier = 2.5 THEN 62.5
  ELSE multiplier * 25.0  -- For any other values, multiply by 25
END
WHERE multiplier < 10.0;  -- Only update old-system multipliers

-- Add a note to the metadata indicating this was a system-wide adjustment
COMMENT ON TABLE stars_transactions IS 'Stars transaction history. All transactions before 2025-11-12 were adjusted (multiplied by 25) to align with the new earning system (25 stars per RM1).';

-- Initialize bonus_progress for all existing users based on their current stars balance
INSERT INTO bonus_progress (user_id, current_stars, milestone_target, times_completed, created_at, updated_at)
SELECT
  user_id,
  -- Calculate current stars balance from transactions
  LEAST(
    GREATEST(
      SUM(
        CASE
          WHEN transaction_type IN ('earn', 'bonus') THEN amount
          WHEN transaction_type = 'spend' THEN -ABS(amount)
          ELSE 0
        END
      ) % 1500,  -- Modulo 1500 to get current progress in current cycle
      0
    ),
    1500
  ) as current_stars,
  1500 as milestone_target,
  -- Calculate how many milestones they've completed
  GREATEST(
    FLOOR(
      SUM(
        CASE
          WHEN transaction_type IN ('earn', 'bonus') THEN amount
          WHEN transaction_type = 'spend' THEN -ABS(amount)
          ELSE 0
        END
      ) / 1500.0
    )::integer,
    0
  ) as times_completed,
  now() as created_at,
  now() as updated_at
FROM stars_transactions
WHERE transaction_type IS NOT NULL
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET
  current_stars = EXCLUDED.current_stars,
  times_completed = EXCLUDED.times_completed,
  updated_at = now();
