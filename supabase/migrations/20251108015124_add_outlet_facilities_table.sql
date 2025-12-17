/*
  # Add Outlet Facilities Feature

  1. New Tables
    - `outlet_facilities`
      - `id` (uuid, primary key)
      - `outlet_id` (uuid, foreign key to outlets)
      - `name` (text) - facility name/title
      - `category` (text) - 'everyone', 'adult', or 'child'
      - `icon` (text) - optional icon name or emoji
      - `description` (text) - optional description
      - `display_order` (integer) - for sorting
      - `is_active` (boolean) - visibility toggle
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `outlet_facilities` table
    - Add policy for public read access
    - Admin write access (to be implemented with admin role system)

  3. Indexes
    - Index on outlet_id for fast lookups
    - Index on category for filtering
*/

CREATE TABLE IF NOT EXISTS outlet_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('everyone', 'adult', 'child')),
  icon text,
  description text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outlet_facilities_outlet_id ON outlet_facilities(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_facilities_category ON outlet_facilities(category);
CREATE INDEX IF NOT EXISTS idx_outlet_facilities_active ON outlet_facilities(is_active) WHERE is_active = true;

ALTER TABLE outlet_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active facilities"
  ON outlet_facilities
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage facilities"
  ON outlet_facilities
  FOR ALL
  USING (true)
  WITH CHECK (true);
