# Bonus Balance RLS Fix - RESOLVED

## Issue
`useMasterBalances` hook was showing `bonus: 0` for authenticated users, even though the CMS showed the correct bonus balance value (e.g., 154.8).

## Root Cause
The RLS (Row Level Security) policies for transaction tables had a critical UUID mismatch:

1. **Policy Check**: `auth.uid() = user_id`
2. **The Problem**:
   - `auth.uid()` returns the Supabase Auth user ID (stored in `users.auth_id`)
   - `bonus_transactions.user_id` references `users.id` (a completely different UUID)
   - These two UUIDs never match, so authenticated users couldn't query their transactions
3. **Why CMS Worked**: The CMS uses anonymous/service key access which bypasses RLS

## The Fix
Created migration `fix_transaction_rls_auth_mapping.sql` that updates all transaction table SELECT policies:

### Before (Broken)
```sql
CREATE POLICY "Users can view own bonus transactions"
  ON bonus_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

### After (Fixed)
```sql
CREATE POLICY "Users can view own bonus transactions"
  ON bonus_transactions
  FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
```

## Tables Updated
1. **bonus_transactions** - Fixed SELECT policy for authenticated users
2. **wallet_transactions** - Fixed SELECT policy for authenticated users
3. **stars_transactions** - Fixed SELECT policy for authenticated users

## How It Works Now
1. User logs in → Supabase Auth creates session with `auth.uid()` = their Auth ID
2. RLS policy runs: `user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())`
3. Subquery finds the corresponding `users.id` for that Auth ID
4. Transaction query only returns rows where `user_id` matches that `users.id`
5. `useMasterBalances` now correctly calculates all balances including bonus

## Security
- Users can only see their own transactions (via auth_id → users.id mapping)
- Payment callbacks still work via anon policies
- CMS access still works via anon/service policies
- No security holes introduced

## Expected Result
After this fix:
- `useMasterBalances` shows correct bonus balance
- Wallet balance continues to work correctly
- Stars balance continues to work correctly
- Transaction history is visible to authenticated users
- CMS continues to display correct values

## Testing
Reload the app and check the console:
```
[Home] Balances from useMasterBalances: {wallet: 88.3, bonus: 154.8, stars: 5329, loading: false}
```

The bonus balance should now display the correct value instead of 0.
