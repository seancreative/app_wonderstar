/*
  # Clean up duplicate storage policies
  
  Removes old policies from the first migration attempt that used auth
*/

-- Remove old policies that required authentication
DROP POLICY IF EXISTS "Allow authenticated users to upload profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own profile photos" ON storage.objects;