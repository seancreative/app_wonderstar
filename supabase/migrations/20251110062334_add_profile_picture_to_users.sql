/*
  # Add Profile Picture Support to Users

  1. Changes
    - Add `profile_picture_url` column to users table for storing profile photo URLs
    
  2. Notes
    - Profile pictures will be stored in Supabase Storage
    - Used for Face-ID entry, safety and emergency purposes
    - File size limit: 1MB
    - Supported formats: JPEG, PNG, WebP
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'profile_picture_url'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_picture_url text;
  END IF;
END $$;
