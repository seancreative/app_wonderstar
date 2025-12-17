import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lfmfzvhonbjgmejrevat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4'
);

console.log('\nChecking DISCOUNT5 voucher details...\n');

const { data: voucher, error } = await supabase
  .from('vouchers')
  .select('*')
  .eq('code', 'DISCOUNT5')
  .maybeSingle();

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

if (!voucher) {
  console.log('DISCOUNT5 voucher not found!');
  process.exit(0);
}

console.log('Voucher Code:', voucher.code);
console.log('Voucher Name:', voucher.name);
console.log('Discount Type:', voucher.discount_type);
console.log('Discount Value:', voucher.discount_value);
console.log('Restriction Type:', voucher.restriction_type);
console.log('Is Active:', voucher.is_active);
console.log('Eligible Products:', voucher.eligible_product_ids);
console.log('Eligible Categories:', voucher.eligible_category_ids);
console.log('Eligible Subcategories:', voucher.eligible_subcategory_ids);
console.log('\n---\n');

if (voucher.restriction_type !== 'special_discount') {
  console.log('ISSUE FOUND:');
  console.log('The DISCOUNT5 voucher has restriction_type:', voucher.restriction_type);
  console.log('Expected: "special_discount"');
  console.log('\nThis is why the badge shows "USE VOUCHER" instead of "-RM5"');
  console.log('and the price is not discounted.\n');
} else {
  console.log('Voucher looks correct! The issue might be elsewhere.');
}
