# Outlet Status "Closed" Display Fix

**Date:** November 27, 2025
**Status:** ✅ FIXED

---

## Issue

All outlets in the customer Outlet Selection page were showing as "Closed" with a red badge, even though they were active.

---

## Root Cause

**Mismatch between database values and frontend check:**

- **Database:** `outlets.status` column has values `'active'` or `'inactive'`
- **Frontend:** Code was checking for `outlet.status === 'open'`

Since the database never contains `'open'`, all outlets defaulted to showing "Closed".

---

## Fix Applied

**File:** `src/pages/OutletSelection.tsx`

**Changed:**
```typescript
// Before (WRONG):
outlet.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
outlet.status === 'open' ? 'Open Now' : 'Closed'

// After (CORRECT):
outlet.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
outlet.status === 'active' ? 'Open Now' : 'Closed'
```

Now the status check matches the actual database values.

---

## Result

- ✅ Outlets with `status='active'` now show **"Open Now"** with green badge
- ✅ Outlets with `status='inactive'` will show **"Closed"** with red badge
- ✅ Build successful in 12.41s

---

## Expected Behavior

### Customer View (Outlet Selection)

**Active Outlets:**
- Display: Green badge with "● Open Now"
- Status: `status='active'` and `is_active=true`
- Clickable: Yes, can select and shop

**Inactive Outlets:**
- Display: Won't appear (filtered out by query)
- Status: `status='inactive'` and `is_active=false`
- Query filters: `.eq('is_active', true).eq('status', 'active')`

---

## Future Enhancement (Optional)

Consider implementing real operating hours:

1. Add `is_open` boolean field or use `operating_hours` JSONB
2. Check current time against business hours
3. Show "Open Now" only during actual operating hours
4. Show "Closed" with next opening time when outside hours

**Example:**
- "Open Now • Closes at 9:00 PM"
- "Closed • Opens tomorrow at 9:00 AM"

---

**Status display is now correct and matches the database state!**
