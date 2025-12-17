# Bonus Transactions Data Cleanup Guide

## Overview

This guide addresses the historical data issue where shop orders with `applied_bonus_amount > 0` were processed without creating corresponding transaction records in the `bonus_transactions` table. This breaks the Single Source of Truth integrity where all balances must be calculated from transaction history.

## Problem Statement

**Issue**: Prior to implementing atomic bonus balance updates, the ShopCheckout system directly modified `users.bonus_balance` without creating transaction records.

**Impact**:
- Master balance calculator shows incorrect bonus balance for affected users
- Transaction audit trail is incomplete
- Cannot accurately reconstruct historical balance states
- Users may see discrepancies between actual usage and transaction history

## Detection Query

### Step 1: Find All Affected Orders

```sql
-- Find shop orders with bonus applied but no transaction record
SELECT
  so.id,
  so.order_number,
  so.user_id,
  u.username,
  u.email,
  so.applied_bonus_amount,
  so.created_at as order_date,
  so.confirmed_at,
  so.order_status
FROM shop_orders so
INNER JOIN users u ON u.id = so.user_id
WHERE so.applied_bonus_amount > 0
  AND so.order_status IN ('confirmed', 'preparing', 'ready', 'completed')
  AND NOT EXISTS (
    SELECT 1
    FROM bonus_transactions bt
    WHERE bt.order_number = so.order_number
      AND bt.transaction_type = 'spend'
  )
ORDER BY so.created_at DESC;
```

### Step 2: Count Affected Users

```sql
-- Count unique users affected
SELECT
  COUNT(DISTINCT user_id) as affected_users,
  COUNT(*) as affected_orders,
  SUM(applied_bonus_amount) as total_missing_deductions
FROM shop_orders
WHERE applied_bonus_amount > 0
  AND order_status IN ('confirmed', 'preparing', 'ready', 'completed')
  AND NOT EXISTS (
    SELECT 1
    FROM bonus_transactions bt
    WHERE bt.order_number = shop_orders.order_number
      AND bt.transaction_type = 'spend'
  );
```

## Backfill Script

### Option A: Create Missing Transaction Records Only

This option creates the missing transaction records but does NOT recalculate balances. Use this if you want to preserve current bonus_balance values as-is.

```sql
-- Backfill missing bonus transaction records
-- This preserves current bonus_balance as cached values
INSERT INTO bonus_transactions (
  user_id,
  order_id,
  amount,
  transaction_type,
  order_number,
  description,
  balance_after,
  metadata,
  created_at
)
SELECT
  so.user_id,
  so.id,
  so.applied_bonus_amount,
  'spend',
  so.order_number,
  'Historical bonus spend on order ' || so.order_number,
  NULL, -- We don't know the historical balance_after
  jsonb_build_object(
    'shop_order_id', so.id,
    'outlet_id', so.outlet_id,
    'backfilled', true,
    'backfill_date', now(),
    'original_order_date', so.created_at,
    'note', 'Backfilled transaction for historical data integrity'
  ),
  so.confirmed_at -- Use confirmed_at as transaction timestamp
FROM shop_orders so
WHERE so.applied_bonus_amount > 0
  AND so.order_status IN ('confirmed', 'preparing', 'ready', 'completed')
  AND so.confirmed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM bonus_transactions bt
    WHERE bt.order_number = so.order_number
      AND bt.transaction_type = 'spend'
  )
ORDER BY so.confirmed_at ASC;

-- Log the backfill operation
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % missing bonus transaction records', v_count;
END $$;
```

### Option B: Full Recalculation with Historical Balance Reconstruction

This option recalculates `balance_after` for ALL transactions chronologically. More accurate but complex.

```sql
-- Step 1: Create temporary table with all transactions in chronological order
CREATE TEMP TABLE temp_bonus_chronological AS
SELECT
  bt.id,
  bt.user_id,
  bt.created_at,
  bt.amount,
  bt.transaction_type,
  ROW_NUMBER() OVER (PARTITION BY bt.user_id ORDER BY bt.created_at ASC, bt.id ASC) as seq
FROM bonus_transactions bt
ORDER BY bt.user_id, bt.created_at ASC, bt.id ASC;

-- Step 2: Calculate running balance for each user
CREATE TEMP TABLE temp_bonus_balances AS
WITH RECURSIVE running_balance AS (
  -- Base case: first transaction for each user
  SELECT
    tc.id,
    tc.user_id,
    tc.created_at,
    tc.amount,
    tc.transaction_type,
    tc.seq,
    CASE
      WHEN tc.transaction_type IN ('spend', 'revoke') THEN -tc.amount
      ELSE tc.amount
    END as balance_after
  FROM temp_bonus_chronological tc
  WHERE tc.seq = 1

  UNION ALL

  -- Recursive case: subsequent transactions
  SELECT
    tc.id,
    tc.user_id,
    tc.created_at,
    tc.amount,
    tc.transaction_type,
    tc.seq,
    rb.balance_after + CASE
      WHEN tc.transaction_type IN ('spend', 'revoke') THEN -tc.amount
      ELSE tc.amount
    END
  FROM temp_bonus_chronological tc
  INNER JOIN running_balance rb
    ON tc.user_id = rb.user_id
    AND tc.seq = rb.seq + 1
)
SELECT * FROM running_balance;

-- Step 3: Update balance_after in bonus_transactions
UPDATE bonus_transactions bt
SET balance_after = tbb.balance_after
FROM temp_bonus_balances tbb
WHERE bt.id = tbb.id;

-- Step 4: Sync final balance to users table
UPDATE users u
SET bonus_balance = (
  SELECT balance_after
  FROM bonus_transactions bt
  WHERE bt.user_id = u.id
  ORDER BY bt.created_at DESC, bt.id DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM bonus_transactions bt WHERE bt.user_id = u.id
);

-- Cleanup
DROP TABLE temp_bonus_chronological;
DROP TABLE temp_bonus_balances;
```

