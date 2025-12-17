# Balance Display Reference - Quick Guide

## The 5 Core Values

Every component that displays balance information must show these 5 values from the master calculator:

| # | Value | Description | Data Type | Format |
|---|-------|-------------|-----------|--------|
| 1 | **Total Transactions** | Total count of all transactions | `number` | `123` |
| 2 | **Lifetime Topups** | Sum of all successful wallet topups | `number` | `RM 1,234.56` |
| 3 | **W Balance** | Current wallet balance | `number` | `RM 456.78` |
| 4 | **Bonus Balance** | Current bonus balance | `number` | `RM 123.45` |
| 5 | **Stars Balance** | Current stars balance | `number` | `12,345` |

---

## Component Implementation Map

Current status of components using the master balance calculator:

| Component | Path | Status | 5 Values Displayed |
|-----------|------|--------|-------------------|
| **Complete Transaction History** | `src/components/cms/TransactionDetailsModal.tsx` | ✅ **IMPLEMENTED** | ✅ All 5 |
| **Customer Detail Modal** | `src/components/cms/CustomerDetailModal.tsx` | ✅ **IMPLEMENTED** | ✅ All 5 |
| **Profile Page** | `src/pages/Profile.tsx` | ⏳ **PENDING** | ❌ None |
| **Home Page** | `src/pages/Home.tsx` | ⏳ **PENDING** | ❌ None |
| **Wallet Page** | `src/pages/Wallet.tsx` | ⏳ **PENDING** | ❌ None |
| **Stars Page** | `src/pages/Stars.tsx` | ⏳ **PENDING** | ❌ None |
| **CMS Customers List** | `src/pages/cms/CMSCustomers.tsx` | ⏳ **PENDING** | ❌ None |
| **CMS Dashboard** | `src/pages/cms/CMSDashboard.tsx` | ⏳ **PENDING** | ❌ None |

---

## Quick Implementation Guide

### Step 1: Import the Hook
```typescript
import { useMasterBalances } from '../../hooks/useMasterBalances';
```

### Step 2: Use in Component
```typescript
function MyComponent({ userId }: { userId: string }) {
  const { balances, loading, error, refresh } = useMasterBalances({
    userId: userId
  });

  if (loading) return <div>Loading balances...</div>;
  if (error) return <div>Error loading balances</div>;
  if (!balances) return null;

  return (
    <div>
      {/* Display the 5 values */}
    </div>
  );
}
```

### Step 3: Display the 5 Values

#### Minimal Display
```typescript
<div className="balance-summary">
  <div>Total Transactions: {balances.totalTransactions}</div>
  <div>Lifetime Topups: RM {balances.lifetimeTopup.toFixed(2)}</div>
  <div>W Balance: RM {balances.walletBalance.toFixed(2)}</div>
  <div>Bonus: RM {balances.bonusBalance.toFixed(2)}</div>
  <div>Stars: {balances.starsBalance.toLocaleString()}</div>
</div>
```

#### With Loading States
```typescript
<div className="balance-summary">
  <div className="balance-item">
    <span className="label">Total Transactions</span>
    <span className="value">
      {loading ? '...' : balances?.totalTransactions || 0}
    </span>
  </div>
  <div className="balance-item">
    <span className="label">Lifetime Topups</span>
    <span className="value">
      {loading ? '...' : `RM ${(balances?.lifetimeTopup || 0).toFixed(2)}`}
    </span>
  </div>
  <div className="balance-item">
    <span className="label">W Balance</span>
    <span className="value">
      {loading ? '...' : `RM ${(balances?.walletBalance || 0).toFixed(2)}`}
    </span>
  </div>
  <div className="balance-item">
    <span className="label">Bonus</span>
    <span className="value">
      {loading ? '...' : `RM ${(balances?.bonusBalance || 0).toFixed(2)}`}
    </span>
  </div>
  <div className="balance-item">
    <span className="label">Stars</span>
    <span className="value">
      {loading ? '...' : (balances?.starsBalance || 0).toLocaleString()}
    </span>
  </div>
</div>
```

#### With Refresh Button
```typescript
<div className="balance-header">
  <h3>Balance Summary</h3>
  <button onClick={refresh} disabled={loading}>
    {loading ? 'Refreshing...' : 'Refresh'}
  </button>
</div>
<div className="balance-grid">
  {/* 5 values here */}
</div>
```

---

## Advanced Features

### Auto-Refresh
```typescript
const { balances, loading } = useMasterBalances({
  userId: userId,
  autoRefresh: true,
  refreshInterval: 30000  // Refresh every 30 seconds
});
```

