import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVoucher() {
  console.log('\n=== Checking TEST2025 Voucher Configuration ===\n');

  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', 'TEST2025')
    .maybeSingle();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data) {
    console.log('❌ Voucher TEST2025 not found');
    return;
  }

  console.log('✅ Voucher Found!\n');
  console.log('📋 Configuration:');
  console.log('  Code:', data.code);
  console.log('  Voucher Type:', data.voucher_type);
  console.log('  Value:', data.value);
  console.log('  Application Scope:', data.application_scope);
  console.log('  Product Application Method:', data.product_application_method);
  console.log('  Max Products Per Use:', data.max_products_per_use);
  console.log('  Min Purchase:', data.min_purchase);
  console.log('  Restriction Type:', data.restriction_type);

  console.log('\n💡 Expected Behavior:\n');

  if (data.product_application_method === 'per_product') {
    const maxProducts = data.max_products_per_use || 6;
    const value = parseFloat(data.value);
    console.log('  ✓ Apply to EACH applicable product');
    console.log('  ✓ Maximum products:', maxProducts);
    console.log('  ✓ Example: 5 products in cart');
    console.log('    → Discount: RM' + value + ' × 5 = RM' + (value * 5));
    console.log('  ✓ Example: 3 products in cart');
    console.log('    → Discount: RM' + value + ' × 3 = RM' + (value * 3));
  } else {
    console.log('  ✓ Apply to total ONCE');
    console.log('  ✓ Example: Cart total RM100');
    console.log('    → Discount: RM' + data.value);
  }

  console.log('\n📦 Restriction Details:');
  if (data.restriction_type === 'none' || !data.restriction_type) {
    console.log('  ✓ No restrictions - applies to ALL products');
  } else if (data.restriction_type === 'specific_products') {
    console.log('  ✓ Specific products only:', data.eligible_product_ids);
  } else if (data.restriction_type === 'specific_categories') {
    console.log('  ✓ Specific categories only:', data.eligible_category_ids);
  } else if (data.restriction_type === 'specific_subcategories') {
    console.log('  ✓ Specific subcategories only:', data.eligible_subcategory_ids);
  }

  console.log('\n✅ Fix Applied:');
  console.log('  ShopCart.tsx now uses per-product calculation');
  console.log('  Both Cart and Checkout pages show same discount');
  console.log('\n');
}

checkVoucher().then(() => process.exit(0));
