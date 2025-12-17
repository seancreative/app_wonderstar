# CMS Customer Verify Balance Fix - Complete

## Issue Summary
The CMS > Customer > Verify feature was showing a blank page because the balance verification was returning empty/zero values instead of actual user balances.

## Root Causes Identified

### 1. Database Function Status Mismatch
**Problem**: The `get_user_wallet_balance()` function was filtering for `status = 'completed'` but wallet_transactions actually use `status = 'success'`.

**Impact**: All wallet balance queries returned 0, making verification appear blank.

**Location**: `supabase/migrations/20251211121208_unify_balance_storage_fixed.sql` line 75

### 2. Hardcoded Discrepancy Check
**Problem**: The `verifyUserBalances()` function always returned `false` for lifetime_topups discrepancy instead of actually comparing values.

**Impact**: Even when there were mismatches between calculated and stored lifetime_topups, the verification never detected them.

**Location**: `src/services/masterBalanceCalculator.ts` line 309

## Fixes Applied

### Fix 1: Database Function Status Correction
**Migration**: `fix_wallet_balance_function_status.sql`

Updated the `get_user_wallet_balance()` function:
```sql
-- Changed from:
WHERE user_id = p_user_id AND status = 'completed'

-- Changed to:
WHERE user_id = p_user_id AND status = 'success'
```

This now correctly filters wallet transactions using the actual status value used throughout the system.

### Fix 2: Verification Logic Enhancement
**File**: `src/services/masterBalanceCalculator.ts`

Updated the discrepancy detection:
```typescript
// Before:
const discrepancies = {
  wallet: false,
  bonus: false,
  stars: false,
  lifetime: false // Hardcoded - never detected issues
};

// After:
const TOLERANCE = 0.01; // Account for floating point precision
const discrepancies = {
  wallet: false, // Not stored, always calculated
  bonus: false, // Not stored, always calculated
  stars: false, // Not stored, always calculated
  lifetime: Math.abs(calculated.lifetimeTopup - stored.lifetimeTopup) > TOLERANCE
};
```

Now properly compares calculated vs stored lifetime_topups with a tolerance for floating-point precision.

### Fix 3: UI Null Safety for Verification Display
**Files**:
- `src/components/cms/CustomerDetailModal.tsx`
- `src/components/cms/TransactionDetailsModal.tsx`

Fixed null reference error when displaying verification results:
```typescript
// Before (caused crash):
<div>
  Bonus: <span>RM {verificationData.stored.bonusBalance.toFixed(2)}</span>
</div>

// After (shows "Calculated Only"):
<div className="text-gray-500">
  Bonus: <span className="font-bold italic">Calculated Only</span>
</div>
```

Since wallet balance, bonus balance, and stars balance are NOT stored in the database (only calculated from transactions), the UI now correctly shows "Calculated Only" instead of trying to display null values.

## How It Works Now

### Single Source of Truth Architecture
The system uses transaction tables as the single source of truth:

1. **Wallet Balance**: Calculated from `wallet_transactions` (status='success')
2. **Bonus Balance**: Calculated from `bonus_transactions`
3. **Stars Balance**: Calculated from `stars_transactions`
4. **Lifetime Topups**: Stored in `users.lifetime_topups` (only cached value)

### Verification Process
When you click "Verify" on a customer:

1. **Calculate balances** from transaction history (single source of truth)
2. **Fetch stored values** from users table (only lifetime_topups is stored)
3. **Compare values** and detect discrepancies
4. **Display report** showing:
   - Calculated values (from transactions)
   - Stored values (from users table)
   - Any discrepancies found
5. **Sync option** available if discrepancies detected

### Transaction History Modal
The "View Details" button shows:
- Complete unified transaction history
- All wallet, bonus, and stars transactions in one view
- Running balances after each transaction
- Ability to verify and sync from the modal
- Export to CSV functionality

## Verification Flow

### CMS > Customers > View Customer > Verify
1. Opens customer detail modal
2. Shows current balances (calculated from transactions)
3. Click "Verify" button
4. Displays verification report comparing calculated vs stored
5. If discrepancies found, "Sync Database Values" button appears
6. Click sync to update stored lifetime_topups value

### Transaction History > Verify
1. Click "View Details" button in customer modal
2. Opens complete transaction history modal
3. Click "Verify Balances" button in header
4. Shows same verification report
5. Works identically to customer modal verification

## Testing Verification

To test that verification now works:

1. Go to CMS > Customers
2. Click on any customer with transactions
3. In the Balance Summary section, click "Verify"
4. You should now see a verification report showing:
   - Calculated balances (from transactions)
   - Stored values (lifetime_topups from users table)
   - Green checkmark if values match
   - Red warning if discrepancies detected

## What Was Fixed

✅ Database function now uses correct status value ('success' not 'completed')
✅ Verification logic now actually compares lifetime_topups values
✅ Proper tolerance added for floating-point comparison
✅ UI null safety - no more crashes when displaying verification
✅ Clear comments explaining what's stored vs calculated
✅ Both verification entry points (customer modal and transaction modal) work
✅ Verification display properly shows "Calculated Only" for non-stored balances

## Benefits

1. **Accurate Balance Display**: All balances now show correct values
2. **Working Verification**: Can detect when stored values drift from calculated
3. **Easy Sync**: One-click sync to fix any discrepancies
4. **Single Source of Truth**: Transaction tables are authoritative
5. **Better Debugging**: Clear audit trail of what's calculated vs stored

## Related Files

- `supabase/migrations/fix_wallet_balance_function_status.sql` - Database fix
- `src/services/masterBalanceCalculator.ts` - Verification logic
- `src/components/cms/CustomerDetailModal.tsx` - Customer verify UI
- `src/components/cms/TransactionDetailsModal.tsx` - Transaction history verify UI
- `src/hooks/useMasterBalances.ts` - Balance calculation hook

## Status Value Reference

For future reference, the correct status values are:
- **wallet_transactions**: `'pending' | 'processing' | 'success' | 'failed' | 'cancelled'`
- **bonus_transactions**: No status column (all records valid)
- **stars_transactions**: No status column (all records valid)

Only `'success'` status wallet transactions count towards balance.
