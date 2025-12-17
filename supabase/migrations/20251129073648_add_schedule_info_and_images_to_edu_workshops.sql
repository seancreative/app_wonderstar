/*
  # Add Schedule Info and Multiple Images to EDU Workshops

  1. Changes
    - Add schedule_info text field for flexible date/time information
    - Add workshop_images jsonb field for multiple image URLs (up to 5)
    
  2. Purpose
    - Allow admins to enter custom schedule text
    - Support image galleries with swipeable interface
*/

-- Add schedule_info column
ALTER TABLE edu_workshops 
ADD COLUMN IF NOT EXISTS schedule_info text;

-- Add workshop_images column for multiple images
ALTER TABLE edu_workshops 
ADD COLUMN IF NOT EXISTS workshop_images jsonb DEFAULT '[]'::jsonb;

-- Update existing workshops to have empty arrays for images
UPDATE edu_workshops 
SET workshop_images = '[]'::jsonb 
WHERE workshop_images IS NULL;
