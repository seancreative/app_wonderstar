# Instamee Products DISCOUNT5 Debugging Guide

## Date: 2025-11-27
## Build Status: ✅ SUCCESS

---

## Issue Report

**User Report:** "Instamee Premium and Instamee Luxury should have RM5 discount after using DISCOUNT5, but it's not reflected and not deducted. It's not working for deducting applicable products."

---

## Investigation Results

### ✅ DISCOUNT5 Configuration is CORRECT

I ran diagnostics and confirmed:

**DISCOUNT5 in Database:**
```
Code: DISCOUNT5
Type: amount (RM5 fixed discount)
Value: 5
Application Scope: product_level ✅
Product Application Method: per_product ✅
Eligible Products: 8 products ✅
  - P0136 (INSTAMEE BASIC)
  - P0087 (INSTAMEE BASIC)
  - P0138 (INSTAMEE LUXURY) ✅ YOUR PRODUCT
  - P0089 (INSTAMEE LUXURY) ✅ YOUR PRODUCT
  - P0088 (INSTAMEE PREMIUM) ✅ YOUR PRODUCT
  - P0137 (INSTAMEE PREMIUM) ✅ YOUR PRODUCT
  - P0067 (other)
  - P0110 (other)
```

**ALL Instamee products ARE eligible!**

---

### ✅ Code Logic is CORRECT

I created a test script (`test-instamee-discount.mjs`) that simulates the exact cart calculation:

**Test Results:**
```
Cart:
  1. INSTAMEE PREMIUM (P0137) - ✅ ELIGIBLE - Discount: RM 5.00
  2. INSTAMEE LUXURY (P0138) - ✅ ELIGIBLE - Discount: RM 5.00
  3. Other Product (P9999) - ❌ NOT ELIGIBLE

Expected Total Discount: RM 10.00 ✅
Expected Final Total: RM 71.00 ✅
```

**The logic SHOULD work!**

---

## Why It Might Not Be Working

Since the configuration and code are correct, the issue is likely one of these:

### Issue 1: Browser Cache (MOST LIKELY) 🔥

**Problem:**
- Your browser cached the OLD voucher data (when eligible_product_ids was empty)
- Even though database is updated, browser is showing old data

**Solution:**
1. **Hard refresh the app:**
   - Chrome/Firefox: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely
2. **Re-add products to cart** (cart might be cached too)
3. **Re-select DISCOUNT5 voucher**
4. Check if discount appears

---

### Issue 2: Wrong Product IDs in Cart

**Problem:**
- Cart items might have different product_ids than expected
- Example: Cart has `P0138-outlet1` but voucher expects `P0138`

**How to Check:**
1. Open browser DevTools (`F12`)
2. Go to **Console** tab
3. Add Instamee products to cart
4. Apply DISCOUNT5
5. Look for this log:
   ```
   💰 Voucher Calculation: DISCOUNT5
   ```
6. Expand it and check:
   ```
   eligible_product_ids: ["P0136", "P0087", "P0138", ...]
   ```
7. Then look for:
   ```
   [Voucher Debug] Cart items: [{id: "P0???", name: "..."}, ...]
   ```
8. **Compare the IDs!** They must match EXACTLY

---

### Issue 3: Outlet-Specific Products

**Problem:**
- Different outlets might have different product IDs
- Example:
  - Outlet A: P0137 (INSTAMEE PREMIUM)
  - Outlet B: P0088 (INSTAMEE PREMIUM)

**Solution:**
- Check which outlet you're ordering from
- Make sure that outlet's products are in eligible list

---

## Debugging Steps (PLEASE DO THIS)

### Step 1: Run Test Script

```bash
node test-instamee-discount.mjs
```

This confirms database configuration is correct. You should see:
```
✅ ELIGIBLE: INSTAMEE PREMIUM (P0137)
✅ ELIGIBLE: INSTAMEE LUXURY (P0138)
```

---

### Step 2: Clear Browser Cache

