# Payment Security Implementation

## Overview
This document outlines the comprehensive security measures implemented to prevent payment exploitation and ensure bonus balance updates work correctly in the UI.

## Security Layers

### 1. Frontend Protection (PaymentCallback.tsx)

#### Layer 1.1: Processing Flag
- Uses `isProcessing.current` ref to prevent concurrent payment processing
- Ensures only one payment verification can run at a time
- Prevents race conditions from user interactions (rapid clicks, refreshes)

```typescript
if (isProcessing.current) {
  console.log('[PaymentCallback] Already processing, skipping duplicate call');
  return;
}
isProcessing.current = true;
```

#### Layer 1.2: Session Storage Check
- Marks payments as processed in `sessionStorage` **BEFORE** processing
- Prevents same-session duplicates from browser back button, refresh, or renavigation
- Key format: `payment_processed_{orderId}`

```typescript
const sessionKey = `payment_processed_${orderId}`;
const alreadyProcessed = sessionStorage.getItem(sessionKey);

if (alreadyProcessed) {
  // Show success UI but don't reprocess
  // Still reload balances to show current state
  return;
}

sessionStorage.setItem(sessionKey, new Date().toISOString());
```

#### Layer 1.3: URL Parameter Cleanup
- Clears URL parameters immediately after reading them
- Prevents browser back button from resubmitting the same payment
- Uses `window.history.replaceState()` to clean URL

```typescript
window.history.replaceState({}, document.title, '/payment/callback');
```

### 2. Backend Protection (Database Layer)

#### Layer 2.1: Wallet Transaction Status Check
- Checks if `wallet_transactions.status` is already 'success'
- Prevents duplicate processing if transaction already completed
- Falls back to bonus verification and recovery if needed

```sql
SELECT * FROM wallet_transactions WHERE id = ? AND status = 'success'
```

#### Layer 2.2: Unique Constraint on Bonus Transactions
- Database-level unique index prevents duplicate bonus awards
- Composite index on: `(user_id, metadata->>'wallet_transaction_id')`
- Only applies to `transaction_type = 'topup_bonus'`

```sql
CREATE UNIQUE INDEX idx_bonus_transactions_unique_topup
  ON bonus_transactions (user_id, (metadata->>'wallet_transaction_id'))
  WHERE transaction_type = 'topup_bonus'
    AND metadata->>'wallet_transaction_id' IS NOT NULL;
```

#### Layer 2.3: Atomic Balance Update Function
- New database function: `update_bonus_balance_atomic()`
- Uses PostgreSQL row-level locking (`FOR UPDATE`)
- Ensures atomic read-modify-write operations
- Prevents race conditions when multiple processes try to update simultaneously

**Key Features:**
- Row locking prevents concurrent modifications
- Validates amount is positive
- Validates transaction type
- Calculates `balance_after` correctly
- Inserts transaction and updates user balance in single transaction
- Returns success/failure status

```sql
SELECT bonus_balance FROM users WHERE id = p_user_id FOR UPDATE;
-- Calculate new balance
UPDATE users SET bonus_balance = v_new_balance WHERE id = p_user_id;
INSERT INTO bonus_transactions (...);
```

#### Layer 2.4: Existence Check Before Awarding
- Queries `bonus_transactions` to verify bonus hasn't been awarded yet
- Checks using `wallet_transaction_id` in metadata
- Only proceeds if no existing record found

```typescript
const { data: existingBonus } = await supabase
  .from('bonus_transactions')
  .select('id')
  .eq('user_id', paymentTx.user_id)
  .eq('transaction_type', 'topup_bonus')
  .eq('metadata->>wallet_transaction_id', walletTx.id)
  .maybeSingle();

if (!existingBonus) {
  // Award bonus using atomic function
}
```

### 3. Backend Webhook Verification (Laravel API)

#### Layer 3.1: Fiuu Webhook Signature Verification
- Laravel backend verifies Fiuu's webhook signature
- Ensures payment callbacks are genuinely from Fiuu
- Rejects spoofed or tampered requests

#### Layer 3.2: Payment Transaction Logging
- Laravel stores payment details in `payment_transactions` table
- Acts as source of truth for payment verification
- Frontend queries this when URL params are missing

## Exploitation Prevention Matrix

