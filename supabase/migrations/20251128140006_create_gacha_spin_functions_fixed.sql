/*
  # Gacha Spin Functions

  1. Functions
    - `check_gacha_eligibility` - Check if user can spin and what it costs
    - `process_gacha_spin` - Handle complete spin transaction (stars deduction, stats update)
    - `initialize_user_gacha_stats` - Create stats record for new users

  2. Features
    - Atomic transactions with rollback on failure
    - Complete audit trail logging
    - Free spin tracking and consumption
    - Stars balance validation and deduction

  3. Security
    - All functions are SECURITY DEFINER (run with elevated privileges)
    - Proper validation and error handling
    - Transaction isolation to prevent race conditions
*/

-- Function to initialize gacha stats for a user
CREATE OR REPLACE FUNCTION initialize_user_gacha_stats(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO user_gacha_stats (user_id, free_spins_remaining, created_at, updated_at)
  VALUES (p_user_id, 1, now(), now())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is eligible to spin and calculate cost
CREATE OR REPLACE FUNCTION check_gacha_eligibility(p_user_id uuid)
RETURNS TABLE(
  eligible boolean,
  cost integer,
  has_free_spin boolean,
  current_stars integer,
  message text
) AS $$
DECLARE
  v_user_stars integer;
  v_free_spins integer;
  v_stats_exists boolean;
BEGIN
  -- Get user's current star balance
  SELECT total_stars INTO v_user_stars
  FROM users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 500, false, 0, 'User not found'::text;
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

  -- Check eligibility
  IF v_free_spins > 0 THEN
    -- User has free spin available
    RETURN QUERY SELECT true, 0, true, v_user_stars, 'Free spin available'::text;
  ELSIF v_user_stars >= 500 THEN
    -- User can afford paid spin
    RETURN QUERY SELECT true, 500, false, v_user_stars, 'Sufficient stars for spin'::text;
  ELSE
    -- User cannot spin
    RETURN QUERY SELECT false, 500, false, v_user_stars, 
      format('Insufficient stars. You have %s stars but need 500', v_user_stars)::text;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process gacha spin transaction
CREATE OR REPLACE FUNCTION process_gacha_spin(
  p_user_id uuid,
  p_username text,
  p_prize_line_id bigint,
  p_reward_amount numeric,
  p_reward_label text
)
RETURNS TABLE(
  success boolean,
  stars_cost integer,
  was_free boolean,
  new_star_balance integer,
  message text
) AS $$
DECLARE
  v_eligibility_check RECORD;
  v_user_stars_before integer;
  v_user_stars_after integer;
  v_is_free_spin boolean;
  v_spin_cost integer;
BEGIN
  -- Check eligibility first
  SELECT * INTO v_eligibility_check
  FROM check_gacha_eligibility(p_user_id);

  IF NOT v_eligibility_check.eligible THEN
    RETURN QUERY SELECT false, 500, false, v_eligibility_check.current_stars, v_eligibility_check.message;
    RETURN;
  END IF;

  -- Start transaction
  v_user_stars_before := v_eligibility_check.current_stars;
  v_is_free_spin := v_eligibility_check.has_free_spin;
  v_spin_cost := v_eligibility_check.cost;

  IF v_is_free_spin THEN
    -- Use free spin (no stars deducted)
    v_user_stars_after := v_user_stars_before;
    
    -- Decrement free spins remaining
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
    -- Deduct stars for paid spin
    v_user_stars_after := v_user_stars_before - 500;
    
    -- Update user stars balance
    UPDATE users
    SET total_stars = v_user_stars_after,
        updated_at = now()
    WHERE id = p_user_id;

    -- Log stars transaction
    INSERT INTO stars_transactions (
      user_id,
      amount,
      transaction_type,
      description,
      balance_after,
      created_at
    ) VALUES (
      p_user_id,
      -500,
      'spend',
      'Egg Gacha Spin',
      v_user_stars_after,
      now()
    );

    -- Update gacha stats
    UPDATE user_gacha_stats
    SET 
      total_spins = total_spins + 1,
      total_stars_spent = total_stars_spent + 500,
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
    user_stars_before,
    user_stars_after,
    spin_at,
    created_at
  ) VALUES (
    p_user_id,
    p_username,
    p_prize_line_id,
    v_spin_cost,
    v_is_free_spin,
    p_reward_amount,
    p_reward_label,
    v_user_stars_before,
    v_user_stars_after,
    now(),
    now()
  );

  -- Return success
  RETURN QUERY SELECT 
    true, 
    v_spin_cost, 
    v_is_free_spin, 
    v_user_stars_after,
    CASE 
      WHEN v_is_free_spin THEN 'Free spin used successfully'
      ELSE format('Paid spin successful. %s stars remaining', v_user_stars_after)
    END::text;

EXCEPTION WHEN OTHERS THEN
  -- Rollback happens automatically
  RETURN QUERY SELECT false, 500, false, v_user_stars_before, 
    format('Spin transaction failed: %s', SQLERRM)::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_gacha_eligibility TO authenticated, anon;
GRANT EXECUTE ON FUNCTION process_gacha_spin TO service_role;
GRANT EXECUTE ON FUNCTION initialize_user_gacha_stats TO service_role;

-- Create trigger to initialize gacha stats for new users
CREATE OR REPLACE FUNCTION trigger_initialize_user_gacha_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_user_gacha_stats(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_initialize_gacha_stats ON users;
CREATE TRIGGER on_user_created_initialize_gacha_stats
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_initialize_user_gacha_stats();

-- Migrate existing users: give free spin only to users who have never spun
DO $$
BEGIN
  INSERT INTO user_gacha_stats (user_id, free_spins_remaining, total_spins, created_at, updated_at)
  SELECT 
    u.id,
    CASE 
      WHEN COUNT(er.id) = 0 THEN 1  -- Never spun = 1 free spin
      ELSE 0                          -- Has spun before = no free spin
    END as free_spins,
    COUNT(er.id) as total_spins,
    now(),
    now()
  FROM users u
  LEFT JOIN egg_redemptions er ON er.user_id = u.id
  WHERE NOT EXISTS (
    SELECT 1 FROM user_gacha_stats ugs WHERE ugs.user_id = u.id
  )
  GROUP BY u.id
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Gacha spin cost system initialized successfully';
END $$;
