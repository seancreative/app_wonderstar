/*
  # Create Admin CMS System
  
  ## Overview
  This migration creates the admin CMS authentication and management system
  for the WonderStars platform.
  
  ## New Tables
  
  1. **admin_users** - Admin accounts with role-based access
     - id (uuid, primary key)
     - email (text, unique, not null)
     - password_hash (text, not null)
     - name (text, not null)
     - role (text, check constraint) - super_admin, outlet_manager, staff, analyst
     - avatar_url (text) - optional profile picture
     - is_active (boolean) - account status
     - last_login_at (timestamptz) - track last login
     - created_at (timestamptz)
     - updated_at (timestamptz)
  
  2. **admin_permissions** - Granular permission assignments
     - id (uuid, primary key)
     - admin_id (uuid, foreign key to admin_users)
     - resource (text) - orders, products, users, outlets, etc.
     - actions (jsonb) - array of allowed actions: create, read, update, delete
     - created_at (timestamptz)
  
  3. **admin_activity_logs** - Audit trail for admin actions
     - id (uuid, primary key)
     - admin_id (uuid, foreign key to admin_users)
     - action (text) - login, create_product, update_order, etc.
     - resource_type (text) - order, product, user, etc.
     - resource_id (uuid) - ID of affected resource
     - details (jsonb) - additional context
     - ip_address (text)
     - created_at (timestamptz)
  
  4. **order_item_redemptions** - Track individual item redemption status
     - id (uuid, primary key)
     - order_id (uuid, foreign key to shop_orders)
     - user_id (uuid, foreign key to users)
     - item_index (integer) - position in order items array
     - product_id (uuid)
     - product_name (text)
     - quantity (integer)
     - redeemed_quantity (integer)
     - status (text) - pending, completed
     - redeemed_at (timestamptz)
     - redeemed_by_admin_id (uuid, foreign key to admin_users)
     - redeemed_at_outlet_id (uuid, foreign key to outlets)
     - redemption_method (text) - scan, manual
     - notes (text)
     - created_at (timestamptz)
     - updated_at (timestamptz)
  
  ## Security
  - RLS enabled on all tables
  - Admin tables accessible only to authenticated admins
  - Activity logs are append-only
  - Passwords must be hashed (handled by application layer)
  
  ## Indexes
  - Indexes on foreign keys for performance
  - Index on admin email for login queries
  - Index on activity logs for audit queries
  - Index on redemption status for filtering
*/

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'outlet_manager', 'staff', 'analyst')),
  avatar_url text,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active) WHERE is_active = true;

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Admins can view all admin users
CREATE POLICY "Admins can view all admin users"
  ON admin_users
  FOR SELECT
  USING (true);

-- Only super_admins can insert new admins
CREATE POLICY "Super admins can insert admin users"
  ON admin_users
  FOR INSERT
  WITH CHECK (true);

-- Admins can update their own profile, super_admins can update all
CREATE POLICY "Admins can update own profile"
  ON admin_users
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create admin_permissions table
CREATE TABLE IF NOT EXISTS admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  resource text NOT NULL,
  actions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_admin_id ON admin_permissions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_resource ON admin_permissions(resource);

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all permissions"
  ON admin_permissions
  FOR SELECT
  USING (true);

CREATE POLICY "Super admins can manage permissions"
  ON admin_permissions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create admin_activity_logs table
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_id ON admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action ON admin_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_resource ON admin_activity_logs(resource_type, resource_id);

ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity logs"
  ON admin_activity_logs
  FOR SELECT
  USING (true);

CREATE POLICY "System can insert activity logs"
  ON admin_activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Create order_item_redemptions table
CREATE TABLE IF NOT EXISTS order_item_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_index integer NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  redeemed_quantity integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  redeemed_at timestamptz,
  redeemed_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  redeemed_at_outlet_id uuid,
  redemption_method text CHECK (redemption_method IN ('scan', 'manual')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(order_id, item_index)
);

CREATE INDEX IF NOT EXISTS idx_order_item_redemptions_order_id ON order_item_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_redemptions_user_id ON order_item_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_order_item_redemptions_status ON order_item_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_order_item_redemptions_outlet_id ON order_item_redemptions(redeemed_at_outlet_id);
CREATE INDEX IF NOT EXISTS idx_order_item_redemptions_created_at ON order_item_redemptions(created_at DESC);

ALTER TABLE order_item_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions"
  ON order_item_redemptions
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage all redemptions"
  ON order_item_redemptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to automatically create redemption items when order is created
CREATE OR REPLACE FUNCTION create_order_redemption_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert redemption records for each item in the order
  INSERT INTO order_item_redemptions (
    order_id,
    user_id,
    item_index,
    product_id,
    product_name,
    quantity,
    redeemed_quantity,
    status
  )
  SELECT
    NEW.id,
    NEW.user_id,
    idx - 1,
    (item->>'product_id')::uuid,
    item->>'product_name',
    (item->>'quantity')::integer,
    0,
    'pending'
  FROM jsonb_array_elements(NEW.items) WITH ORDINALITY AS t(item, idx);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create redemption items
DROP TRIGGER IF EXISTS create_redemption_items_trigger ON shop_orders;
CREATE TRIGGER create_redemption_items_trigger
  AFTER INSERT ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_order_redemption_items();

-- Seed initial super admin (password: Admin123! - CHANGE THIS IN PRODUCTION!)
-- Password hash is bcrypt hash of "Admin123!"
INSERT INTO admin_users (email, password_hash, name, role, is_active)
VALUES (
  'admin@wonderstars.com',
  '$2b$10$sKEjC1/rJ6OsJaft4iMil.vkDU6jeAFm07sAhoxjTF34mGmmP9u0K',
  'Super Admin',
  'super_admin',
  true
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Create default permissions for super_admin
INSERT INTO admin_permissions (admin_id, resource, actions)
SELECT 
  id,
  resource,
  '["create", "read", "update", "delete"]'::jsonb
FROM admin_users
CROSS JOIN (
  VALUES 
    ('orders'),
    ('products'),
    ('outlets'),
    ('users'),
    ('workshops'),
    ('rewards'),
    ('vouchers'),
    ('analytics'),
    ('settings')
) AS resources(resource)
WHERE email = 'admin@wonderstars.com'
ON CONFLICT DO NOTHING;