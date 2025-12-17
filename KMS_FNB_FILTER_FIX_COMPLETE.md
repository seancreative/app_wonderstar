# KMS F&B Order Display Fix - Complete

## Issue Identified
The KMS (Kitchen Management System) was not displaying any F&B orders due to a metadata field mismatch:
- **Cart items stored**: `metadata.category` (line 382 in ProductDetailModal.tsx)
- **KMS was checking**: `metadata.category_name` (line 144 in KMSKitchen.tsx)
- **Result**: All orders were being filtered out, even valid F&B orders

## Root Cause
When products are added to cart, the category name is stored in `metadata.category`, but the KMS filtering logic was looking for `metadata.category_name` which didn't exist. This caused the filter to always return an empty string, never matching any F&B categories.

## Changes Made

### 1. Fixed KMS Filter Logic (`src/pages/kms/KMSKitchen.tsx`)
**Lines 141-166**: Updated the F&B order filtering to:
- Check BOTH `metadata.category` and `metadata.category_name` for backward compatibility
- Added enhanced debugging logs to show sample item metadata
- Log total orders vs F&B orders for better visibility
- More robust filtering logic

```typescript
const categoryName = (item.metadata?.category || item.metadata?.category_name || '').toLowerCase();
```

### 2. Added Category Name to Cart Metadata (`src/components/ProductDetailModal.tsx`)
**Line 383**: Now stores both `category` and `category_name` in metadata for compatibility:
```typescript
metadata: {
  product_name: product.name,
  category: product.category,
  category_name: product.category, // Store both for compatibility
  category_id: product.category_id,
  ...
}
```

### 3. Updated ShopContext addToCart (`src/contexts/ShopContext.tsx`)
**Lines 325-334**: Ensures consistent metadata structure when adding products to cart:
```typescript
const categoryValue = product?.category || metadata.category;
const completeMetadata = {
  product_name: productName,
  category_id: product?.category_id || metadata.category_id,
  subcategory_id: product?.subcategory_id || metadata.subcategory_id,
  category: categoryValue,
  category_name: categoryValue, // Store both for compatibility
  ...
};
```

## What This Fixes

1. **Immediate Fix**: KMS now correctly reads category information from existing orders
2. **Future Compatibility**: New orders will have both `category` and `category_name` fields
3. **Backward Compatibility**: Works with both old orders (category) and new orders (category + category_name)
4. **Better Debugging**: Console logs now show metadata structure for troubleshooting

## F&B Category Detection
Orders are classified as F&B if their items contain categories with names matching:
- "food"
- "beverage"
- "f&b"
- "drink"

(Case-insensitive partial matching)

## How to Test

1. **Check Console Logs in KMS**:
   - Open browser DevTools Console
   - Navigate to KMS Kitchen page
   - Look for logs showing:
     ```
     [KMS Debug] Sample item metadata: { category: "...", category_name: "...", ... }
     [KMS] Loaded X total orders, Y F&B orders
     ```

2. **Create Test Order**:
   - Add food/beverage items to cart
   - Complete checkout with payment
   - Check if order appears in KMS

3. **Verify Existing Orders**:
   - Existing paid orders with F&B items should now appear in KMS
   - Check that they have correct category information in console logs

4. **Test Status Updates**:
   - Mark items as prepared
   - Update order status (preparing → ready → collected)
   - Verify fnbstatus updates correctly without affecting filtering

## Display Logic Update
**IMPORTANT**: KMS now displays ALL paid F&B orders regardless of status or fnbstatus:
- Removed status filter (previously filtered by `status IN ('ready', 'waiting_payment')`)
- Now shows ALL paid orders with F&B items
- Increased display limit from 50 to 100 orders
- Orders are sorted by creation date (newest first)

### Status Tracking
The `fnbstatus` field continues to work independently:
- Trigger automatically sets `fnbstatus = 'preparing'` when orders are confirmed
- Kitchen staff can update status through KMS interface
- Status transitions: `preparing` → `ready` → `collected`
- All status values are visible in the KMS display

## No Database Changes Required
This fix only required frontend code changes. No migrations or database schema changes were needed.

## Build Status
✅ Project builds successfully with no errors
✅ All TypeScript types are correct
✅ No breaking changes to existing functionality
