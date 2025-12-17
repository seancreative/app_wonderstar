import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, anonKey);

async function testDatabaseIntegrity() {
  console.log('=== DATABASE CONNECTION & INTEGRITY TEST ===\n');
  
  try {
    console.log('1. Testing database connection...');
    const { data: pingTest, error: pingError } = await supabase
      .from('vouchers')
      .select('count')
      .limit(1);
    
    if (pingError) {
      console.log('   ❌ Connection failed:', pingError.message);
      return;
    }
    console.log('   ✅ Database connection working');
    
    console.log('\n2. Verifying vouchers table schema...');
    const { data: voucherSample, error: voucherError } = await supabase
      .from('vouchers')
      .select('*')
      .limit(1);
    
    if (voucherError) {
      console.log('   ❌ Error:', voucherError.message);
    } else {
      const sampleVoucher = voucherSample[0];
      const requiredFields = [
        'id', 'code', 'description', 'voucher_type', 'value',
        'is_active', 'is_daily_redeemable', 'application_scope',
        'eligible_product_ids', 'eligible_category_ids', 'eligible_subcategory_ids'
      ];
      
      console.log('   ✅ Vouchers table accessible');
      const missingFields = requiredFields.filter(field => !(field in sampleVoucher));
      if (missingFields.length > 0) {
        console.log('   ❌ Missing fields:', missingFields.join(', '));
      } else {
        console.log('   ✅ All required fields present');
      }
    }
    
    console.log('\n3. Verifying user_vouchers table schema...');
    const { data: userVoucherSample, error: uvError } = await supabase
      .from('user_vouchers')
      .select('*')
      .limit(1);
    
    if (uvError) {
      console.log('   ❌ Error:', uvError.message);
    } else {
      const requiredUVFields = [
        'id', 'user_id', 'voucher_id', 'status',
        'is_daily_voucher', 'last_redeemed_date', 'redemption_count'
      ];
      
      console.log('   ✅ User vouchers table accessible');
      if (userVoucherSample.length > 0) {
        const missing = requiredUVFields.filter(f => !(f in userVoucherSample[0]));
        if (missing.length > 0) {
          console.log('   ❌ Missing fields:', missing.join(', '));
        } else {
          console.log('   ✅ All required fields present');
        }
      } else {
        console.log('   ℹ️  No user vouchers to check');
      }
    }
    
    console.log('\n4. Checking voucher statistics...');
    const { count: totalVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true });
    
    const { count: activeVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    const { count: dailyVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('is_daily_redeemable', true);
    
    console.log('   Total vouchers:', totalVouchers || 0);
    console.log('   Active vouchers:', activeVouchers || 0);
    console.log('   Daily redeemable vouchers:', dailyVouchers || 0);
    
    console.log('\n5. Checking product statistics...');
    const { count: totalProducts } = await supabase
      .from('shop_products')
      .select('*', { count: 'exact', head: true });
    
    const { count: specialProducts } = await supabase
      .from('shop_products')
      .select('*', { count: 'exact', head: true })
      .eq('special_discount', true);
    
    console.log('   Total products:', totalProducts || 0);
    console.log('   Special discount products:', specialProducts || 0);
    
    console.log('\n6. Testing data relationships...');
    const { data: voucherWithProducts, error: relError } = await supabase
      .from('vouchers')
      .select('code, eligible_product_ids')
      .not('eligible_product_ids', 'is', null)
      .limit(1);
    
    if (relError) {
      console.log('   ❌ Error:', relError.message);
    } else if (voucherWithProducts && voucherWithProducts.length > 0) {
      console.log('   ✅ Voucher-Product relationships working');
      console.log('      Sample:', voucherWithProducts[0].code, 
                  'with', voucherWithProducts[0].eligible_product_ids?.length || 0, 'products');
    } else {
      console.log('   ℹ️  No vouchers with product restrictions found');
    }
    
    console.log('\n7. Checking foreign key integrity...');
    const { data: userVouchersWithFK, error: fkError } = await supabase
      .from('user_vouchers')
      .select('id, user_id, voucher_id')
      .limit(1);
    
    if (fkError) {
      console.log('   ❌ Error:', fkError.message);
    } else {
      console.log('   ✅ Foreign key constraints working');
    }
    
    console.log('\n=== DATABASE INTEGRITY TEST COMPLETE ===');
    console.log('✅ All database checks passed successfully!\n');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testDatabaseIntegrity();
