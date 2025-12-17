/*
  # Add Activity Timeline Logging to Social Task Completion

  1. Updates
    - Modify `complete_social_task` function to log activities
    - Log each task completion with timestamp
    - Log bonus spin award when all tasks completed
    - Visible in CMS Customer Detail activity timeline

  2. Activity Types
    - `social_task_completed` - When user completes a social task
    - `social_bonus_awarded` - When user completes all tasks and gets bonus

  3. Activity Categories
    - Category: `social`
    - Icon: `Share2` for task completion, `Gift` for bonus
*/

-- Update complete_social_task function to include activity logging
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

  -- Log activity for task completion
  INSERT INTO user_activity_timeline (
    user_id,
    activity_type,
    activity_category,
    title,
    description,
    icon,
    metadata
  ) VALUES (
    p_user_id,
    'social_task_completed',
    'social',
    format('Completed %s', v_task_record.platform_name),
    format('%s - Earned +%s free spin', v_task_record.task_description, v_task_record.reward_spins),
    'Share2',
    jsonb_build_object(
      'task_id', p_social_task_id,
      'platform_name', v_task_record.platform_name,
      'task_type', v_task_record.task_type,
      'spins_awarded', v_task_record.reward_spins
    )
  );

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

    -- Log activity for bonus award
    INSERT INTO user_activity_timeline (
      user_id,
      activity_type,
      activity_category,
      title,
      description,
      icon,
      metadata
    ) VALUES (
      p_user_id,
      'social_bonus_awarded',
      'social',
      'All Social Tasks Completed!',
      'Completed all 5 social tasks - Earned +1 bonus free spin',
      'Gift',
      jsonb_build_object(
        'total_tasks_completed', v_total_completed,
        'bonus_spins', 1,
        'total_spins_from_tasks', v_total_spins_awarded
      )
    );
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
