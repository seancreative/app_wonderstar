/*
  # Enable RLS - Group A: Public/Catalog Tables (v2)

  ## Overview
  This migration enables Row Level Security on public catalog tables.
  Drops existing policies first to avoid conflicts.

  ## Tables Covered
  - outlets, shop_products, categories, subcategories
  - membership_tiers, rewards, badges, missions
  - workshops, vouchers, promo_banners, app_config
  - wallet_topup_packages, outlet_facilities, product_outlets
  - mystery_boxes, product_modifiers, modifier_options, modifier_templates

  ## Security Model
  - Public READ access - anyone can view active items
  - Authenticated WRITE access - only authenticated users can modify
*/

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

-- Drop all existing policies on Group A tables
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'outlets', 'shop_products', 'categories', 'subcategories',
        'membership_tiers', 'rewards', 'badges', 'missions',
        'workshops', 'vouchers', 'promo_banners', 'app_config',
        'wallet_topup_packages', 'product_modifiers', 'modifier_options',
        'modifier_templates', 'outlet_facilities', 'product_outlets', 'mystery_boxes'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- =====================================================
-- ENABLE RLS AND CREATE POLICIES
-- =====================================================

-- Outlets
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active outlets" ON outlets FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
CREATE POLICY "Auth can manage outlets" ON outlets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Shop Products
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active products" ON shop_products FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
CREATE POLICY "Auth can manage products" ON shop_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active categories" ON categories FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
CREATE POLICY "Auth can manage categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Subcategories
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subcategories') THEN
    ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "Public can view active subcategories" ON subcategories FOR SELECT USING (is_active = true OR auth.role() = ''authenticated'')';
    EXECUTE 'CREATE POLICY "Auth can manage subcategories" ON subcategories FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Membership Tiers
ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view tiers" ON membership_tiers FOR SELECT USING (true);
CREATE POLICY "Auth can manage tiers" ON membership_tiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rewards
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active rewards" ON rewards FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
CREATE POLICY "Auth can manage rewards" ON rewards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Badges
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view badges" ON badges FOR SELECT USING (true);
CREATE POLICY "Auth can manage badges" ON badges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Missions
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active missions" ON missions FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
CREATE POLICY "Auth can manage missions" ON missions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Workshops
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active workshops" ON workshops FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
CREATE POLICY "Auth can manage workshops" ON workshops FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Vouchers
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active vouchers" ON vouchers FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
CREATE POLICY "Auth can manage vouchers" ON vouchers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Promo Banners
ALTER TABLE promo_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active banners" ON promo_banners FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
CREATE POLICY "Auth can manage banners" ON promo_banners FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- App Config
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view config" ON app_config FOR SELECT USING (true);
CREATE POLICY "Auth can manage config" ON app_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Wallet Topup Packages
ALTER TABLE wallet_topup_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active packages" ON wallet_topup_packages FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
CREATE POLICY "Auth can manage packages" ON wallet_topup_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Outlet Facilities
ALTER TABLE outlet_facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view facilities" ON outlet_facilities FOR SELECT USING (true);
CREATE POLICY "Auth can manage facilities" ON outlet_facilities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Product Outlets
ALTER TABLE product_outlets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view product outlets" ON product_outlets FOR SELECT USING (true);
CREATE POLICY "Auth can manage product outlets" ON product_outlets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Mystery Boxes
ALTER TABLE mystery_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view mystery boxes" ON mystery_boxes FOR SELECT USING (true);
CREATE POLICY "Auth can manage mystery boxes" ON mystery_boxes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Product Modifiers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_modifiers') THEN
    ALTER TABLE product_modifiers ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "Public can view modifiers" ON product_modifiers FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "Auth can manage modifiers" ON product_modifiers FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Modifier Options
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modifier_options') THEN
    ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "Public can view modifier options" ON modifier_options FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "Auth can manage modifier options" ON modifier_options FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Modifier Templates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modifier_templates') THEN
    ALTER TABLE modifier_templates ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "Public can view templates" ON modifier_templates FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "Auth can manage templates" ON modifier_templates FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS ENABLED - GROUP A (PUBLIC TABLES)';
  RAISE NOTICE 'Security: Public SELECT, Auth ALL';
  RAISE NOTICE '========================================';
END $$;