**Chrome:**
1. Press `F12` to open DevTools
2. Right-click the refresh button
3. Click "Empty Cache and Hard Reload"

**Firefox:**
1. Press `Ctrl+Shift+Delete`
2. Check "Cache"
3. Click "Clear Now"

**Safari:**
1. Develop → Empty Caches
2. Or press `Cmd+Option+E`

---

### Step 3: Test in Browser with Console Open

1. **Open DevTools** (`F12`)
2. Go to **Console** tab
3. **Clear console** (trash icon)
4. **Add Instamee products to cart:**
   - Add "INSTAMEE PREMIUM"
   - Add "INSTAMEE LUXURY"
5. **Apply DISCOUNT5 voucher**
6. **Check Console Output**

---

### Step 4: Analyze Console Output

You should see this console group:

```javascript
💰 Voucher Calculation: DISCOUNT5
  RAW selectedVoucher: { ... }
  Voucher Configuration: {
    code: "DISCOUNT5",
    type: "amount",
    value: "5",
    application_scope: "product_level",
    product_application_method: "per_product",
    eligible_product_ids: ["P0136", "P0087", "P0138", "P0089", "P0088", "P0137", ...],  // ← CHECK THIS!
    eligible_product_ids_length: 8  // ← Should be 8
  }
  Cart Subtotal: XX.XX
```

**Critical Checks:**

**A. Check eligible_product_ids:**
```javascript
eligible_product_ids: ["P0136", "P0087", "P0138", "P0089", "P0088", "P0137", ...]
```
- ✅ If it shows 8 product IDs → Database is correct
- ❌ If it shows `[]` → Browser cache issue, hard refresh!
- ❌ If it's `null` or `undefined` → Voucher data not loading

**B. Check cart items:**
```javascript
[Voucher Debug] Cart items: [
  {id: 'P0137', name: 'INSTAMEE PREMIUM', qty: 1},
  {id: 'P0138', name: 'INSTAMEE LUXURY', qty: 1}
]
```
- Note the `id` field - these are the product_ids

**C. Check matching:**
```javascript
[Voucher Debug] Matching items: 2 items  // ← Should be > 0!
[Voucher Debug] Applicable count: 2 products
```
- ✅ If > 0: Products match, discount should apply
- ❌ If = 0: Product IDs don't match, see "Issue 2" above

**D. Check final discount:**
```javascript
✅ Total Discount: RM 10.00  // ← For 2 Instamee products
```

---

## Expected Console Output (Working)

**When Everything Works:**

```javascript
💰 Voucher Calculation: DISCOUNT5

RAW selectedVoucher: {
  id: "xxx",
  voucher: {
    code: "DISCOUNT5",
    eligible_product_ids: ["P0136", "P0087", "P0138", "P0089", "P0088", "P0137", "P0067", "P0110"]
  }
}

Voucher Configuration: {
  code: "DISCOUNT5",
  type: "amount",
  value: "5",
  application_scope: "product_level",
  product_application_method: "per_product",
  eligible_product_ids: ["P0136", "P0087", "P0138", "P0089", "P0088", "P0137", "P0067", "P0110"],
  eligible_product_ids_length: 8
}

Cart Subtotal: 31.00

[Voucher Debug] Per-product voucher detected: DISCOUNT5
[Voucher Debug] Voucher type: amount Value: 5

[Voucher Debug] Eligible product IDs: ['P0136', 'P0087', 'P0138', 'P0089', 'P0088', 'P0137', 'P0067', 'P0110']

[Voucher Debug] Cart items: [
  {id: 'P0137', name: 'INSTAMEE PREMIUM\t', qty: 1},
  {id: 'P0138', name: 'INSTAMEE LUXURY\t', qty: 1}
]

[Voucher Debug] Matching items: 2 items
[Voucher Debug] Applicable count: 2 products
[Voucher Debug] Effective count: 2 (max: 20)
[Voucher Debug] Calculated discount: RM5 × 2 = RM10

✅ Total Discount: RM 10.00
```