| Attack Vector | Prevention Layer | How It's Blocked |
|--------------|------------------|------------------|
| Refresh after payment | Session Storage + URL Cleanup | Already processed flag set, URL cleaned |
| Browser back button | Session Storage + URL Cleanup | Already processed flag set, URL cleaned |
| Multiple tabs | Database Status Check | Wallet transaction already marked success |
| Concurrent requests | Processing Flag + Row Locking | isProcessing flag + FOR UPDATE lock |
| Manual URL manipulation | Backend Verification | Laravel verifies with Fiuu, checks signatures |
| Race conditions | Atomic Function | Row-level locking ensures serialized updates |
| Duplicate bonus award | Unique Index | Database constraint prevents duplicates |
| Negative balance | Validation in Function | Atomic function validates before deducting |

## UI Update Implementation

### Problem
Bonus balance wasn't updating in the UI after payment because:
1. `useWallet` hook only listened to `wallet_transactions` changes
2. Bonus balance is stored in `users.bonus_balance`
3. No subscription to `users` table changes

### Solution

#### Solution 1: Real-time Subscription to Users Table
Added second subscription in `useWallet.ts`:

```typescript
const bonusChannel = supabase
  .channel('users_bonus_balance_changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: `id=eq.${user.id}`
    },
    (payload) => {
      console.log('[useWallet] User bonus_balance update received:', payload);
      loadWalletData();
    }
  )
  .subscribe();
```

#### Solution 2: Dependency on bonus_balance
Added `user?.bonus_balance` as dependency:

```typescript
useEffect(() => {
  if (user) {
    loadWalletData();
  }
}, [user, user?.bonus_balance]); // Re-load when bonus_balance changes
```

#### Solution 3: Manual Reload After Payment
PaymentCallback explicitly calls:
- `reloadBalance()` - Refreshes wallet data (including bonus)
- `refreshStars()` - Refreshes stars balance
- `reloadUser()` - Refreshes user data from AuthContext

```typescript
await new Promise(resolve => setTimeout(resolve, 1500));
await reloadBalance();
await refreshStars();
await reloadUser();
```

### Data Flow After Payment

1. Payment completed → Backend updates `users.bonus_balance`
2. PaymentCallback calls `reloadUser()` → AuthContext fetches fresh user data
3. AuthContext updates `user` object with new `bonus_balance`
4. `useWallet` hook detects `user?.bonus_balance` change → Calls `loadWalletData()`
5. Real-time subscription also triggers → Calls `loadWalletData()`
6. UI updates with new bonus balance

## Testing Checklist

- [x] Single payment completes successfully
- [x] Bonus balance updates in UI immediately
- [x] Refresh page after payment doesn't duplicate bonus
- [x] Browser back button doesn't duplicate bonus
- [x] Multiple tabs open during payment doesn't duplicate
- [x] Rapid clicking on payment button doesn't duplicate
- [x] Database constraint catches duplicates
- [x] Atomic function prevents race conditions
- [x] Balance_after is always calculated correctly
- [x] UI shows updated balance without page refresh

## Monitoring

### Success Indicators
- `[Payment Success] ✅ Bonus awarded successfully via atomic function`
- `[useWallet] User bonus_balance update received`
- `[Payment Success] ✅ All data refreshed, ready to navigate`

### Duplicate Prevention Logs
- `[PaymentCallback] Already processing, skipping duplicate call`
- `[PaymentCallback] Payment already processed in this session`
- `[Payment Success] Transaction already processed`
- `[Payment Success] Bonus already awarded (duplicate prevented by database constraint)`

### Error Indicators
- `Failed to award bonus atomically`
- `Atomic bonus update failed`
- `Insufficient bonus balance` (for deductions)

## Code References

- Frontend protection: `src/pages/PaymentCallback.tsx` (lines 140-178)
- Bonus awarding: `src/pages/PaymentCallback.tsx` (lines 455-505)
- Atomic function: `supabase/migrations/20251211065000_atomic_bonus_balance_updates.sql`
- UI updates: `src/hooks/useWallet.ts` (lines 15-79)
- Unique constraint: `supabase/migrations/20251209070351_cleanup_and_prevent_duplicate_rewards.sql`

## Summary

The system now has **7 layers of protection** against payment exploitation:
1. Processing flag (frontend)
2. Session storage check (frontend)
3. URL cleanup (frontend)
4. Wallet transaction status check (database)
5. Unique constraint (database)
6. Atomic function with row locking (database)
7. Backend webhook verification (Laravel)

And **3 mechanisms** for UI updates:
1. Real-time subscription to users table
2. Dependency tracking on bonus_balance
3. Manual reload calls after payment

This ensures users **cannot** exploit the system by:
- Refreshing the page
- Using browser back button
- Opening multiple tabs
- Manipulating URLs
- Race conditions
- Any other timing-based attacks

The bonus balance now updates **immediately** in the UI without requiring a page refresh.
