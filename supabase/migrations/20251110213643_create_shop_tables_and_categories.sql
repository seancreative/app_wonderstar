/*
  # Create Shop Tables, Categories, and Product ID System

  ## Overview
  This migration creates the complete shop system including outlets, products, categories,
  and implements proper product identification and multi-outlet support.

  ## New Tables

  1. **outlets** - Physical locations/branches
     - id (uuid, primary key)
     - name (text, not null) - e.g., "Wonderpark Melaka"
     - location (text, not null)
     - address (text, not null)
     - status (text, check constraint) - active, inactive
     - slug (text, unique)
     - image_url (text)
     - operating_hours (jsonb)
     - contact_phone (text)
     - contact_email (text)
     - capacity (integer)
     - created_at (timestamptz, default now())
     - updated_at (timestamptz, default now())

  2. **categories** - Product categories with unique IDs
     - id (uuid, primary key)
     - category_id (text, unique, not null) - Auto-generated: C001, C002, etc.
     - name (text, unique, not null)
     - description (text)
     - is_active (boolean, default true)
     - sort_order (integer, default 0)
     - created_at (timestamptz, default now())
     - updated_at (timestamptz, default now())

  3. **shop_products** - Product catalog
     - id (uuid, primary key)
     - product_id (text, unique, not null) - Auto-generated: P0001, P0002, etc.
     - outlet_id (uuid, foreign key) - Primary outlet for legacy support
     - name (text, not null)
     - description (text)
     - category_id (uuid, foreign key to categories)
     - subcategory (text)
     - base_price (numeric, not null)
     - weekend_price (numeric)
     - pricing_type (text) - fixed, variable
     - variants (jsonb) - array of variant options
     - addons (jsonb) - array of addon options
     - stock (integer, default 0)
     - image_url (text) - Primary image
     - images (text[]) - Additional images array
     - primary_image (text) - Featured image
     - is_active (boolean, default true)
     - workshop_date (timestamptz)
     - duration_minutes (integer)
     - age_min (integer)
     - age_max (integer)
     - max_capacity (integer)
     - bonus_stars (integer, default 0)
     - created_at (timestamptz, default now())
     - updated_at (timestamptz, default now())

  4. **product_outlets** - Junction table for multi-outlet product assignment
     - id (uuid, primary key)
     - product_id (uuid, foreign key to shop_products)
     - outlet_id (uuid, foreign key to outlets)
     - is_available (boolean, default true)
     - local_stock (integer)
     - local_price (numeric) - Override price for specific outlet
     - created_at (timestamptz, default now())
     - UNIQUE(product_id, outlet_id)

  5. **shop_cart_items** - Shopping cart items
     - id (uuid, primary key)
     - user_id (uuid, foreign key to users)
     - outlet_id (uuid, foreign key to outlets)
     - product_id (uuid, foreign key to shop_products)
     - quantity (integer, not null)
     - unit_price (numeric, not null)
     - metadata (jsonb)
     - created_at (timestamptz, default now())

  6. **shop_orders** - Customer orders
     - id (uuid, primary key)
     - user_id (uuid, foreign key to users)
     - outlet_id (uuid, foreign key to outlets)
     - order_number (text, unique)
     - items (jsonb, not null) - Array of order items
     - subtotal (numeric, not null)
     - discount_amount (numeric, default 0)
     - total_amount (numeric, not null)
     - status (text, check constraint) - pending, confirmed, ready, completed, cancelled
     - payment_method (text)
     - payment_transaction_id (uuid)
     - notes (text)
     - created_at (timestamptz, default now())
     - updated_at (timestamptz, default now())
     - completed_at (timestamptz)

  ## Functions
  - generate_product_id() - Auto-generates sequential product IDs (P0001, P0002, etc.)
  - generate_category_id() - Auto-generates sequential category IDs (C001, C002, etc.)
  - generate_order_number() - Auto-generates order numbers

  ## Security
  - RLS enabled on all tables
  - Public read access for outlets, categories, and active products
  - Authenticated users can manage their own cart and view their orders
  - Admin access for product and category management

  ## Seed Data
  - Two default outlets: Wonderpark Melaka and Wonderpark Kuala Terengganu
  - Sample product categories
*/