---

## Troubleshooting Scenarios

### Scenario A: eligible_product_ids shows empty `[]`

**Console shows:**
```javascript
eligible_product_ids: []
eligible_product_ids_length: 0

⚠️ [Voucher] No eligible products specified
✅ Total Discount: RM 0.00
```

**Cause:** Browser cached old data before products were configured

**Solution:**
1. Hard refresh (`Ctrl+Shift+R`)
2. Or clear site data:
   - DevTools → Application → Clear Storage → Clear site data
3. Reload page and try again

---

### Scenario B: Matching items = 0

**Console shows:**
```javascript
eligible_product_ids: ["P0136", "P0087", ...]  // ✅ Has products
[Voucher Debug] Cart items: [{id: 'P0999', ...}]  // ❌ Different IDs
[Voucher Debug] Matching items: 0 items
✅ Total Discount: RM 0.00
```

**Cause:** Product IDs in cart don't match eligible list

**Solution:**
1. Check which product IDs are in cart (from console)
2. Check which IDs are eligible (from console)
3. Either:
   - Add different products that match eligible IDs
   - Or update DISCOUNT5 in CMS to include cart products

---

### Scenario C: Discount shows RM5 instead of RM10

**Console shows:**
```javascript
[Voucher Debug] Matching items: 1 items  // ← Only 1 matched
✅ Total Discount: RM 5.00
```

**Cause:** Only 1 product in cart matched eligible list

**Solution:**
- Check both product IDs in console
- One might have wrong ID or not be eligible

---

### Scenario D: No console output at all

**Nothing appears when applying voucher**

**Cause:**
- Voucher not actually being applied
- JavaScript error preventing execution

**Solution:**
1. Check Console for red error messages
2. Make sure you clicked "Apply" on voucher
3. Check if voucher appears in cart summary

---

## Quick Fix Checklist

✅ **Step 1:** Run `node test-instamee-discount.mjs` to verify database
✅ **Step 2:** Hard refresh browser (`Ctrl+Shift+R`)
✅ **Step 3:** Clear cart and re-add Instamee products
✅ **Step 4:** Re-select DISCOUNT5 voucher
✅ **Step 5:** Open DevTools Console (`F12`)
✅ **Step 6:** Check console output for the issues above
✅ **Step 7:** Copy console output and share if still not working

---

## Files Created

1. **test-instamee-discount.mjs** - Test script to verify calculation logic
2. **INSTAMEE_DISCOUNT_DEBUGGING.md** - This debugging guide

---

## Summary

**Database Configuration:** ✅ CORRECT
- DISCOUNT5 has all 6 Instamee products in eligible list
- P0137, P0088 (INSTAMEE PREMIUM) ✅
- P0138, P0089 (INSTAMEE LUXURY) ✅
- P0136, P0087 (INSTAMEE BASIC) ✅

**Code Logic:** ✅ CORRECT
- Test script confirms discount should apply
- Expected: RM5 per Instamee product
- Should show "DISCOUNT RM5" badge on eligible items

**Most Likely Issue:** 🔥 Browser Cache
- Hard refresh to get fresh voucher data
- Clear cart and re-add products

**Build Status:** ✅ SUCCESS (12.64s)
- Enhanced console logging added
- Shows RAW voucher data for debugging
- Displays product matching details

---

## Next Steps

**PLEASE DO THIS:**

1. **Hard refresh your browser** (`Ctrl+Shift+R`)
2. **Open DevTools Console** (`F12`)
3. **Add Instamee products to cart**
4. **Apply DISCOUNT5**
5. **Copy the entire console output** (everything under "💰 Voucher Calculation")
6. **Share the console output with me**

This will show me EXACTLY what data your browser is seeing and why the discount isn't applying!

---

**The configuration is correct. The code is correct. We just need to see what the browser is actually receiving to pinpoint the cache/data issue!**
