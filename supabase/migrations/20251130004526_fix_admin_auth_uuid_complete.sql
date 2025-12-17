/*
  # Fix Admin Auth UUID - Complete

  Final fix to sync admin_users IDs with auth.users IDs.
  This enables RLS policies to work correctly.
*/

-- Update FK constraints with CASCADE
ALTER TABLE admin_activity_logs DROP CONSTRAINT IF EXISTS admin_activity_logs_admin_id_fkey;
ALTER TABLE admin_activity_logs ADD CONSTRAINT admin_activity_logs_admin_id_fkey 
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE admin_permissions DROP CONSTRAINT IF EXISTS admin_permissions_admin_id_fkey;
ALTER TABLE admin_permissions ADD CONSTRAINT admin_permissions_admin_id_fkey 
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE egg_gacha_configurations DROP CONSTRAINT IF EXISTS egg_gacha_configurations_created_by_admin_id_fkey;
ALTER TABLE egg_gacha_configurations ADD CONSTRAINT egg_gacha_configurations_created_by_admin_id_fkey 
  FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE egg_prize_lines DROP CONSTRAINT IF EXISTS egg_prize_lines_revoked_by_admin_id_fkey;
ALTER TABLE egg_prize_lines ADD CONSTRAINT egg_prize_lines_revoked_by_admin_id_fkey 
  FOREIGN KEY (revoked_by_admin_id) REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE egg_redemptions DROP CONSTRAINT IF EXISTS egg_redemptions_revoked_by_admin_id_fkey;
ALTER TABLE egg_redemptions ADD CONSTRAINT egg_redemptions_revoked_by_admin_id_fkey 
  FOREIGN KEY (revoked_by_admin_id) REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE order_item_redemptions DROP CONSTRAINT IF EXISTS order_item_redemptions_redeemed_by_admin_id_fkey;
ALTER TABLE order_item_redemptions ADD CONSTRAINT order_item_redemptions_redeemed_by_admin_id_fkey 
  FOREIGN KEY (redeemed_by_admin_id) REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE staff_passcodes DROP CONSTRAINT IF EXISTS staff_passcodes_created_by_admin_id_fkey;
ALTER TABLE staff_passcodes ADD CONSTRAINT staff_passcodes_created_by_admin_id_fkey 
  FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;
ALTER TABLE system_settings ADD CONSTRAINT system_settings_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Update admin ID - CASCADE automatically updates all child tables
UPDATE admin_users 
SET id = 'ffc1b689-c9fe-4df5-9a30-7296e8cc0ebd'::uuid
WHERE id = '7a4c9363-1ea7-4daf-8fc2-8ebe5477e13a'::uuid;

-- Create auth for manager
DO $$
DECLARE
  manager_id uuid := '702f601c-5ad6-462e-9995-ed69bc18c3a3'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'manager@wonderstars.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
    ) VALUES (
      manager_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'manager@wonderstars.com',
      crypt('ManagerPass123!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"],"is_admin":true}'::jsonb,
      '{"name":"Manager User"}'::jsonb,
      'authenticated', 'authenticated'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = manager_id AND provider = 'email') THEN
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider, 
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      manager_id::text,
      manager_id,
      jsonb_build_object('sub', manager_id::text, 'email', 'manager@wonderstars.com'),
      'email',
      NOW(), NOW(), NOW()
    );
  END IF;
END $$;
