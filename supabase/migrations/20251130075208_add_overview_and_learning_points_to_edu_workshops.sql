/*
  # Add Overview and Learning Points to EduWorkshops

  ## Overview
  This migration adds two important fields to the edu_workshops table to make
  the workshop detail modal fully CMS-driven instead of relying on hardcoded content.

  ## Changes
  1. New Columns
    - `overview` (text, nullable) - Short summary displayed prominently in the workshop detail modal
    - `learning_points` (jsonb, default empty array) - Array of learning outcomes shown in "What You'll Learn" section

  ## Purpose
  These fields allow CMS admins to fully control the workshop content displayed to users:
  - Overview: Brief description shown at the top of the modal (separate from full description)
  - Learning Points: Numbered list of key learning outcomes and skills

  ## Notes
  - Both fields are nullable to support existing workshops
  - learning_points defaults to empty array for easier frontend handling
  - Existing workshops will need to be updated via CMS to populate these fields
*/

-- Add overview column for short summary text
ALTER TABLE edu_workshops
  ADD COLUMN IF NOT EXISTS overview TEXT DEFAULT NULL;

-- Add learning_points column as JSONB array for structured learning outcomes
ALTER TABLE edu_workshops
  ADD COLUMN IF NOT EXISTS learning_points JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN edu_workshops.overview IS 'Short summary text displayed prominently in workshop detail modal';
COMMENT ON COLUMN edu_workshops.learning_points IS 'Array of learning outcomes shown in "What You''ll Learn" section - stored as JSONB array of strings';
