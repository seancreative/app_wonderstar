import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lfmfzvhonbjgmejrevat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4'
);

console.log('Updating DISCOUNT5 voucher to special_discount type...\n');

const { data, error } = await supabase
  .from('vouchers')
  .update({
    restriction_type: 'special_discount',
    name: 'Special Discount RM5',
    discount_type: 'fixed',
    discount_value: 5
  })
  .eq('code', 'DISCOUNT5')
  .select();

if (error) {
  console.error('Error updating voucher:', error);
  process.exit(1);
}

console.log('✓ Successfully updated DISCOUNT5 voucher!');
console.log('\nUpdated voucher details:');
console.log('- Code:', data[0].code);
console.log('- Name:', data[0].name);
console.log('- Restriction Type:', data[0].restriction_type);
console.log('- Discount Type:', data[0].discount_type);
console.log('- Discount Value:', data[0].discount_value);
console.log('\nThe special discount badge should now work correctly!');
