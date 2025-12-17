# RLS Migration Status & Implementation Guide

## Current Status

### ✅ Completed (Phase 1-5)

1. **Backup & Safety Setup**
   - ✅ Created `backup-database.mjs` - exports all critical data
   - ✅ Created `emergency-rollback.sql` - can disable all RLS instantly
   - ✅ Database migration for auth columns applied

2. **Database Schema Updates**
   - ✅ Added `auth_id` column to users, admin_users, staff_passcodes
   - ✅ Added indexes for performance
   - ✅ Created helper functions (`has_supabase_auth`, `get_user_id_from_auth`)

3. **User Migration Script**
   - ✅ Created `migrate-users-to-auth.mjs`
   - Features:
     - Dry run mode by default
     - Generates secure temporary passwords
     - Idempotent (can run multiple times)
     - Maintains audit trail

4. **Authentication Code Updated**
   - ✅ Updated `AuthContext.tsx` to use Supabase Auth
   - ✅ Maintains backward compatibility with localStorage
   - ✅ Updated `Signup.tsx` to include password
   - ✅ Updated `Login.tsx` for real authentication
   - Features:
     - Dual auth support during transition
     - Auto-migration detection
     - Session management
     - Password reset functionality

5. **RLS Policies - Group A (Public Tables)**
   - ✅ Enabled RLS on 19 catalog/public tables
   - ✅ Created policies for public read, authenticated write
   - Tables: outlets, products, categories, tiers, rewards, etc.

---

## 🔧 Next Steps (Before Going Live)

### Step 1: Run Database Backup (REQUIRED)

```bash
node backup-database.mjs
```

This creates a timestamped JSON file with all your data. **DO NOT SKIP THIS STEP!**

### Step 2: Add Service Role Key

You need to add the service role key to your `.env` file for user migration:

1. Go to: https://supabase.com/dashboard/project/lfmfzvhonbjgmejrevat/settings/api
2. Copy the `service_role` key (NOT the anon key)
3. Add to `.env`:

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 3: Test User Migration (Dry Run)

```bash
node migrate-users-to-auth.mjs --dry-run
```

This shows what will happen without making changes. Review the output carefully.

### Step 4: Migrate Users (LIVE)

```bash
node migrate-users-to-auth.mjs --execute
```

**IMPORTANT**: Save the temporary passwords that are generated! Users will need these to log in.

### Step 5: Enable Remaining RLS Policies

You need to create and apply migrations for:

#### Group B: User-Scoped Data
Tables: child_profiles, user_preferences, notifications, mission_progress, workshop_bookings, check_ins, mystery_box_openings

Policy Pattern:
```sql
-- Users can only access their own data
CREATE POLICY "Users view own data" ON table_name
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users insert own data" ON table_name
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
```

#### Group C: Financial Tables
Tables: wallet_transactions, stars_transactions, shop_cart_items, shop_orders, payment_transactions, redemptions

Policy Pattern:
```sql
-- Users can view own, system can create/update
CREATE POLICY "Users view own transactions" ON table_name
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Service role can manage" ON table_name
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

#### Group D: Admin Tables
Tables: admin_users, admin_permissions, staff_passcodes, admin_activity_logs, staff_redemption_logs, staff_scan_logs

Policy Pattern:
```sql
-- Only admin users can access
CREATE POLICY "Admins only" ON table_name
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE auth_id = auth.uid()
        AND is_active = true
    )
  );
```

#### Group E: Voucher System
Tables: user_vouchers, voucher_redemptions, voucher_usage, voucher_auto_rules, order_item_redemptions

Policy Pattern:
```sql
-- Complex policies based on ownership and state
CREATE POLICY "Users view own vouchers" ON user_vouchers
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Service role for automatic operations
CREATE POLICY "Service role manages vouchers" ON user_vouchers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### Step 6: Create Secure Database Functions

Create PostgreSQL functions with `SECURITY DEFINER` for complex operations that need to bypass RLS:

```sql
CREATE OR REPLACE FUNCTION process_order(
  p_user_id uuid,
  p_items jsonb,
  p_payment_method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- Verify user
  IF NOT EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND id = p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Create order (bypasses RLS with SECURITY DEFINER)
  INSERT INTO shop_orders (user_id, ...)
  VALUES (p_user_id, ...)
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;
```

### Step 7: Test Everything

Test these critical flows:

1. **New User Signup** - create account with password
2. **User Login** - authenticate with email/password
3. **User Logout** - clear session
4. **View Products** - catalog should be visible
5. **Add to Cart** - cart should work
6. **Checkout** - order creation should work
7. **View Orders** - users see only their orders
8. **Admin Login** - admin CMS access
9. **Staff Scanner** - staff operations work
10. **Voucher Redemption** - voucher system works

### Step 8: Monitor & Rollback If Needed

If anything breaks:

```sql
-- Run the emergency rollback (this disables all RLS immediately)
\i emergency-rollback.sql
```

Or use the Supabase dashboard to disable RLS on specific tables.

---

## 🚨 Emergency Procedures

### If Login Stops Working

1. Check browser console for errors
2. Verify `auth_id` is populated in users table
3. Check Supabase Auth dashboard for user accounts
4. Temporarily disable RLS on users table:

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

### If Orders/Payments Fail

1. Check if RLS is blocking the operation
2. Temporarily disable RLS on affected tables
3. Create SECURITY DEFINER functions for those operations

### Full Rollback

```bash
# Apply emergency rollback
psql $DATABASE_URL < emergency-rollback.sql

# Revert auth changes in code
git revert <commit-hash>
```

---

## 📊 Migration Checklist

- [x] Database backup created
- [x] Rollback script ready
- [x] Auth columns added to database
- [x] User migration script created
- [x] AuthContext updated
- [x] Login/Signup pages updated
- [x] Group A RLS policies applied
- [ ] Service role key added to .env
- [ ] User migration executed
- [ ] Group B RLS policies applied
- [ ] Group C RLS policies applied
- [ ] Group D RLS policies applied
- [ ] Group E RLS policies applied
- [ ] Database functions created
- [ ] All flows tested
- [ ] Production deployment

---

## 📝 Notes

- The current implementation allows both old (localStorage) and new (Supabase Auth) to work simultaneously
- Existing users won't be affected until you run the migration script
- New signups automatically use Supabase Auth
- You can gradually migrate users over time
- RLS policies are additive - you can enable them table by table

---

## 🔗 Resources

- Supabase Dashboard: https://supabase.com/dashboard/project/lfmfzvhonbjgmejrevat
- Auth Settings: https://supabase.com/dashboard/project/lfmfzvhonbjgmejrevat/auth/users
- RLS Policies: https://supabase.com/dashboard/project/lfmfzvhonbjgmejrevat/auth/policies

---

## Questions or Issues?

If you encounter any issues during migration:

1. Check the browser console for errors
2. Check Supabase logs in the dashboard
3. Review RLS policies in the dashboard
4. Use emergency rollback if needed
5. All data is safely backed up!
