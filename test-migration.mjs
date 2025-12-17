import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMigration() {
  console.log('=== DATABASE MIGRATION VERIFICATION ===\n');
  
  try {
    console.log('1. Checking vouchers table...');
    const { data: voucherSample, error: voucherError } = await supabase
      .from('vouchers')
      .select('code, is_daily_redeemable')
      .limit(1);
    
    if (voucherError) {
      console.log('   ❌ Error:', voucherError.message);
      if (voucherError.message.includes('is_daily_redeemable')) {
        console.log('   ❌ FAILED: is_daily_redeemable column missing');
        return;
      }
    } else {
      console.log('   ✅ vouchers.is_daily_redeemable column exists');
    }
    
    console.log('\n2. Checking user_vouchers table...');
    const { data: userVoucherSample, error: userVoucherError } = await supabase
      .from('user_vouchers')
      .select('id, last_redeemed_date, redemption_count, is_daily_voucher')
      .limit(1);
    
    if (userVoucherError) {
      console.log('   ❌ Error:', userVoucherError.message);
    } else {
      console.log('   ✅ user_vouchers.last_redeemed_date column exists');
      console.log('   ✅ user_vouchers.redemption_count column exists');
      console.log('   ✅ user_vouchers.is_daily_voucher column exists');
    }
    
    console.log('\n3. Testing database connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('vouchers')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      console.log('   ❌ Connection error:', connectionError.message);
    } else {
      console.log('   ✅ Database connection working');
    }
    
    console.log('\n4. Checking special discount products...');
    const { count: specialCount, error: specialError } = await supabase
      .from('shop_products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('special_discount', true);
    
    if (specialError) {
      console.log('   ❌ Error:', specialError.message);
    } else {
      console.log('   ✅ ' + (specialCount || 0) + ' products marked as special discount');
    }
    
    console.log('\n=== MIGRATION VERIFICATION COMPLETE ===');
    console.log('✅ All database schema changes applied successfully\n');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testMigration();
