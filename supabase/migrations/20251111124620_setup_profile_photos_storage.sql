/*
  # Setup Storage Bucket for Profile Photos
  
  1. Storage Setup
    - Creates 'profile-photos' bucket with public access
    - Allows users to upload, update, and delete their own profile photos
  
  2. Security
    - Public read access for all profile photos
    - Users can only upload/update/delete their own photos (authenticated)
    - File naming convention: {user_id}-{timestamp}.{ext}
*/

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;

-- Allow public read access to all profile photos
CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

-- Allow authenticated users to upload their own profile photos
CREATE POLICY "Users can upload own profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND name LIKE auth.uid()::text || '-%'
);

-- Allow authenticated users to update their own profile photos
CREATE POLICY "Users can update own profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND name LIKE auth.uid()::text || '-%'
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND name LIKE auth.uid()::text || '-%'
);

-- Allow authenticated users to delete their own profile photos
CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND name LIKE auth.uid()::text || '-%'
);