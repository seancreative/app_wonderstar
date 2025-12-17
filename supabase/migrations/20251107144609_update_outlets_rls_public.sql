/*
  # Update Outlets RLS for Public Access

  1. Changes
    - Drop existing restrictive SELECT policy
    - Add new policy allowing public (anon + authenticated) to view active outlets
  
  2. Security
    - Maintains RLS enabled
    - Only allows viewing active outlets
    - No write permissions for public users
*/

DROP POLICY IF EXISTS "Anyone can view active outlets" ON outlets;

CREATE POLICY "Public can view active outlets"
  ON outlets
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
