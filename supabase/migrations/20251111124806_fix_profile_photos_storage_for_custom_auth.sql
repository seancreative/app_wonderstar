/*
  # Fix Profile Photos Storage for Custom Auth System
  
  1. Issue
    - App uses custom authentication (localStorage), not Supabase Auth
    - Previous storage policies required auth.uid() which doesn't exist
  
  2. Solution
    - Allow public access for upload/update/delete during development
    - Can be secured later with service role keys or custom validation
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;

-- Allow public read access
CREATE POLICY "Public read profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

-- Allow anyone to upload (app handles auth via localStorage)
CREATE POLICY "Anyone can upload profile photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-photos');

-- Allow anyone to update (app handles auth via localStorage)
CREATE POLICY "Anyone can update profile photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-photos')
WITH CHECK (bucket_id = 'profile-photos');

-- Allow anyone to delete (app handles auth via localStorage)
CREATE POLICY "Anyone can delete profile photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-photos');