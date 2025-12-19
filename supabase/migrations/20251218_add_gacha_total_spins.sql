-- Migration: Add gacha_total_spins column to users table
-- This tracks the total number of gacha spins a user has made

-- Add the gacha_total_spins column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'gacha_total_spins'
    ) THEN
        ALTER TABLE users ADD COLUMN gacha_total_spins INTEGER DEFAULT 0;
        
        -- Add comment
        COMMENT ON COLUMN users.gacha_total_spins IS 'Total number of gacha spins made by this user';
    END IF;
END $$;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_gacha_total_spins ON users(gacha_total_spins);

-- Backfill: Count existing spins from egg_redemptions
UPDATE users u
SET gacha_total_spins = COALESCE((
    SELECT COUNT(*) 
    FROM egg_redemptions er 
    WHERE er.user_id = u.id
), 0)
WHERE gacha_total_spins IS NULL OR gacha_total_spins = 0;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: Added gacha_total_spins column to users table';
END $$;
