# KMS Display Fix - Complete Implementation

## Problem
The Kitchen Management System (KMS) wasn't displaying F&B orders, even though they existed in the database with correct payment status and fnbstatus values.

## Root Causes Identified
1. **Restrictive Query Limit**: Only fetching 100 orders which might not include older orders
2. **Outlet Filtering**: Only showing orders for the selected outlet with no option to view all outlets
3. **Limited Category Detection**: Only checking specific keywords in metadata.category
4. **No Debugging Info**: No visibility into what was being filtered out at each step

## Solutions Implemented

### 1. Enhanced Query System
- **Increased limit** from 100 to 500 orders to capture more historical data
- **Added "Show All Outlets" toggle** to view orders across all outlets, not just the selected one
- **Conditional outlet filtering** that respects the toggle state

### 2. Comprehensive Category Detection
Enhanced F&B item detection to check multiple locations:
```typescript
const categoryName = (
  item.metadata?.category ||
  item.metadata?.category_name ||
  item.category ||
  item.category_name ||
  ''
).toLowerCase().trim();
```

Added more keywords for detection:
- food, beverage, f&b, fnb
- drink, meal, snack
- Also checks subcategory fields

### 3. Debug Information Panel
Added comprehensive debug panel showing:
- Total orders fetched from database
- F&B orders after filtering
- Selected outlet
- Status breakdown (preparing, ready, collected, cancelled)
- Sample order categories
- Expandable detailed JSON view

### 4. Better Modifier Display
Enhanced modifier formatting to handle both:
- Array-based modifiers (current format)
- Object-based modifiers (legacy format)

Properly displays selected options from the new modifier system.

### 5. Outlet Indicators
When viewing all outlets, each order card now shows which outlet it belongs to.

### 6. Real-time Updates
Updated the real-time subscription to work correctly whether viewing:
- Single outlet (filtered subscription)
- All outlets (unfiltered subscription)

## Current Database Status

Verification script results:
```
Total paid orders: 10
Orders with F&B items: 5
```

### F&B Orders Currently Available:
1. **WP24770306** - ITALIANO TIRAMISU (WONDERPARK MELAKA) - preparing
2. **WP24743750** - INSTAMEE LUXURY (WONDERPARK MELAKA) - preparing
3. **WP22757158** - INSTAMEE LUXURY (WONDERPARK MELAKA) - preparing
4. **WP22711975** - HONEY BOBA + INSTAMEE LUXURY (WONDERPARK MELAKA) - preparing
5. **WP05643422** - INSTAMEE LUXURY (WONDERPARK MELAKA) - preparing

## How to Use

### For Kitchen Staff:
1. Login to KMS at `/kms/kitchen`
2. Select your outlet from the dropdown (if admin)
3. Click **"Current Outlet"** button to toggle to **"All Outlets"** to see orders from all locations
4. Use status filters to view:
   - All Orders (excludes cancelled)
   - Preparing
   - Ready
   - Collected
5. Click status buttons on each order card to update F&B status
6. Check/uncheck individual items as they're prepared
7. Click "Mark All Complete" to finish an order

### Debug Panel:
- Shows real-time statistics about orders being displayed
- Click "View Debug Details" to see raw data including categories
- Useful for troubleshooting if orders aren't appearing

## Technical Details

### Query Changes:
```typescript
// Old query
.eq('outlet_id', selectedOutletId)
.eq('payment_status', 'paid')
.limit(100)

// New query
.eq('payment_status', 'paid')
.limit(500)
// Conditionally add outlet filter only if not showing all outlets
if (!showAllOutlets && selectedOutletId) {
  query = query.eq('outlet_id', selectedOutletId);
}
```

### Files Modified:
- `/src/pages/kms/KMSKitchen.tsx` - Main KMS page with all enhancements

### New Features:
- Show All Outlets toggle
- Debug information panel
- Enhanced category detection
- Better modifier display
- Outlet indicators on order cards
- Increased order history (500 orders)

## Verification

Run the verification script to check database status:
```bash
SUPABASE_URL="..." SUPABASE_ANON_KEY="..." node verify-kms-orders.mjs
```

This will show:
- All paid orders in the system
- Which ones have F&B items
- Current outlet assignments
- F&B status for each order

## Next Steps

If orders still don't appear:
1. Check the debug panel for filtering information
2. Verify the order has `payment_status='paid'`
3. Confirm items have `category='F&B'` in their metadata
4. Toggle "All Outlets" to see if it's an outlet filtering issue
5. Check browser console for `[KMS]` debug logs

## Summary

The KMS now shows **all previous F&B orders** with:
- Up to 500 orders of history
- Option to view across all outlets
- Comprehensive filtering by status
- Real-time updates
- Debug information for troubleshooting
- Enhanced category detection
- Better display of modifiers

All 5 current F&B orders in the database should now be visible in the KMS interface.
