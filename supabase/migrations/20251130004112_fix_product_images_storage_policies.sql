/*
  # Fix Product Images Storage Policies

  This migration ensures that the product-images storage bucket has proper policies
  for uploading, reading, updating, and deleting images. These are needed for
  CMSEduWorkshops and other CMS pages to upload images.

  ## Changes
  1. Drop existing policies if they exist
  2. Create comprehensive storage policies for product-images bucket:
     - Allow anyone to upload (INSERT)
     - Allow anyone to read (SELECT)  
     - Allow anyone to update (UPDATE)
     - Allow anyone to delete (DELETE)
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete product images" ON storage.objects;

-- Create comprehensive policies for product-images bucket
CREATE POLICY "Anyone can upload product images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Anyone can update product images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anyone can delete product images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'product-images');
