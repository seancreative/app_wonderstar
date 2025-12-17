/*
  # Add Multiple Images Support to Workshops

  1. Changes
    - Add workshop_images jsonb column to workshops table
    - Stores array of image URLs (up to 5)
    - Allows workshop image galleries similar to edu_workshops

  2. Purpose
    - Support multiple images per workshop
    - Enable image galleries for better workshop presentation
*/

-- Add workshop_images column
ALTER TABLE workshops 
ADD COLUMN IF NOT EXISTS workshop_images jsonb DEFAULT '[]'::jsonb;

-- Update existing workshops to have empty arrays for images
UPDATE workshops 
SET workshop_images = '[]'::jsonb 
WHERE workshop_images IS NULL;

COMMENT ON COLUMN workshops.workshop_images IS 'Array of image URLs for workshop gallery (max 5 images)';