## Verification Process

### Step 1: Verify All Orders Have Transactions

```sql
-- Should return 0 rows after cleanup
SELECT
  order_number,
  applied_bonus_amount,
  order_status,
  created_at
FROM shop_orders
WHERE applied_bonus_amount > 0
  AND order_status IN ('confirmed', 'preparing', 'ready', 'completed')
  AND NOT EXISTS (
    SELECT 1
    FROM bonus_transactions bt
    WHERE bt.order_number = shop_orders.order_number
      AND bt.transaction_type = 'spend'
  );
```

### Step 2: Verify Balance Consistency

Use the verification script to check each user:

```javascript
// File: verify-bonus-balance-consistency.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function verifyAllUsers() {
  console.log('🔍 Verifying bonus balance consistency for all users...\n');

  // Get all users with bonus transactions
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, email, bonus_balance')
    .not('bonus_balance', 'is', null)
    .order('username');

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log(`Found ${users.length} users with bonus balance\n`);

  let consistentCount = 0;
  let inconsistentCount = 0;
  const issues = [];

  for (const user of users) {
    // Calculate balance from transactions
    const { data: transactions } = await supabase
      .from('bonus_transactions')
      .select('amount, transaction_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    let calculatedBalance = 0;

    for (const tx of transactions || []) {
      if (tx.transaction_type === 'spend' || tx.transaction_type === 'revoke') {
        calculatedBalance -= parseFloat(tx.amount);
      } else {
        calculatedBalance += parseFloat(tx.amount);
      }
    }

    calculatedBalance = Math.max(0, calculatedBalance);

    const cachedBalance = parseFloat(user.bonus_balance || 0);
    const difference = Math.abs(calculatedBalance - cachedBalance);

    if (difference < 0.01) {
      consistentCount++;
      console.log(`✅ ${user.username}: Consistent (${cachedBalance.toFixed(2)})`);
    } else {
      inconsistentCount++;
      console.log(`❌ ${user.username}: MISMATCH`);
      console.log(`   Cached: ${cachedBalance.toFixed(2)}`);
      console.log(`   Calculated: ${calculatedBalance.toFixed(2)}`);
      console.log(`   Difference: ${difference.toFixed(2)}\n`);

      issues.push({
        user_id: user.id,
        username: user.username,
        email: user.email,
        cached_balance: cachedBalance,
        calculated_balance: calculatedBalance,
        difference: difference,
        transaction_count: transactions?.length || 0
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   ✅ Consistent: ${consistentCount} users`);
  console.log(`   ❌ Inconsistent: ${inconsistentCount} users`);
  console.log(`   📈 Total: ${users.length} users\n`);

  if (issues.length > 0) {
    console.log('⚠️  USERS WITH INCONSISTENT BALANCES:');
    console.table(issues);
  }
}

verifyAllUsers();
```

Run with: `node verify-bonus-balance-consistency.mjs`

### Step 3: Sync Cached Values

If inconsistencies are found, sync the cached values:

```sql
-- Sync all users' bonus_balance from calculated values
UPDATE users u
SET bonus_balance = COALESCE(
  (
    SELECT SUM(
      CASE
        WHEN bt.transaction_type IN ('spend', 'revoke') THEN -bt.amount
        ELSE bt.amount
      END
    )
    FROM bonus_transactions bt
    WHERE bt.user_id = u.id
  ),
  0
),
updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT user_id FROM bonus_transactions
);
```

## Testing Checklist

After running the backfill:

- [ ] **Detection Query Returns 0 Rows**: No more orders with missing transactions
- [ ] **All Users Balance Consistent**: Verification script shows 100% consistency
- [ ] **Transaction Count Matches**: Count of bonus_transactions matches expected based on shop_orders
- [ ] **Master Balance Calculator Works**: Frontend displays correct bonus balance for all users
- [ ] **Balance History Accurate**: Can reconstruct balance at any point in time from transactions
- [ ] **Audit Trail Complete**: Every bonus spend has corresponding transaction record with metadata

## Frontend Verification

After cleanup, verify in the application:

1. **Navigate to Profile Page**: Check that bonus balance displays correctly
2. **Check Wallet Page**: Verify "All 5 Core Values" section shows consistent data
3. **Review Transaction History**: Confirm all historical bonus spends appear in CMS → Financial
4. **Test New Orders**: Place test order with bonus to ensure new transactions work correctly
5. **Verify CMS Customers**: Check customer detail modal shows accurate transaction history

## Rollback Plan

If issues occur after backfill:

```sql
-- Rollback: Delete all backfilled transactions
DELETE FROM bonus_transactions
WHERE metadata->>'backfilled' = 'true';

-- Restore previous state
-- (Make sure to backup before running cleanup!)
```

## Best Practices Going Forward

1. **Always Use Atomic Functions**: Use `update_bonus_balance_atomic` for all bonus balance changes
2. **Never Direct Update**: Never directly UPDATE `users.bonus_balance` column
3. **Verify Transactions**: After any balance operation, verify transaction was created
4. **Monitor Consistency**: Run verification script weekly to catch any new issues
5. **Use Master Calculator**: Always display balances from `useMasterBalances()` hook

## Support

If you encounter issues during cleanup:

1. Check the logs for any SQL errors
2. Run the verification script to identify specific problem users
3. Review the metadata field in bonus_transactions for backfill_date to identify backfilled records
4. Consult the `SINGLE_SOURCE_OF_TRUTH_IMPLEMENTATION.md` document for architecture details
