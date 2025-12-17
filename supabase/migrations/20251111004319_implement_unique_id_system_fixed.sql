/*
  # Implement Unique ID System for All Entities

  1. Schema Changes
    - Add display_id columns to users, outlets, staff_passcodes, rewards tables
    - Create auto-increment sequences for outlets, staff, rewards
    - Create trigger function for customer ID generation (C + DDYY + 4 random digits)
    - Add created_date and redemption_count to vouchers table

  2. New Columns
    - users.display_id: Customer ID format C + DDYY + 4 random digits (e.g., C10230001)
    - outlets.display_id: Outlet ID format O001, O002, etc.
    - staff_passcodes.display_id: Staff ID format S001, S002, etc.
    - rewards.display_id: Rewards ID format R001, R002, etc.
    - vouchers.created_date: Timestamp of voucher creation
    - vouchers.redemption_count: Number of times voucher has been redeemed

  3. Important Notes
    - All display IDs are unique and indexed for performance
    - Triggers automatically generate display IDs on insert
    - Existing records will be updated with display IDs
    - Display IDs become the single source of truth for identification
*/

-- Add display_id column to users table (Customer ID)
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_id TEXT;

-- Add display_id column to outlets table (Outlet ID)
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS display_id TEXT;

-- Add display_id column to staff_passcodes table (Staff ID)
ALTER TABLE staff_passcodes ADD COLUMN IF NOT EXISTS display_id TEXT;

-- Add display_id column to rewards table (Rewards ID)
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS display_id TEXT;

-- Add created_date and redemption_count to vouchers table
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT now();
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS redemption_count INTEGER DEFAULT 0;

-- Create sequences for auto-incrementing IDs
CREATE SEQUENCE IF NOT EXISTS outlets_display_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS staff_display_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS rewards_display_id_seq START 1;

-- Function to generate Customer ID (C + DDYY + 4 random digits)
CREATE OR REPLACE FUNCTION generate_customer_display_id()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  random_part TEXT;
  new_id TEXT;
  max_attempts INTEGER := 100;
  attempt INTEGER := 0;
BEGIN
  -- Get current date in DDYY format
  date_part := TO_CHAR(CURRENT_DATE, 'DDYY');

  LOOP
    -- Generate 4 random digits
    random_part := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    new_id := 'C' || date_part || random_part;

    -- Check if ID already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE display_id = new_id) THEN
      RETURN new_id;
    END IF;

    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique customer ID after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate Outlet ID (O001, O002, etc.)
CREATE OR REPLACE FUNCTION generate_outlet_display_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('outlets_display_id_seq');
  RETURN 'O' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate Staff ID (S001, S002, etc.)
CREATE OR REPLACE FUNCTION generate_staff_display_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('staff_display_id_seq');
  RETURN 'S' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate Rewards ID (R001, R002, etc.)
CREATE OR REPLACE FUNCTION generate_rewards_display_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('rewards_display_id_seq');
  RETURN 'R' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger function for users (customers)
CREATE OR REPLACE FUNCTION set_user_display_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_id IS NULL THEN
    NEW.display_id := generate_customer_display_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for outlets
CREATE OR REPLACE FUNCTION set_outlet_display_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_id IS NULL THEN
    NEW.display_id := generate_outlet_display_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for staff
CREATE OR REPLACE FUNCTION set_staff_display_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_id IS NULL THEN
    NEW.display_id := generate_staff_display_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for rewards
CREATE OR REPLACE FUNCTION set_reward_display_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_id IS NULL THEN
    NEW.display_id := generate_rewards_display_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_set_user_display_id ON users;
DROP TRIGGER IF EXISTS trigger_set_outlet_display_id ON outlets;
DROP TRIGGER IF EXISTS trigger_set_staff_display_id ON staff_passcodes;
DROP TRIGGER IF EXISTS trigger_set_reward_display_id ON rewards;

-- Create triggers
CREATE TRIGGER trigger_set_user_display_id
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_display_id();

