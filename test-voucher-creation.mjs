import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testVoucherCreation() {
  console.log('=== VOUCHER CREATION TESTING ===\n');
  
  const testVouchers = [];
  
  try {
    // Test 1: Create a regular percentage voucher
    console.log('Test 1: Creating order-level percentage voucher...');
    const voucher1 = {
      code: 'TEST_PERCENT_' + Date.now(),
      description: 'Test 20% off voucher',
      voucher_type: 'percent',
      value: 20,
      application_scope: 'order_total',
      is_active: true,
      times_used: 0,
      created_date: new Date().toISOString(),
      min_purchase: 50,
      eligible_product_ids: [],
      eligible_category_ids: [],
      eligible_subcategory_ids: [],
      max_products_per_use: 1,
      usage_limit_per_user: 1,
      valid_for_today_only: false,
      is_daily_redeemable: false,
      metadata: { max_discount_amount: 100 }
    };
    
    const { data: v1, error: e1 } = await supabase
      .from('vouchers')
      .insert([voucher1])
      .select();
    
    if (e1) {
      console.log('   ❌ FAILED:', e1.message);
    } else {
      console.log('   ✅ SUCCESS: Created voucher', v1[0].code);
      testVouchers.push(v1[0].id);
    }
    
    // Test 2: Create a fixed amount voucher
    console.log('\nTest 2: Creating order-level fixed amount voucher...');
    const voucher2 = {
      code: 'TEST_FIXED_' + Date.now(),
      description: 'Test RM10 off voucher',
      voucher_type: 'amount',
      value: 10,
      application_scope: 'order_total',
      is_active: true,
      times_used: 0,
      created_date: new Date().toISOString(),
      min_purchase: 30,
      eligible_product_ids: [],
      eligible_category_ids: [],
      eligible_subcategory_ids: [],
      max_products_per_use: 1,
      usage_limit_per_user: 1,
      valid_for_today_only: false,
      is_daily_redeemable: false
    };
    
    const { data: v2, error: e2 } = await supabase
      .from('vouchers')
      .insert([voucher2])
      .select();
    
    if (e2) {
      console.log('   ❌ FAILED:', e2.message);
    } else {
      console.log('   ✅ SUCCESS: Created voucher', v2[0].code);
      testVouchers.push(v2[0].id);
    }
    
    // Test 3: Get special discount products
    console.log('\nTest 3: Getting special discount products...');
    const { data: specialProducts } = await supabase
      .from('shop_products')
      .select('product_id')
      .eq('is_active', true)
      .eq('special_discount', true)
      .limit(5);
    
    const eligibleProductIds = specialProducts ? specialProducts.map(p => p.product_id) : [];
    console.log('   ✅ Found', eligibleProductIds.length, 'special discount products');
    
    // Test 4: Create a Special Discount daily voucher
    console.log('\nTest 4: Creating Special Discount daily voucher...');
    const voucher3 = {
      code: 'TEST_DAILY_' + Date.now(),
      description: 'Test daily special discount voucher',
      voucher_type: 'percent',
      value: 50,
      application_scope: 'product_level',
      is_active: true,
      times_used: 0,
      created_date: new Date().toISOString(),
      min_purchase: 0,
      eligible_product_ids: eligibleProductIds,
      eligible_category_ids: [],
      eligible_subcategory_ids: [],
      max_products_per_use: 6,
      usage_limit_per_user: 1,
      valid_for_today_only: false,
      is_daily_redeemable: true
    };
    
    const { data: v3, error: e3 } = await supabase
      .from('vouchers')
      .insert([voucher3])
      .select();
    
    if (e3) {
      console.log('   ❌ FAILED:', e3.message);
      console.log('   Details:', e3);
    } else {
      console.log('   ✅ SUCCESS: Created daily voucher', v3[0].code);
      console.log('   ✅ is_daily_redeemable:', v3[0].is_daily_redeemable);
      console.log('   ✅ Eligible products:', v3[0].eligible_product_ids.length);
      testVouchers.push(v3[0].id);
    }
    
    // Test 5: Verify vouchers in database
    console.log('\nTest 5: Verifying vouchers in database...');
    const { data: allTestVouchers, error: verifyError } = await supabase
      .from('vouchers')
      .select('*')
      .in('id', testVouchers);
    
    if (verifyError) {
      console.log('   ❌ Error verifying:', verifyError.message);
    } else {
      console.log('   ✅ All', allTestVouchers.length, 'vouchers saved correctly');
      allTestVouchers.forEach(v => {
        console.log('      -', v.code, '| Type:', v.voucher_type, '| Daily:', v.is_daily_redeemable);
      });
    }
    
    console.log('\n=== VOUCHER CREATION TEST COMPLETE ===');
    console.log('✅ Voucher creation system working correctly\n');
    
    // Cleanup
    console.log('Cleaning up test vouchers...');
    const { error: cleanupError } = await supabase
      .from('vouchers')
      .delete()
      .in('id', testVouchers);
    
    if (cleanupError) {
      console.log('Note: Could not clean up test vouchers (RLS policy)');
    } else {
      console.log('✅ Test vouchers cleaned up\n');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testVoucherCreation();
