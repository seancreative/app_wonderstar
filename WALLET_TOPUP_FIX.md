# Wallet Top-up Balance Fix

## Problem

Money was not appearing in the W Balance account after completing a top-up payment. The root cause was:

1. Wallet transactions were created immediately when users initiated top-up (status only stored in metadata JSON)
2. The balance calculation in `useWallet` hook counted ALL transactions regardless of payment success
3. When payments succeeded, the status update was only happening in the metadata field, not a dedicated column
4. No proper synchronization between `payment_transactions` and `wallet_transactions` status

## Solution

### 1. Database Schema Enhancement (Migration: `20251116044335_fix_wallet_transaction_status.sql`)

**Added `status` column to `wallet_transactions` table:**
- Type: `text` with check constraint
- Default: `'pending'`
- Valid values: `'pending'`, `'processing'`, `'success'`, `'failed'`, `'cancelled'`
- Indexed for performance

**Data Migration:**
- Migrated existing status data from metadata JSON to the new column
- Synced status with linked payment transactions
- Updated all historical records

**Database Trigger:**
- Created `sync_wallet_transaction_status()` function
- Automatically updates wallet transaction status when payment transaction status changes
- Ensures data consistency between payment and wallet transactions

**Helper Functions:**
- `reconcile_wallet_transaction()` - Manually reconcile a stuck transaction
- `cleanup_abandoned_wallet_transactions()` - Cancel transactions pending for 24+ hours

**Database View:**
- `user_wallet_balances` - Real-time balance calculation view that only counts successful transactions

### 2. Frontend Updates

**useWallet Hook (`src/hooks/useWallet.ts`):**
- Updated `loadWalletData()` to filter transactions by status
- Only transactions with `status: 'success'` are counted in balance calculation
- Prevents pending/failed payments from affecting displayed balance

**WalletTopup Component (`src/pages/WalletTopup.tsx`):**
- Set `status: 'pending'` when creating initial wallet transaction
- Moved status from metadata to dedicated field
- Cleaner, more explicit status tracking

**PaymentCallback Component (`src/pages/PaymentCallback.tsx`):**
- Updates both `status` column and metadata when payment succeeds
- Sets `status: 'success'` on wallet transaction after payment confirmation
- Creates bonus transactions with `status: 'success'` immediately
- Added error handling for status update failures

**TypeScript Types (`src/types/database.ts`):**
- Added `status` field to `WalletTransaction` interface
- Proper type checking for status values

## How It Works Now

### Top-up Flow:

1. **User initiates top-up:**
   - Shop order created with `status: 'pending'`
   - Wallet transaction created with `status: 'pending'`
   - Payment transaction created with `status: 'pending'`
   - User redirected to payment gateway

2. **Payment gateway processes payment:**
   - User completes payment at Fiuu/payment provider
   - Backend receives callback with payment result
   - Payment transaction status updated to `'success'`

3. **Database trigger fires automatically:**
   - Detects payment transaction status change
   - Updates linked wallet transaction to `status: 'success'`
   - Data consistency maintained

4. **Frontend updates:**
   - Payment callback page receives success status
   - Explicitly updates wallet transaction status (redundant but safe)
   - Creates bonus transaction with `status: 'success'`
   - Calls `reloadBalance()` to refresh wallet display
   - useWallet hook only counts successful transactions
   - Balance appears immediately in user's wallet

### Balance Calculation Logic:

```typescript
// Only successful transactions affect balance
data?.forEach((tx) => {
  if (tx.status !== 'success') {
    return; // Skip pending/failed/cancelled
  }

  // Count transaction in balance...
});
```

## Safety Features

1. **Atomic Updates:** Database trigger ensures wallet and payment transaction status stay synchronized
2. **Idempotent Operations:** Multiple status updates to same value don't cause issues
3. **Error Recovery:** Helper functions for manual reconciliation
4. **Abandoned Transaction Cleanup:** Auto-cancel old pending transactions
5. **Audit Trail:** Status changes logged in metadata for tracking

## Testing Checklist

- [x] New wallet transactions created with 'pending' status
- [x] Balance calculation filters by status
- [x] Payment success updates wallet transaction status
- [x] Database trigger syncs status automatically
- [x] Build compiles without errors
- [ ] Manual test: Complete a top-up and verify balance increases
- [ ] Manual test: Cancel a payment and verify balance doesn't change
- [ ] Manual test: Check old transactions are migrated correctly

## Admin Tools

**Check wallet balance for user:**
```sql
SELECT * FROM user_wallet_balances WHERE user_id = '<user_uuid>';
```

**Reconcile stuck transaction:**
```sql
SELECT reconcile_wallet_transaction('<wallet_transaction_id>');
```

**Cleanup abandoned transactions:**
```sql
SELECT cleanup_abandoned_wallet_transactions(24); -- 24 hours threshold
```

## Migration Steps

1. Apply migration: `20251116044335_fix_wallet_transaction_status.sql`
2. Verify existing transactions have status populated
3. Deploy frontend code changes
4. Monitor payment callbacks for successful status updates
5. Check user balances are calculated correctly

## Rollback Plan

If issues occur:
1. The old metadata-based status is still preserved
2. Can temporarily revert frontend code to read from metadata
3. Database trigger can be disabled without data loss
4. Status column can be ignored (but not removed) if needed
