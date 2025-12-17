import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lfmfzvhonbjgmejrevat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4'
);

const { data: products } = await supabase
  .from('shop_products')
  .select('product_id, name, base_price, special_discount, category_id, subcategory_id')
  .eq('special_discount', true)
  .eq('is_active', true);

const { data: vouchers } = await supabase
  .from('vouchers')
  .select('*')
  .eq('is_active', true);

console.log('\n' + '='.repeat(80));
console.log('SIMULATION: Products with Special Discount - Different Voucher Scenarios');
console.log('='.repeat(80) + '\n');

console.log('Products with Special Discount Enabled:');
console.log('-'.repeat(80));
products.forEach(p => {
  console.log('- ' + p.name + ' (' + p.product_id + ')');
  console.log('  Base Price: RM' + p.base_price.toFixed(2));
  console.log('  Category ID: ' + p.category_id);
  console.log('  Subcategory ID: ' + (p.subcategory_id || 'None'));
  console.log('');
});

console.log('\nAvailable Vouchers:');
console.log('-'.repeat(80));
vouchers.forEach(v => {
  console.log('- ' + v.code + ' (' + v.name + ')');
  console.log('  Type: ' + v.discount_type);
  console.log('  Restriction: ' + (v.restriction_type || 'None'));
  const discountDisplay = v.discount_type === 'percentage' ? v.discount_value + '%' : 'RM' + v.discount_value;
  console.log('  Discount: ' + discountDisplay);
  if (v.eligible_product_ids && v.eligible_product_ids.length > 0) {
    console.log('  Eligible Products: ' + v.eligible_product_ids.join(', '));
  }
  if (v.eligible_category_ids && v.eligible_category_ids.length > 0) {
    console.log('  Eligible Categories: ' + v.eligible_category_ids.join(', '));
  }
  console.log('');
});

console.log('\n' + '='.repeat(80));
console.log('SCENARIO SIMULATIONS');
console.log('='.repeat(80));

console.log('\n\nSCENARIO 1: No Voucher Applied');
console.log('-'.repeat(80));
products.forEach(p => {
  console.log('Product: ' + p.name);
  console.log('  Top Right Badge: [USE VOUCHER] (clickable to go to voucher page)');
  console.log('  Price Display: RM' + p.base_price.toFixed(2) + ' (original price only)');
  console.log('  Visual: Red circular badge with "USE VOUCHER" text');
  console.log('');
});

console.log('\n\nSCENARIO 2: Special Discount Voucher Applied');
console.log('-'.repeat(80));
const specialDiscountVouchers = vouchers.filter(v => v.restriction_type === 'special_discount');
if (specialDiscountVouchers.length > 0) {
  specialDiscountVouchers.forEach(voucher => {
    console.log('Applied Voucher: ' + voucher.code + ' - ' + voucher.name);
    console.log('');
    products.forEach(p => {
      const discountedPrice = p.base_price - 5;
      console.log('  Product: ' + p.name);
      console.log('    Top Right Badge: [-RM5] (red circular badge)');
      console.log('    Price Display: RM' + p.base_price.toFixed(2) + ' (strikethrough) -> RM' + discountedPrice.toFixed(2) + ' (in red)');
      console.log('    Visual: Shows discount is active');
      console.log('');
    });
  });
} else {
  console.log('No special discount vouchers found in database.');
  console.log('Example simulation with hypothetical special discount voucher:\n');
  products.forEach(p => {
    const discountedPrice = p.base_price - 5;
    console.log('  Product: ' + p.name);
    console.log('    Top Right Badge: [-RM5] (red circular badge)');
    console.log('    Price Display: RM' + p.base_price.toFixed(2) + ' (strikethrough) -> RM' + discountedPrice.toFixed(2) + ' (in red)');
    console.log('    Visual: Shows discount is active');
    console.log('');
  });
}

console.log('\n\nSCENARIO 3: Other Voucher Types Applied (by_category, by_product, by_subcategory)');
console.log('-'.repeat(80));
const otherVouchers = vouchers.filter(v => 
  v.restriction_type === 'by_category' || 
  v.restriction_type === 'by_product' || 
  v.restriction_type === 'by_subcategory'
);

if (otherVouchers.length > 0) {
  otherVouchers.slice(0, 2).forEach(voucher => {
    console.log('Applied Voucher: ' + voucher.code + ' - ' + voucher.name);
    console.log('  Restriction Type: ' + voucher.restriction_type);
    console.log('');
    
    products.forEach(p => {
      let isEligible = false;
      
      if (voucher.restriction_type === 'by_product') {
        isEligible = voucher.eligible_product_ids?.includes(p.product_id);
      } else if (voucher.restriction_type === 'by_category') {
        isEligible = voucher.eligible_category_ids?.includes(p.category_id);
      } else if (voucher.restriction_type === 'by_subcategory') {
        isEligible = voucher.eligible_subcategory_ids?.includes(p.subcategory_id);
      }
      
      console.log('  Product: ' + p.name);
      console.log('    Top Right Badge: HIDDEN (no badge shown)');
      console.log('    Price Display: RM' + p.base_price.toFixed(2) + ' (original price only)');
      if (isEligible) {
        console.log('    Note: Product IS eligible for this voucher (discount applies at checkout)');
      } else {
        console.log('    Note: Product NOT eligible for this voucher');
      }
      console.log('');
    });
    console.log('');
  });
} else {
  console.log('No category/product/subcategory vouchers found.');
}

console.log('\n' + '='.repeat(80));
console.log('SUMMARY OF VISUAL CHANGES');
console.log('='.repeat(80) + '\n');
console.log('Scenario 1 (No Voucher):');
console.log('  Badge: Red circle with "USE VOUCHER" text (clickable)');
console.log('  Price: Original price only');
console.log('  Purpose: Encourage users to apply special discount voucher\n');
console.log('Scenario 2 (Special Discount Voucher):');
console.log('  Badge: Red circle with "-RM5" text');
console.log('  Price: Strikethrough original -> Red discounted price');
console.log('  Purpose: Show active RM5 discount on this product\n');
console.log('Scenario 3 (Other Vouchers):');
console.log('  Badge: Hidden/Not shown');
console.log('  Price: Original price only');
console.log('  Purpose: Avoid confusion - other vouchers dont give special RM5 discount\n');
console.log('='.repeat(80) + '\n');
