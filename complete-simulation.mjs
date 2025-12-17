import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lfmfzvhonbjgmejrevat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4'
);

const products = [
  { product_id: 'P0047', name: 'ss', base_price: 88.00, category_id: 'd8b9676d-0361-4901-a69a-19a21529e0c2' },
  { product_id: 'P0042', name: 'Wonderpark Cap', base_price: 25.00, category_id: 'cc2eb497-8bae-4bca-9bef-e0afc2d6e408' }
];

console.log('\n' + '='.repeat(100));
console.log(' '.repeat(20) + 'SPECIAL DISCOUNT BADGE SIMULATION');
console.log('='.repeat(100) + '\n');

console.log('PRODUCTS WITH SPECIAL DISCOUNT ENABLED:');
console.log('-'.repeat(100));
products.forEach(p => {
  console.log('  ' + p.name + ' (ID: ' + p.product_id + ') - RM' + p.base_price.toFixed(2));
});

console.log('\n\n');
console.log('='.repeat(100));
console.log('SCENARIO 1: NO VOUCHER APPLIED');
console.log('='.repeat(100));

console.log('\n[VISUAL REPRESENTATION]\n');
products.forEach(p => {
  console.log('┌─────────────────────────────────┐');
  console.log('│ ' + p.name.padEnd(31) + ' │');
  console.log('│                                 │');
  console.log('│          [USE VOUCHER]    ◄── Red circular badge (clickable)');
  console.log('│                                 │');
  console.log('│   Price: RM' + p.base_price.toFixed(2).padEnd(19) + ' │  ◄── Original price only');
  console.log('└─────────────────────────────────┘');
  console.log('');
});

console.log('BEHAVIOR:');
console.log('  - Badge shows "USE VOUCHER" in red circular badge');
console.log('  - Badge is CLICKABLE - takes user to Stars/Voucher page');
console.log('  - Only original price is shown (no strikethrough)');
console.log('  - Purpose: Prompt user to apply a special discount voucher\n\n');

console.log('='.repeat(100));
console.log('SCENARIO 2: SPECIAL DISCOUNT VOUCHER APPLIED');
console.log('='.repeat(100));

console.log('\nVoucher Applied: DISCOUNT5 (Special Discount Type)\n');
console.log('[VISUAL REPRESENTATION]\n');
products.forEach(p => {
  const discounted = p.base_price - 5;
  console.log('┌─────────────────────────────────┐');
  console.log('│ ' + p.name.padEnd(31) + ' │');
  console.log('│                                 │');
  console.log('│              [-RM5]       ◄── Red circular badge (NOT clickable)');
  console.log('│                                 │');
  console.log('│   Price: RM' + p.base_price.toFixed(2) + ' ────────    │  ◄── Original price (strikethrough)');
  console.log('│          RM' + discounted.toFixed(2) + ' (RED)         │  ◄── Discounted price in RED');
  console.log('└─────────────────────────────────┘');
  console.log('');
});

console.log('BEHAVIOR:');
console.log('  - Badge shows "-RM5" in red circular badge');
console.log('  - Badge is NOT clickable (static display)');
console.log('  - Original price shown with strikethrough');
console.log('  - Discounted price (original - RM5) shown in RED');
console.log('  - Purpose: Show active RM5 discount on this product\n\n');

console.log('='.repeat(100));
console.log('SCENARIO 3: OTHER VOUCHER TYPES APPLIED');
console.log('='.repeat(100));

console.log('\nExample A: By Category Voucher Applied (10% OFF Food Category)');
console.log('Example B: By Product Voucher Applied (RM5 OFF specific products)');
console.log('Example C: By Subcategory Voucher Applied (15% OFF Beverages)\n');

console.log('[VISUAL REPRESENTATION]\n');
products.forEach(p => {
  console.log('┌─────────────────────────────────┐');
  console.log('│ ' + p.name.padEnd(31) + ' │');
  console.log('│                                 │');
  console.log('│            (no badge)     ◄── NO badge shown at all');
  console.log('│                                 │');
  console.log('│   Price: RM' + p.base_price.toFixed(2).padEnd(19) + ' │  ◄── Original price only');
  console.log('└─────────────────────────────────┘');
  console.log('');
});

console.log('BEHAVIOR:');
console.log('  - NO badge is shown (completely hidden)');
console.log('  - Only original price is shown (no strikethrough)');
console.log('  - The voucher discount applies at CHECKOUT, not on product card');
console.log('  - Purpose: Avoid confusion - these vouchers dont give special RM5 badge discount');
console.log('  - Note: If product matches voucher criteria, discount applies during checkout\n\n');

console.log('='.repeat(100));
console.log('SUMMARY TABLE');
console.log('='.repeat(100) + '\n');

console.log('┌─────────────────────────┬─────────────────────┬────────────────────────────┬─────────────────┐');
console.log('│ Scenario                │ Badge Display       │ Price Display              │ Badge Clickable │');
console.log('├─────────────────────────┼─────────────────────┼────────────────────────────┼─────────────────┤');
console.log('│ 1. No Voucher           │ [USE VOUCHER]       │ RM88.00 (original only)    │ YES             │');
console.log('│                         │ Red circle          │                            │ (go to vouchers)│');
console.log('├─────────────────────────┼─────────────────────┼────────────────────────────┼─────────────────┤');
console.log('│ 2. Special Discount     │ [-RM5]              │ RM88.00 → RM83.00 (red)    │ NO              │');
console.log('│    Voucher Applied      │ Red circle          │ (strikethrough original)   │ (static badge)  │');
console.log('├─────────────────────────┼─────────────────────┼────────────────────────────┼─────────────────┤');
console.log('│ 3. Other Vouchers       │ HIDDEN              │ RM88.00 (original only)    │ N/A             │');
console.log('│    (category/product)   │ (no badge at all)   │ (discount at checkout)     │ (no badge)      │');
console.log('└─────────────────────────┴─────────────────────┴────────────────────────────┴─────────────────┘');

console.log('\n\n');
console.log('='.repeat(100));
console.log('IMPLEMENTATION NOTES');
console.log('='.repeat(100) + '\n');

console.log('1. CHECK APPLIED VOUCHER:');
console.log('   - Get user\'s currently applied voucher code from user_preferences');
console.log('   - Fetch voucher details including restriction_type');
console.log('');

console.log('2. CONDITIONAL BADGE RENDERING:');
console.log('   if (no voucher applied) {');
console.log('     → Show "USE VOUCHER" badge (clickable)');
console.log('   }');
console.log('   else if (voucher.restriction_type === "special_discount") {');
console.log('     → Show "-RM5" badge (not clickable)');
console.log('     → Show strikethrough original price + red discounted price');
console.log('   }');
console.log('   else if (voucher.restriction_type in ["by_category", "by_product", "by_subcategory"]) {');
console.log('     → HIDE badge completely');
console.log('     → Show only original price');
console.log('   }');
console.log('');

console.log('3. FILES TO MODIFY:');
console.log('   - src/pages/ShopMenu.tsx (product card rendering logic)');
console.log('   - Check appliedVoucher state and voucher restriction_type');
console.log('   - Conditionally render badge based on above logic');
console.log('');

console.log('='.repeat(100) + '\n');
