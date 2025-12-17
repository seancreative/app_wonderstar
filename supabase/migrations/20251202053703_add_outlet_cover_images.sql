/*
  # Add Outlet Cover Images

  ## Changes
  1. Add cover_image_url column to outlets table
  2. Create outlet-covers storage bucket
  3. Set up RLS policies for public read and authenticated upload/update/delete

  ## Storage
  - Bucket: outlet-covers
  - Public: true (anyone can view)
  - Upload: authenticated users (CMS admins)
*/

-- =====================================================
-- ADD COVER_IMAGE_URL COLUMN TO OUTLETS
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outlets' AND column_name = 'cover_image_url'
  ) THEN
    ALTER TABLE outlets ADD COLUMN cover_image_url text;
    RAISE NOTICE 'Added cover_image_url column to outlets table';
  END IF;
END $$;

-- =====================================================
-- CREATE STORAGE BUCKET FOR OUTLET COVERS
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('outlet-covers', 'outlet-covers', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE POLICIES FOR OUTLET COVERS
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view outlet covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload outlet covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update outlet covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete outlet covers" ON storage.objects;

-- Public read access
CREATE POLICY "Public can view outlet covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'outlet-covers');

-- Authenticated users can upload
CREATE POLICY "Authenticated can upload outlet covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'outlet-covers');

-- Authenticated users can update
CREATE POLICY "Authenticated can update outlet covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'outlet-covers');

-- Authenticated users can delete
CREATE POLICY "Authenticated can delete outlet covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'outlet-covers');

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Outlet Cover Images Setup Complete';
  RAISE NOTICE '- cover_image_url column added to outlets';
  RAISE NOTICE '- outlet-covers storage bucket created';
  RAISE NOTICE '- RLS policies configured';
  RAISE NOTICE '========================================';
END $$;