CREATE TRIGGER trigger_set_outlet_display_id
  BEFORE INSERT ON outlets
  FOR EACH ROW
  EXECUTE FUNCTION set_outlet_display_id();

CREATE TRIGGER trigger_set_staff_display_id
  BEFORE INSERT ON staff_passcodes
  FOR EACH ROW
  EXECUTE FUNCTION set_staff_display_id();

CREATE TRIGGER trigger_set_reward_display_id
  BEFORE INSERT ON rewards
  FOR EACH ROW
  EXECUTE FUNCTION set_reward_display_id();

-- Temporarily disable the updated_at trigger to avoid conflicts
ALTER TABLE outlets DISABLE TRIGGER update_outlets_updated_at;

-- Update existing outlets with display IDs
DO $$
DECLARE
  outlet_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR outlet_record IN
    SELECT id FROM outlets WHERE display_id IS NULL ORDER BY created_at
  LOOP
    UPDATE outlets
    SET display_id = 'O' || LPAD(counter::TEXT, 3, '0')
    WHERE id = outlet_record.id;
    counter := counter + 1;
  END LOOP;

  -- Update the sequence to continue from the last assigned number
  IF counter > 1 THEN
    PERFORM setval('outlets_display_id_seq', counter - 1);
  END IF;
END $$;

-- Re-enable the updated_at trigger
ALTER TABLE outlets ENABLE TRIGGER update_outlets_updated_at;

-- Update existing staff with display IDs
DO $$
DECLARE
  staff_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR staff_record IN
    SELECT id FROM staff_passcodes WHERE display_id IS NULL ORDER BY created_at
  LOOP
    UPDATE staff_passcodes
    SET display_id = 'S' || LPAD(counter::TEXT, 3, '0')
    WHERE id = staff_record.id;
    counter := counter + 1;
  END LOOP;

  -- Update the sequence to continue from the last assigned number
  IF counter > 1 THEN
    PERFORM setval('staff_display_id_seq', counter - 1);
  END IF;
END $$;

-- Update existing rewards with display IDs
DO $$
DECLARE
  reward_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR reward_record IN
    SELECT id FROM rewards WHERE display_id IS NULL ORDER BY created_at
  LOOP
    UPDATE rewards
    SET display_id = 'R' || LPAD(counter::TEXT, 3, '0')
    WHERE id = reward_record.id;
    counter := counter + 1;
  END LOOP;

  -- Update the sequence to continue from the last assigned number
  IF counter > 1 THEN
    PERFORM setval('rewards_display_id_seq', counter - 1);
  END IF;
END $$;

-- Update existing users/customers with display IDs
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT id FROM users WHERE display_id IS NULL ORDER BY created_at
  LOOP
    UPDATE users
    SET display_id = generate_customer_display_id()
    WHERE id = user_record.id;
  END LOOP;
END $$;

-- Add unique constraints after populating data
ALTER TABLE users ADD CONSTRAINT users_display_id_key UNIQUE (display_id);
ALTER TABLE outlets ADD CONSTRAINT outlets_display_id_key UNIQUE (display_id);
ALTER TABLE staff_passcodes ADD CONSTRAINT staff_passcodes_display_id_key UNIQUE (display_id);
ALTER TABLE rewards ADD CONSTRAINT rewards_display_id_key UNIQUE (display_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_display_id ON users(display_id);
CREATE INDEX IF NOT EXISTS idx_outlets_display_id ON outlets(display_id);
CREATE INDEX IF NOT EXISTS idx_staff_display_id ON staff_passcodes(display_id);
CREATE INDEX IF NOT EXISTS idx_rewards_display_id ON rewards(display_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_created_date ON vouchers(created_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_redemption_count ON vouchers(redemption_count);

-- Update vouchers created_date for existing records (if null)
UPDATE vouchers
SET created_date = created_at
WHERE created_date IS NULL AND created_at IS NOT NULL;

-- Initialize redemption_count to 0 for existing records (if null)
UPDATE vouchers
SET redemption_count = 0
WHERE redemption_count IS NULL;