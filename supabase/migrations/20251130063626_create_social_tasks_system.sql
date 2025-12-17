/*
  # Create Social Tasks System for Share & Gacha Feature

  1. New Tables
    - `social_tasks`
      - Stores available social media tasks (Google Reviews, Facebook, Instagram, TikTok)
      - Fields: platform_name, task_type, task_description, link_url, icon_emoji, reward_spins
      - Tracks display order and active status

    - `user_social_tasks_completed`
      - Tracks which tasks each user has completed
      - Prevents duplicate completions with unique constraint
      - Records completion timestamp for analytics

  2. Functions
    - `complete_social_task` - Awards spins when user completes a task
      - Validates task not already completed
      - Grants reward spins using existing grant_gacha_freespins function
      - Checks for all-tasks-complete bonus
      - Logs activity in timeline

    - `get_social_task_analytics` - Returns completion statistics
      - Completion counts per task
      - Completion rates
      - User engagement metrics

  3. Initial Data
    - 5 social tasks pre-populated:
      - Google Review Melaka (1 spin)
      - Google Review Terengganu (1 spin)
      - Facebook Review (1 spin)
      - Instagram Follow (1 spin)
      - TikTok Follow (1 spin)
    - Bonus spin awarded automatically when all 5 completed

  4. Security
    - RLS enabled on both tables
    - Users can read all social tasks
    - Users can only read/insert their own completion records

  5. Analytics
    - Tracks completion timestamps
    - Enables marketing insights on task popularity
    - Monitors user engagement patterns
*/

-- Create social_tasks table
CREATE TABLE IF NOT EXISTS social_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL,
  task_type text NOT NULL,
  task_description text NOT NULL,
  link_url text NOT NULL,
  icon_emoji text NOT NULL,
  reward_spins integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  display_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_social_tasks_completed table
CREATE TABLE IF NOT EXISTS user_social_tasks_completed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  social_task_id uuid NOT NULL REFERENCES social_tasks(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, social_task_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_social_tasks_user_id ON user_social_tasks_completed(user_id);
CREATE INDEX IF NOT EXISTS idx_user_social_tasks_completed_at ON user_social_tasks_completed(completed_at);
CREATE INDEX IF NOT EXISTS idx_social_tasks_active ON social_tasks(is_active, display_order);

-- Enable RLS
ALTER TABLE social_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_social_tasks_completed ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_tasks (all users can read active tasks)
CREATE POLICY "Anyone can view active social tasks"
  ON social_tasks FOR SELECT
  USING (is_active = true);

-- RLS Policies for user_social_tasks_completed
CREATE POLICY "Users can view own completed tasks"
  ON user_social_tasks_completed FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own task completions"
  ON user_social_tasks_completed FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Function to complete a social task and award spins
CREATE OR REPLACE FUNCTION complete_social_task(
  p_user_id uuid,
  p_social_task_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_task_record social_tasks;
  v_already_completed boolean;
  v_total_completed integer;
  v_bonus_awarded boolean := false;
  v_total_spins_awarded integer := 0;
BEGIN
  -- Check if task exists and is active
  SELECT * INTO v_task_record
  FROM social_tasks
  WHERE id = p_social_task_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task not found or inactive'
    );
  END IF;

  -- Check if already completed
  SELECT EXISTS(
    SELECT 1 FROM user_social_tasks_completed
    WHERE user_id = p_user_id AND social_task_id = p_social_task_id
  ) INTO v_already_completed;

  IF v_already_completed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task already completed'
    );
  END IF;

  -- Insert completion record
  INSERT INTO user_social_tasks_completed (user_id, social_task_id)
  VALUES (p_user_id, p_social_task_id);

  -- Award spins for this task
  PERFORM grant_gacha_freespins(
    p_user_id,
    v_task_record.reward_spins,
    format('Social Task: %s', v_task_record.platform_name)
  );

  v_total_spins_awarded := v_task_record.reward_spins;

  -- Check if all tasks are completed
  SELECT COUNT(*) INTO v_total_completed
  FROM user_social_tasks_completed
  WHERE user_id = p_user_id;

  -- Award bonus spin if all 5 tasks completed
  IF v_total_completed = 5 THEN
    PERFORM grant_gacha_freespins(
      p_user_id,
      1,
      'Social Tasks Bonus: All Tasks Completed!'
    );
    v_bonus_awarded := true;
    v_total_spins_awarded := v_total_spins_awarded + 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'spins_awarded', v_total_spins_awarded,
    'bonus_awarded', v_bonus_awarded,
    'total_completed', v_total_completed,
    'platform_name', v_task_record.platform_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get social task analytics
CREATE OR REPLACE FUNCTION get_social_task_analytics()
RETURNS TABLE(
  task_id uuid,
  platform_name text,
  task_description text,
  total_completions bigint,
  completion_rate numeric
) AS $$
DECLARE
  v_total_users bigint;
BEGIN
  -- Get total number of users
  SELECT COUNT(*) INTO v_total_users FROM users;

  RETURN QUERY
  SELECT
    st.id,
    st.platform_name,
    st.task_description,
    COUNT(ustc.id) as total_completions,
    CASE
      WHEN v_total_users > 0 THEN
        ROUND((COUNT(ustc.id)::numeric / v_total_users::numeric) * 100, 2)
      ELSE 0
    END as completion_rate
  FROM social_tasks st
  LEFT JOIN user_social_tasks_completed ustc ON st.id = ustc.social_task_id
  WHERE st.is_active = true
  GROUP BY st.id, st.platform_name, st.task_description, st.display_order
  ORDER BY st.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert initial social tasks
INSERT INTO social_tasks (platform_name, task_type, task_description, link_url, icon_emoji, reward_spins, display_order)
VALUES
  ('Google Melaka', 'review', 'Review Wonderpark Melaka', 'https://g.page/r/CcX8rXYFOguVEBM/review', '⭐', 1, 1),
  ('Google Terengganu', 'review', 'Review Wonderpark Go KT', 'https://g.page/r/CWLXiw4SF49GEBM/review', '⭐', 1, 2),
  ('Facebook', 'review', 'Like & Review on Facebook', 'https://www.facebook.com/wonderpark.my/reviews', '👍', 1, 3),
  ('Instagram', 'follow', 'Like & Follow Instagram', 'https://www.instagram.com/wonderparkmy', '📷', 1, 4),
  ('TikTok', 'follow', 'Like & Follow TikTok', 'https://www.tiktok.com/@wonderparkmalaysia', '🎵', 1, 5)
ON CONFLICT DO NOTHING;
