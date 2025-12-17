/*
  # Update Gacha Functions to Use Transaction-Based Stars Balance

  1. Changes to Functions
    - `check_gacha_spin_eligibility()` - Now calculates balance from transactions
    - `process_gacha_spin()` - Removes total_stars update, uses transactions only

  2. Why This Change
    - Eliminates dependency on deprecated `total_stars` column
    - Uses single source of truth: `stars_transactions` table
    - Prevents balance sync issues
    - More accurate and reliable

  3. How It Works
    - Balance calculated using `get_user_stars_balance()` helper function
    - Only inserts into `stars_transactions` (no user table update)
    - Balance is always accurate because it's calculated from transactions

  4. Breaking Changes
    - None - functions maintain same interface
    - Behavior is identical from user perspective
    - Only internal implementation changes

  5. Migration Safety
    - Functions dropped and recreated for clean migration
    - Search path set explicitly for security
    - Transaction-based calculation tested and verified
*/

-- Drop existing functions first
DROP FUNCTION IF EXISTS check_gacha_spin_eligibility(uuid);
DROP FUNCTION IF EXISTS process_gacha_spin(uuid, text, bigint, numeric, text);

-- Function to check if user can spin gacha
CREATE FUNCTION check_gacha_spin_eligibility(p_user_id uuid)
RETURNS TABLE(
  can_spin boolean,
  stars_cost integer,
  is_free boolean,
  current_stars integer,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_stars integer;
  v_free_spins integer;
  v_stats_exists boolean;
BEGIN
  -- Calculate user's current star balance from transactions
  v_user_stars := get_user_stars_balance(p_user_id);
  
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN QUERY SELECT false, 50, false, 0, 'User not found'::text;
    RETURN;
  END IF;

  -- Check if user has gacha stats record
  SELECT EXISTS(SELECT 1 FROM user_gacha_stats WHERE user_id = p_user_id) INTO v_stats_exists;
  
  -- If no stats exist, initialize with 1 free spin
  IF NOT v_stats_exists THEN
    PERFORM initialize_user_gacha_stats(p_user_id);
    v_free_spins := 1;
  ELSE
    SELECT free_spins_remaining INTO v_free_spins
    FROM user_gacha_stats
    WHERE user_id = p_user_id;
  END IF;

  -- Check eligibility (changed to 50 stars)
  IF v_free_spins > 0 THEN
    -- User has free spin available
    RETURN QUERY SELECT true, 0, true, v_user_stars, 'Free spin available'::text;
  ELSIF v_user_stars >= 50 THEN
    -- User can afford paid spin (50 stars)
    RETURN QUERY SELECT true, 50, false, v_user_stars, 'Sufficient stars for spin'::text;
  ELSE
    -- User cannot spin
    RETURN QUERY SELECT false, 50, false, v_user_stars, 
      format('Insufficient stars. You have %s stars but need 50', v_user_stars)::text;
  END IF;
END;
$$;

COMMENT ON FUNCTION check_gacha_spin_eligibility(uuid) IS
'Checks if user can spin gacha. 
Now calculates balance from transactions using get_user_stars_balance().
Returns eligibility status, cost, and current balance.';

-- Function to process gacha spin transaction
CREATE FUNCTION process_gacha_spin(
  p_user_id uuid,
  p_username text,
  p_prize_line_id bigint,
  p_reward_amount numeric,
  p_reward_label text
)
RETURNS TABLE(
  success boolean,
  message text,
  stars_spent integer,
  new_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_stars_before integer;
  v_user_stars_after integer;
  v_free_spins integer;
  v_was_free_spin boolean := false;
BEGIN
  -- Calculate current stars balance from transactions
  v_user_stars_before := get_user_stars_balance(p_user_id);
  
  -- Get free spins remaining
  SELECT COALESCE(free_spins_remaining, 0) INTO v_free_spins
  FROM user_gacha_stats
  WHERE user_id = p_user_id;

  -- Determine if this is a free spin
  IF v_free_spins > 0 THEN
    v_was_free_spin := true;
    v_user_stars_after := v_user_stars_before; -- No change for free spin
    
    -- Decrement free spin count
    UPDATE user_gacha_stats
    SET 
      free_spins_remaining = free_spins_remaining - 1,
      total_spins = total_spins + 1,
      total_rewards_earned = total_rewards_earned + p_reward_amount,
      first_spin_at = COALESCE(first_spin_at, now()),
      last_spin_at = now(),
      updated_at = now()
    WHERE user_id = p_user_id;

  ELSE
    -- Paid spin - check if user has enough stars
    IF v_user_stars_before < 50 THEN
      RETURN QUERY SELECT 
        false, 
        format('Insufficient stars. You have %s stars but need 50', v_user_stars_before)::text,
        0,
        v_user_stars_before;
      RETURN;
    END IF;
    
    -- Deduct stars by creating transaction (changed to 50 stars)
    v_user_stars_after := v_user_stars_before - 50;
    
    -- Log stars transaction (this is the ONLY balance update needed)
    INSERT INTO stars_transactions (
      user_id,
      amount,
      transaction_type,
      source,
      description,
      created_at
    ) VALUES (
      p_user_id,
      -50,
      'spend',
      'egg_gacha',
      'Egg Gacha Spin',
      now()
    );

    -- Update gacha stats
    UPDATE user_gacha_stats
    SET 
      total_spins = total_spins + 1,
      total_stars_spent = total_stars_spent + 50,
      total_rewards_earned = total_rewards_earned + p_reward_amount,
      first_spin_at = COALESCE(first_spin_at, now()),
      last_spin_at = now(),
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  -- Log spin history
  INSERT INTO gacha_spin_history (
    user_id,
    username,
    prize_line_id,
    stars_cost,
    was_free_spin,
    reward_amount,
    reward_label,
    spun_at
  ) VALUES (
    p_user_id,
    p_username,
    p_prize_line_id,
    CASE WHEN v_was_free_spin THEN 0 ELSE 50 END,
    v_was_free_spin,
    p_reward_amount,
    p_reward_label,
    now()
  );

  -- Return success
  RETURN QUERY SELECT 
    true,
    'Spin processed successfully'::text,
    CASE WHEN v_was_free_spin THEN 0 ELSE 50 END,
    v_user_stars_after;
END;
$$;

COMMENT ON FUNCTION process_gacha_spin(uuid, text, bigint, numeric, text) IS
'Processes gacha spin transaction.
Now only inserts into stars_transactions table (no user table update).
Balance is calculated from transactions for accuracy.
Handles both free and paid spins.';
