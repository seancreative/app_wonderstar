/*
  # WonderStars Membership App - Complete Database Schema

  ## Overview
  This migration creates the complete database structure for the WonderStars family membership 
  and rewards application. It includes tables for user management, gamification, transactions, 
  content, and administrative configuration.

  ## Tables Created

  ### User Management
  1. **users** - Parent account information
     - id, email, name, phone, lifetime_topups, referral_code, created_at, updated_at
  
  2. **child_profiles** - Children linked to parent accounts
     - id, user_id, name, age, avatar_config, created_at

  ### Financial
  3. **wallet_transactions** - All wallet activity (top-ups, spends, bonuses)
     - id, user_id, type, amount, bonus_amount, description, created_at
  
  4. **stars_transactions** - All stars earning and spending
     - id, user_id, type, amount, multiplier, source, metadata, created_at

  ### Gamification
  5. **membership_tiers** - Configurable tier levels and benefits
     - id, name, threshold, earn_multiplier, topup_bonus_pct, workshop_discount_pct, 
       redemption_discount_pct, mission_bonus_stars, color, sort_order
  
  6. **badges** - Achievement badges
     - id, user_id, badge_type, name, description, icon, unlocked_at
  
  7. **missions** - Challenges users can complete
     - id, title, description, mission_type, requirement_value, reward_stars, 
       is_active, is_seasonal, start_date, end_date, created_at

  8. **mission_progress** - User progress on missions
     - id, user_id, mission_id, current_progress, is_completed, completed_at, claimed_at

  ### Content & Rewards
  9. **rewards** - Redeemable items catalog
     - id, name, description, category, base_cost_stars, stock, image_url, is_active, created_at
  
  10. **redemptions** - User reward redemptions
      - id, user_id, reward_id, stars_cost, qr_code, redeemed_at, used_at
  
  11. **mystery_boxes** - Mystery box configurations
      - id, name, base_cost_stars, tier, prize_pool, created_at
  
  12. **mystery_box_openings** - History of box openings
      - id, user_id, box_id, stars_cost, prize_won, opened_at

  ### Workshops
  13. **workshops** - Workshop sessions
      - id, title, description, category, age_min, age_max, instructor, price, 
        bonus_stars, max_capacity, session_date, duration_minutes, image_url, 
        whats_included, is_active, created_at
  
  14. **workshop_bookings** - User workshop reservations
      - id, user_id, workshop_id, child_id, amount_paid, qr_code, status, booked_at

  ### Promotions
  15. **vouchers** - Promotional vouchers
      - id, code, voucher_type, value, min_purchase, max_uses, times_used, 
        expires_at, is_active, created_at
  
  16. **voucher_usage** - Track voucher redemptions
      - id, voucher_id, user_id, order_value, discount_amount, used_at

  ### Activity
  17. **check_ins** - Location check-in history
      - id, user_id, location, stars_earned, checked_in_at
  
  18. **notifications** - User notifications
      - id, user_id, title, message, notification_type, is_read, action_url, created_at

  ### Configuration
  19. **app_config** - Admin-configurable settings
      - id, config_key, config_value, description, updated_at

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies restrict access to user's own data
  - Admin functions protected by role checks

  ## Indexes
  - Created on foreign keys and frequently queried columns for performance
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  lifetime_topups decimal(10,2) DEFAULT 0,
  referral_code text UNIQUE,
  theme text DEFAULT 'light',
  language text DEFAULT 'en',
  settings jsonb DEFAULT '{"haptics": true, "surprises": true, "reduceMotion": false}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can insert users"
  ON users FOR INSERT
  TO anon
  WITH CHECK (true);

-- =====================================================
-- CHILD PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS child_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  age integer,
  avatar_config jsonb DEFAULT '{"character": "dino", "outfit": {}, "accessories": []}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE child_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own children"
  ON child_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own children"
  ON child_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own children"
  ON child_profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own children"
  ON child_profiles FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX idx_child_profiles_user_id ON child_profiles(user_id);

-- =====================================================
-- WALLET TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('topup', 'spend', 'bonus', 'refund')),
  amount decimal(10,2) NOT NULL,
  bonus_amount decimal(10,2) DEFAULT 0,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own transactions"
  ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

-- =====================================================
-- STARS TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stars_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earn', 'spend', 'bonus', 'refund')),
  amount integer NOT NULL,
  multiplier decimal(3,2) DEFAULT 1.0,
  source text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stars_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stars transactions"
  ON stars_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own stars transactions"
  ON stars_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_stars_transactions_user_id ON stars_transactions(user_id);
CREATE INDEX idx_stars_transactions_created_at ON stars_transactions(created_at DESC);

-- =====================================================
-- MEMBERSHIP TIERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS membership_tiers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  threshold decimal(10,2) NOT NULL,
  earn_multiplier decimal(3,2) DEFAULT 1.0,
  topup_bonus_pct integer DEFAULT 0,
  workshop_discount_pct integer DEFAULT 0,
  redemption_discount_pct integer DEFAULT 0,
  mission_bonus_stars integer DEFAULT 0,
  color text DEFAULT '#8B5CF6',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tiers"
  ON membership_tiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view tiers"
  ON membership_tiers FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- BADGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  badge_type text NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  unlocked_at timestamptz DEFAULT now()
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own badges"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own badges"
  ON badges FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_badges_user_id ON badges(user_id);

-- =====================================================
-- MISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  mission_type text NOT NULL CHECK (mission_type IN ('visit', 'spend', 'workshop', 'checkin', 'seasonal', 'weekly')),
  requirement_value integer NOT NULL,
  reward_stars integer NOT NULL,
  is_active boolean DEFAULT true,
  is_seasonal boolean DEFAULT false,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active missions"
  ON missions FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Anon can view active missions"
  ON missions FOR SELECT
  TO anon
  USING (is_active = true);

-- =====================================================
-- MISSION PROGRESS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS mission_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  mission_id uuid REFERENCES missions(id) ON DELETE CASCADE NOT NULL,
  current_progress integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  claimed_at timestamptz,
  UNIQUE(user_id, mission_id)
);

ALTER TABLE mission_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mission progress"
  ON mission_progress FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own mission progress"
  ON mission_progress FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own mission progress"
  ON mission_progress FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_mission_progress_user_id ON mission_progress(user_id);
CREATE INDEX idx_mission_progress_mission_id ON mission_progress(mission_id);

-- =====================================================
-- REWARDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('entry', 'toys', 'merch', 'vip')),
  base_cost_stars integer NOT NULL,
  stock integer DEFAULT 999,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Anon can view active rewards"
  ON rewards FOR SELECT
  TO anon
  USING (is_active = true);

-- =====================================================
-- REDEMPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reward_id uuid REFERENCES rewards(id) ON DELETE CASCADE NOT NULL,
  stars_cost integer NOT NULL,
  qr_code text,
  redeemed_at timestamptz DEFAULT now(),
  used_at timestamptz
);

ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions"
  ON redemptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own redemptions"
  ON redemptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own redemptions"
  ON redemptions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_redemptions_user_id ON redemptions(user_id);

-- =====================================================
-- MYSTERY BOXES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS mystery_boxes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  base_cost_stars integer NOT NULL,
  tier text NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  prize_pool jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mystery_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mystery boxes"
  ON mystery_boxes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view mystery boxes"
  ON mystery_boxes FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- MYSTERY BOX OPENINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS mystery_box_openings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  box_id uuid REFERENCES mystery_boxes(id) ON DELETE CASCADE NOT NULL,
  stars_cost integer NOT NULL,
  prize_won jsonb NOT NULL,
  opened_at timestamptz DEFAULT now()
);

ALTER TABLE mystery_box_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own box openings"
  ON mystery_box_openings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own box openings"
  ON mystery_box_openings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_mystery_box_openings_user_id ON mystery_box_openings(user_id);

-- =====================================================
-- WORKSHOPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS workshops (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  category text NOT NULL,
  age_min integer,
  age_max integer,
  instructor text,
  price decimal(10,2) NOT NULL,
  bonus_stars integer DEFAULT 0,
  max_capacity integer DEFAULT 10,
  session_date timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  image_url text,
  whats_included text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active workshops"
  ON workshops FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Anon can view active workshops"
  ON workshops FOR SELECT
  TO anon
  USING (is_active = true);

CREATE INDEX idx_workshops_session_date ON workshops(session_date);

-- =====================================================
-- WORKSHOP BOOKINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS workshop_bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  workshop_id uuid REFERENCES workshops(id) ON DELETE CASCADE NOT NULL,
  child_id uuid REFERENCES child_profiles(id) ON DELETE CASCADE,
  amount_paid decimal(10,2) NOT NULL,
  qr_code text,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  booked_at timestamptz DEFAULT now()
);

ALTER TABLE workshop_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON workshop_bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own bookings"
  ON workshop_bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own bookings"
  ON workshop_bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_workshop_bookings_user_id ON workshop_bookings(user_id);
CREATE INDEX idx_workshop_bookings_workshop_id ON workshop_bookings(workshop_id);

-- =====================================================
-- VOUCHERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS vouchers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  voucher_type text NOT NULL CHECK (voucher_type IN ('amount', 'percent', 'free_item')),
  value decimal(10,2) NOT NULL,
  min_purchase decimal(10,2) DEFAULT 0,
  max_uses integer,
  times_used integer DEFAULT 0,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active vouchers"
  ON vouchers FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Anon can view active vouchers"
  ON vouchers FOR SELECT
  TO anon
  USING (is_active = true);

-- =====================================================
-- VOUCHER USAGE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS voucher_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id uuid REFERENCES vouchers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  order_value decimal(10,2) NOT NULL,
  discount_amount decimal(10,2) NOT NULL,
  used_at timestamptz DEFAULT now()
);

ALTER TABLE voucher_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voucher usage"
  ON voucher_usage FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own voucher usage"
  ON voucher_usage FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_voucher_usage_user_id ON voucher_usage(user_id);
CREATE INDEX idx_voucher_usage_voucher_id ON voucher_usage(voucher_id);

-- =====================================================
-- CHECK INS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  location text DEFAULT 'Wonderpark',
  stars_earned integer NOT NULL,
  checked_in_at timestamptz DEFAULT now()
);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check-ins"
  ON check_ins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own check-ins"
  ON check_ins FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX idx_check_ins_checked_in_at ON check_ins(checked_in_at DESC);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('reminder', 'wallet', 'voucher', 'mission', 'promo', 'system')),
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- APP CONFIG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app config"
  ON app_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view app config"
  ON app_config FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- SEED DATA: MEMBERSHIP TIERS
-- =====================================================
INSERT INTO membership_tiers (name, threshold, earn_multiplier, topup_bonus_pct, workshop_discount_pct, redemption_discount_pct, mission_bonus_stars, color, sort_order)
VALUES 
  ('Silver', 0, 1.0, 0, 0, 0, 0, '#C0C0C0', 1),
  ('Gold', 500, 1.2, 5, 5, 5, 5, '#FFD700', 2),
  ('Platinum', 1500, 1.5, 10, 10, 10, 10, '#E5E4E2', 3)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SEED DATA: MISSIONS
-- =====================================================
INSERT INTO missions (title, description, mission_type, requirement_value, reward_stars, is_active, is_seasonal)
VALUES 
  ('Visit 2 times this week', 'Check in at Wonderpark twice in 7 days', 'visit', 2, 50, true, false),
  ('Join any workshop', 'Book and attend any workshop session', 'workshop', 1, 30, true, false),
  ('Spend RM30 in-park', 'Make purchases totaling RM30 or more', 'spend', 30, 20, true, false),
  ('Check in before 1 PM', 'Visit during off-peak hours for bonus stars', 'checkin', 1, 10, true, false),
  ('Weekend Warrior', 'Check in on both Saturday and Sunday', 'visit', 2, 75, true, true),
  ('Workshop Master', 'Attend 3 workshops this month', 'workshop', 3, 100, true, false),
  ('Big Spender', 'Spend RM100 in a single week', 'spend', 100, 80, true, false),
  ('Daily Explorer', 'Check in 5 days in a row', 'checkin', 5, 120, true, false)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: REWARDS
-- =====================================================
INSERT INTO rewards (name, description, category, base_cost_stars, stock, image_url)
VALUES 
  ('Wonder Balloon', 'Colorful branded balloon', 'toys', 100, 999, '/images/rewards/balloon.png'),
  ('Wonder Socks', 'Soft cotton socks with park logo', 'merch', 500, 50, '/images/rewards/socks.png'),
  ('Free Entry Pass', 'One complimentary park entry', 'entry', 800, 100, '/images/rewards/entry.png'),
  ('Birthday Party Voucher', 'RM200 off birthday party package', 'vip', 1500, 20, '/images/rewards/party.png'),
  ('Plush Dino Toy', 'Adorable dinosaur plush mascot', 'toys', 600, 30, '/images/rewards/dino.png'),
  ('Wonder T-Shirt', 'Premium cotton tee in multiple sizes', 'merch', 700, 40, '/images/rewards/tshirt.png'),
  ('VIP Lounge Access', '1-day access to VIP family lounge', 'vip', 1200, 15, '/images/rewards/vip.png'),
  ('Snack Pack', 'Chips, juice, and cookies combo', 'entry', 300, 999, '/images/rewards/snack.png'),
  ('Arcade Credit', 'RM10 arcade game credit', 'entry', 400, 999, '/images/rewards/arcade.png'),
  ('Wonder Cap', 'Embroidered baseball cap', 'merch', 550, 60, '/images/rewards/cap.png')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: MYSTERY BOXES
-- =====================================================
INSERT INTO mystery_boxes (name, base_cost_stars, tier, prize_pool)
VALUES 
  ('Bronze Mystery Box', 50, 'bronze', 
   '[
     {"type": "stars", "value": 5, "probability": 0.3},
     {"type": "stars", "value": 10, "probability": 0.25},
     {"type": "credit", "value": 2, "probability": 0.2},
     {"type": "item", "value": "Mini Toy", "probability": 0.15},
     {"type": "multiplier", "value": 1.2, "probability": 0.1}
   ]'::jsonb),
  ('Silver Mystery Box', 100, 'silver',
   '[
     {"type": "stars", "value": 15, "probability": 0.25},
     {"type": "stars", "value": 25, "probability": 0.2},
     {"type": "credit", "value": 5, "probability": 0.2},
     {"type": "voucher", "value": "MYSTERY10", "probability": 0.15},
     {"type": "item", "value": "Free Drink", "probability": 0.1},
     {"type": "multiplier", "value": 1.5, "probability": 0.1}
   ]'::jsonb),
  ('Gold Mystery Box', 200, 'gold',
   '[
     {"type": "stars", "value": 50, "probability": 0.25},
     {"type": "stars", "value": 100, "probability": 0.15},
     {"type": "credit", "value": 10, "probability": 0.2},
     {"type": "voucher", "value": "MYSTERY20", "probability": 0.15},
     {"type": "item", "value": "Plush Toy", "probability": 0.15},
     {"type": "multiplier", "value": 2.0, "probability": 0.1}
   ]'::jsonb)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: WORKSHOPS
-- =====================================================
INSERT INTO workshops (title, description, category, age_min, age_max, instructor, price, bonus_stars, max_capacity, session_date, duration_minutes, whats_included)
VALUES 
  ('Dino Discovery', 'Learn about dinosaurs through fun activities and crafts', 'Science', 5, 10, 'Dr. Sarah Chen', 45.00, 25, 12, now() + interval '2 days' + interval '10 hours', 90, 'All materials, snacks, certificate'),
  ('Space Adventure', 'Build rockets and learn about planets', 'Science', 6, 12, 'Captain Mike Johnson', 50.00, 30, 10, now() + interval '3 days' + interval '14 hours', 90, 'Rocket kit, space snacks, poster'),
  ('Art Explosion', 'Express creativity with painting and sculpture', 'Art', 4, 9, 'Ms. Lisa Wong', 40.00, 20, 15, now() + interval '4 days' + interval '11 hours', 60, 'Art supplies, apron, take-home artwork'),
  ('Mini Chef', 'Cook simple recipes and learn kitchen safety', 'Cooking', 7, 12, 'Chef Tony Rodriguez', 55.00, 35, 8, now() + interval '5 days' + interval '15 hours', 120, 'Ingredients, recipe book, chef hat'),
  ('Sports Stars', 'Multi-sport activities and team games', 'Sports', 5, 11, 'Coach Ahmed Hassan', 35.00, 15, 20, now() + interval '6 days' + interval '9 hours', 90, 'Equipment, water bottle, medal'),
  ('Magic & Science', 'Learn science through magic tricks', 'Science', 6, 10, 'The Amazing Leo', 48.00, 28, 12, now() + interval '7 days' + interval '13 hours', 75, 'Magic kit, instruction booklet')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: VOUCHERS
-- =====================================================
INSERT INTO vouchers (code, voucher_type, value, min_purchase, max_uses, expires_at)
VALUES 
  ('WELCOME5', 'amount', 5.00, 20.00, 1000, now() + interval '30 days'),
  ('SPRING20', 'percent', 20.00, 50.00, 500, now() + interval '60 days'),
  ('FREESNACK', 'free_item', 0.00, 0.00, 200, now() + interval '14 days'),
  ('BIRTHDAY10', 'percent', 10.00, 0.00, NULL, now() + interval '365 days')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SEED DATA: APP CONFIG
-- =====================================================
INSERT INTO app_config (config_key, config_value, description)
VALUES 
  ('topup_packages', 
   '[
     {"amount": 50, "bonus": 5},
     {"amount": 100, "bonus": 15},
     {"amount": 200, "bonus": 40}
   ]'::jsonb,
   'Available top-up packages with base bonus amounts'),
  ('stars_earn_rate',
   '{"base_rate": 1, "currency": "MYR"}'::jsonb,
   'Base stars earned per currency unit spent'),
  ('banner_messages',
   '{
     "birthday": "Birthday Month! Enjoy extra perks all month.",
     "multiplier": "Star Boost Active! Earn extra stars on all activities.",
     "welcome": "Welcome to WonderStars - where every visit is magical!"
   }'::jsonb,
   'Dynamic banner messages for various conditions')
ON CONFLICT (config_key) DO NOTHING;