### Date Filtering
```typescript
const { balances, loading } = useMasterBalances({
  userId: userId,
  dateFilter: '2024-01-01T00:00:00Z'  // Only transactions after this date
});
```

### Verification and Sync
```typescript
import {
  verifyUserBalances,
  syncUserBalancesToDatabase
} from '../../services/masterBalanceCalculator';

async function handleVerify() {
  const verification = await verifyUserBalances(userId);

  if (hasDiscrepancies(verification)) {
    console.log('Discrepancies found!');
    // Show to user
  } else {
    console.log('All balances match!');
  }
}

async function handleSync() {
  await syncUserBalancesToDatabase(userId);
  await refresh();  // Refresh balances after sync
}
```

---

## Display Templates

### Card Layout (Recommended)
```typescript
<div className="grid grid-cols-5 gap-3">
  <div className="bg-white rounded-lg p-3 shadow-sm">
    <p className="text-xs font-bold text-gray-600 mb-1">Total Transactions</p>
    <p className="text-xl font-black text-gray-900">
      {balances?.totalTransactions || 0}
    </p>
  </div>

  <div className="bg-white rounded-lg p-3 shadow-sm">
    <p className="text-xs font-bold text-gray-600 mb-1">Lifetime Topups</p>
    <p className="text-xl font-black text-blue-600">
      RM {(balances?.lifetimeTopup || 0).toFixed(2)}
    </p>
  </div>

  <div className="bg-white rounded-lg p-3 shadow-sm">
    <p className="text-xs font-bold text-gray-600 mb-1">W Balance</p>
    <p className="text-xl font-black text-green-600">
      RM {(balances?.walletBalance || 0).toFixed(2)}
    </p>
  </div>

  <div className="bg-white rounded-lg p-3 shadow-sm">
    <p className="text-xs font-bold text-gray-600 mb-1">Bonus</p>
    <p className="text-xl font-black text-purple-600">
      RM {(balances?.bonusBalance || 0).toFixed(2)}
    </p>
  </div>

  <div className="bg-white rounded-lg p-3 shadow-sm">
    <p className="text-xs font-bold text-gray-600 mb-1">Stars</p>
    <p className="text-xl font-black text-yellow-600">
      {(balances?.starsBalance || 0).toLocaleString()}
    </p>
  </div>
</div>
```

### List Layout
```typescript
<div className="space-y-2">
  <div className="flex justify-between p-3 bg-gray-50 rounded">
    <span className="font-bold text-gray-700">Total Transactions</span>
    <span className="font-black">{balances?.totalTransactions || 0}</span>
  </div>

  <div className="flex justify-between p-3 bg-gray-50 rounded">
    <span className="font-bold text-gray-700">Lifetime Topups</span>
    <span className="font-black text-blue-600">
      RM {(balances?.lifetimeTopup || 0).toFixed(2)}
    </span>
  </div>

  <div className="flex justify-between p-3 bg-gray-50 rounded">
    <span className="font-bold text-gray-700">W Balance</span>
    <span className="font-black text-green-600">
      RM {(balances?.walletBalance || 0).toFixed(2)}
    </span>
  </div>

  <div className="flex justify-between p-3 bg-gray-50 rounded">
    <span className="font-bold text-gray-700">Bonus</span>
    <span className="font-black text-purple-600">
      RM {(balances?.bonusBalance || 0).toFixed(2)}
    </span>
  </div>

  <div className="flex justify-between p-3 bg-gray-50 rounded">
    <span className="font-bold text-gray-700">Stars</span>
    <span className="font-black text-yellow-600">
      {(balances?.starsBalance || 0).toLocaleString()}
    </span>
  </div>
</div>
```

### Compact Inline Display
```typescript
<div className="flex gap-4 text-sm">
  <div>
    <span className="text-gray-600">Transactions: </span>
    <span className="font-bold">{balances?.totalTransactions || 0}</span>
  </div>
  <div>
    <span className="text-gray-600">Lifetime: </span>
    <span className="font-bold text-blue-600">
      RM {(balances?.lifetimeTopup || 0).toFixed(2)}
    </span>
  </div>
  <div>
    <span className="text-gray-600">W: </span>
    <span className="font-bold text-green-600">
      RM {(balances?.walletBalance || 0).toFixed(2)}
    </span>
  </div>
  <div>
    <span className="text-gray-600">Bonus: </span>
    <span className="font-bold text-purple-600">
      RM {(balances?.bonusBalance || 0).toFixed(2)}
    </span>
  </div>
  <div>
    <span className="text-gray-600">Stars: </span>
    <span className="font-bold text-yellow-600">
      {(balances?.starsBalance || 0).toLocaleString()}
    </span>
  </div>
</div>
```

