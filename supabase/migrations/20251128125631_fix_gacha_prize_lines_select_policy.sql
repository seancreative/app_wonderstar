/*
  # Fix Gacha Prize Lines SELECT Policy

  1. Updates
    - Add SELECT policy for egg_prize_lines to allow reading
    - Ensure CMS can view all generated prize lines

  2. Security
    - Allow public read access for transparency (prizes are public info)
    - Maintain write restrictions for security
*/

-- Drop existing SELECT policy if exists
DROP POLICY IF EXISTS egg_prize_lines_select ON egg_prize_lines;

-- Create new SELECT policy that allows everyone to read prize lines
CREATE POLICY egg_prize_lines_select
  ON egg_prize_lines FOR SELECT
  USING (true);