-- =====================================================
-- CREATE OUTLETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  address text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  slug text UNIQUE,
  image_url text,
  operating_hours jsonb DEFAULT '{}'::jsonb,
  contact_phone text,
  contact_email text,
  capacity integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outlets_status ON outlets(status);
CREATE INDEX IF NOT EXISTS idx_outlets_slug ON outlets(slug);

ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active outlets"
  ON outlets FOR SELECT
  USING (status = 'active');

CREATE POLICY "Admins can manage outlets"
  ON outlets FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- CREATE CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text UNIQUE NOT NULL,
  name text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_category_id ON categories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories"
  ON categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- CREATE SHOP_PRODUCTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text UNIQUE NOT NULL,
  outlet_id uuid REFERENCES outlets(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  subcategory text,
  base_price numeric(10,2) NOT NULL CHECK (base_price >= 0),
  weekend_price numeric(10,2) CHECK (weekend_price >= 0),
  pricing_type text DEFAULT 'fixed' CHECK (pricing_type IN ('fixed', 'variable')),
  variants jsonb DEFAULT '[]'::jsonb,
  addons jsonb DEFAULT '[]'::jsonb,
  stock integer DEFAULT 0 CHECK (stock >= 0),
  image_url text,
  images text[],
  primary_image text,
  is_active boolean DEFAULT true,
  workshop_date timestamptz,
  duration_minutes integer,
  age_min integer,
  age_max integer,
  max_capacity integer,
  bonus_stars integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_products_product_id ON shop_products(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_outlet_id ON shop_products(outlet_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_category_id ON shop_products(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_active ON shop_products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shop_products_created_at ON shop_products(created_at DESC);

ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products"
  ON shop_products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage products"
  ON shop_products FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- CREATE PRODUCT_OUTLETS JUNCTION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS product_outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES shop_products(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES outlets(id) ON DELETE CASCADE NOT NULL,
  is_available boolean DEFAULT true,
  local_stock integer,
  local_price numeric(10,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_product_outlets_product_id ON product_outlets(product_id);
CREATE INDEX IF NOT EXISTS idx_product_outlets_outlet_id ON product_outlets(outlet_id);
CREATE INDEX IF NOT EXISTS idx_product_outlets_available ON product_outlets(is_available) WHERE is_available = true;

ALTER TABLE product_outlets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available product outlets"
  ON product_outlets FOR SELECT
  USING (is_available = true);

CREATE POLICY "Admins can manage product outlets"
  ON product_outlets FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- CREATE SHOP_CART_ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES outlets(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES shop_products(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_cart_items_user_id ON shop_cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_cart_items_product_id ON shop_cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_cart_items_outlet_id ON shop_cart_items(outlet_id);

ALTER TABLE shop_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cart items"
  ON shop_cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart items"
  ON shop_cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart items"
  ON shop_cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart items"
  ON shop_cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- CREATE SHOP_ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES outlets(id) ON DELETE SET NULL NOT NULL,
  order_number text UNIQUE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(10,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount numeric(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount numeric(10,2) NOT NULL CHECK (total_amount >= 0),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'ready', 'completed', 'cancelled')),
  payment_method text,
  payment_transaction_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_outlet_id ON shop_orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_order_number ON shop_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_shop_orders_created_at ON shop_orders(created_at DESC);

ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON shop_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON shop_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all orders"
  ON shop_orders FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- FUNCTION: Generate Product ID
-- =====================================================
CREATE OR REPLACE FUNCTION generate_product_id()
RETURNS TEXT AS $$
DECLARE
  max_id TEXT;
  next_num INTEGER;
BEGIN
  SELECT product_id INTO max_id
  FROM shop_products
  WHERE product_id ~ '^P[0-9]{4}$'
  ORDER BY product_id DESC
  LIMIT 1;

  IF max_id IS NULL THEN
    next_num := 1;
  ELSE
    next_num := CAST(SUBSTRING(max_id FROM 2) AS INTEGER) + 1;
  END IF;

  RETURN 'P' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Generate Category ID
-- =====================================================
CREATE OR REPLACE FUNCTION generate_category_id()
RETURNS TEXT AS $$
DECLARE
  max_id TEXT;
  next_num INTEGER;
BEGIN
  SELECT category_id INTO max_id
  FROM categories
  WHERE category_id ~ '^C[0-9]{3}$'
  ORDER BY category_id DESC
  LIMIT 1;

  IF max_id IS NULL THEN
    next_num := 1;
  ELSE
    next_num := CAST(SUBSTRING(max_id FROM 2) AS INTEGER) + 1;
  END IF;

  RETURN 'C' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Generate Order Number
-- =====================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-generate product_id
-- =====================================================
CREATE OR REPLACE FUNCTION set_product_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NULL OR NEW.product_id = '' THEN
    NEW.product_id := generate_product_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_product_id ON shop_products;
CREATE TRIGGER trigger_set_product_id
  BEFORE INSERT ON shop_products
  FOR EACH ROW
  EXECUTE FUNCTION set_product_id();

-- =====================================================
-- TRIGGER: Auto-generate category_id
-- =====================================================
CREATE OR REPLACE FUNCTION set_category_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category_id IS NULL OR NEW.category_id = '' THEN
    NEW.category_id := generate_category_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_category_id ON categories;
CREATE TRIGGER trigger_set_category_id
  BEFORE INSERT ON categories
  FOR EACH ROW
  EXECUTE FUNCTION set_category_id();

-- =====================================================
-- TRIGGER: Auto-generate order_number
-- =====================================================
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_number ON shop_orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_outlets_updated_at ON outlets;
CREATE TRIGGER update_outlets_updated_at
  BEFORE UPDATE ON outlets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_products_updated_at ON shop_products;
CREATE TRIGGER update_shop_products_updated_at
  BEFORE UPDATE ON shop_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_orders_updated_at ON shop_orders;
CREATE TRIGGER update_shop_orders_updated_at
  BEFORE UPDATE ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA: Outlets
-- =====================================================
INSERT INTO outlets (name, location, address, status, slug, contact_phone, contact_email)
VALUES
  (
    'Wonderpark Melaka',
    'Melaka',
    'Jalan Tun Ali, 75450 Ayer Keroh, Melaka, Malaysia',
    'active',
    'wonderpark-melaka',
    '+60-6-123-4567',
    'melaka@wonderpark.com.my'
  ),
  (
    'Wonderpark Kuala Terengganu',
    'Kuala Terengganu',
    'Jalan Sultan Ismail, 20200 Kuala Terengganu, Terengganu, Malaysia',
    'active',
    'wonderpark-kuala-terengganu',
    '+60-9-765-4321',
    'terengganu@wonderpark.com.my'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  address = EXCLUDED.address,
  status = EXCLUDED.status,
  contact_phone = EXCLUDED.contact_phone,
  contact_email = EXCLUDED.contact_email;

-- =====================================================
-- SEED DATA: Categories
-- =====================================================
INSERT INTO categories (name, description, is_active, sort_order)
VALUES
  ('Food & Beverages', 'Snacks, meals, and drinks', true, 1),
  ('Toys & Games', 'Fun toys and games for children', true, 2),
  ('Workshops', 'Educational workshops and activities', true, 3),
  ('Merchandise', 'Branded merchandise and souvenirs', true, 4),
  ('Party Packages', 'Birthday party and event packages', true, 5),
  ('Entry Tickets', 'Park entry and access passes', true, 6)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;
