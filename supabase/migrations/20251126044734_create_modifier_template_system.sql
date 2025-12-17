/*
  # Create Modifier Template System

  1. New Tables
    - `modifier_templates`
      - `id` (uuid, primary key)
      - `name` (text) - Template name
      - `description` (text) - Template description
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `modifier_template_groups`
      - `id` (uuid, primary key)
      - `template_id` (uuid, foreign key to modifier_templates)
      - `modifier_group_id` (uuid, foreign key to modifier_groups)
      - `is_required` (boolean) - Whether this group is required
      - `sort_order` (integer) - Display order
      - `created_at` (timestamptz)

  2. Security
    - Disable RLS on both tables for development
*/

-- Create modifier_templates table
CREATE TABLE IF NOT EXISTS modifier_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create modifier_template_groups junction table
CREATE TABLE IF NOT EXISTS modifier_template_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES modifier_templates(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, modifier_group_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_modifier_template_groups_template_id
  ON modifier_template_groups(template_id);
CREATE INDEX IF NOT EXISTS idx_modifier_template_groups_modifier_group_id
  ON modifier_template_groups(modifier_group_id);
CREATE INDEX IF NOT EXISTS idx_modifier_template_groups_sort_order
  ON modifier_template_groups(template_id, sort_order);

-- Disable RLS for development
ALTER TABLE modifier_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_template_groups DISABLE ROW LEVEL SECURITY;

-- Add updated_at trigger for modifier_templates
CREATE OR REPLACE FUNCTION update_modifier_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_modifier_templates_updated_at
  BEFORE UPDATE ON modifier_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_modifier_templates_updated_at();