---

## Color Scheme Standards

Use these colors consistently across all components:

| Value | Color | Tailwind Class |
|-------|-------|----------------|
| Total Transactions | Gray | `text-gray-900` |
| Lifetime Topups | Blue | `text-blue-600` |
| W Balance | Green | `text-green-600` |
| Bonus | Purple | `text-purple-600` |
| Stars | Yellow | `text-yellow-600` |

---

## Common Patterns

### Pattern 1: Show Badge for Single Source of Truth
```typescript
<div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
  <CheckCircle className="w-4 h-4" />
  <span className="font-bold">Single Source of Truth: Calculated from Complete Transaction History</span>
</div>
```

### Pattern 2: Error Handling
```typescript
const { balances, loading, error } = useMasterBalances({ userId });

if (loading) {
  return <div className="animate-pulse">Loading balances...</div>;
}

if (error) {
  return (
    <div className="bg-red-50 border border-red-200 rounded p-4">
      <p className="text-red-700 font-bold">Error loading balances</p>
      <button onClick={refresh} className="mt-2 text-sm text-red-600 underline">
        Try Again
      </button>
    </div>
  );
}

if (!balances) {
  return <div>No balance data available</div>;
}
```

### Pattern 3: Combine with Transaction History
```typescript
const { balances, loading } = useMasterBalances({ userId });

// Access transaction history
const transactions = balances?.transactionHistory || [];

// Display both summary and history
return (
  <div>
    {/* 5 values summary */}
    <BalanceSummary balances={balances} loading={loading} />

    {/* Transaction history table */}
    <TransactionTable transactions={transactions} />
  </div>
);
```

---

## Migration Checklist

When updating an existing component to use master balances:

- [ ] Import `useMasterBalances` hook
- [ ] Remove old balance calculation functions
- [ ] Remove direct database queries for balances
- [ ] Replace balance displays with master balance values
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add refresh button
- [ ] Display all 5 core values
- [ ] Add "Single Source of Truth" badge
- [ ] Test thoroughly
- [ ] Update component documentation

---

## Don'ts

❌ **DON'T** calculate balances manually:
```typescript
// BAD
const walletBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
```

❌ **DON'T** query database for balance:
```typescript
// BAD
const { data } = await supabase
  .from('users')
  .select('w_balance')
  .eq('id', userId);
```

❌ **DON'T** use localStorage/sessionStorage for balances:
```typescript
// BAD
const balance = localStorage.getItem('walletBalance');
```

❌ **DON'T** trust database stored values without verification:
```typescript
// BAD - should verify first
return customer.w_balance;
```

---

## Dos

✅ **DO** use the master balances hook:
```typescript
// GOOD
const { balances } = useMasterBalances({ userId });
```

✅ **DO** display all 5 core values:
```typescript
// GOOD
<div>
  <div>Total Transactions: {balances.totalTransactions}</div>
  <div>Lifetime Topups: RM {balances.lifetimeTopup.toFixed(2)}</div>
  <div>W Balance: RM {balances.walletBalance.toFixed(2)}</div>
  <div>Bonus: RM {balances.bonusBalance.toFixed(2)}</div>
  <div>Stars: {balances.starsBalance.toLocaleString()}</div>
</div>
```

✅ **DO** add loading and error states:
```typescript
// GOOD
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage />;
```

✅ **DO** verify and sync when discrepancies found:
```typescript
// GOOD
const verification = await verifyUserBalances(userId);
if (hasDiscrepancies(verification)) {
  await syncUserBalancesToDatabase(userId);
}
```

---

## Support

For questions or issues:
1. Check `SINGLE_SOURCE_OF_TRUTH_IMPLEMENTATION.md` for detailed documentation
2. Review implemented components: `TransactionDetailsModal.tsx`, `CustomerDetailModal.tsx`
3. Test with the verification tools in CMS Customer Detail modal
4. Contact development team

---

## Quick Reference

**Master Calculator:** `src/services/masterBalanceCalculator.ts`
**React Hook:** `src/hooks/useMasterBalances.ts`
**Example Implementation:** `src/components/cms/CustomerDetailModal.tsx`

**The 5 Values:**
1. Total Transactions
2. Lifetime Topups
3. W Balance
4. Bonus Balance
5. Stars Balance

**All calculated from transaction history. No exceptions.**
