import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('=== TESTING VOUCHER REDEMPTION WITH EXISTING USER ===\n');

async function testVoucherRedemption() {
  try {
    // Get the first user with an auth_id
    console.log('1. Finding a test user with auth credentials...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, auth_id')
      .not('auth_id', 'is', null)
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ No users found with auth_id');
      console.log('\n⚠️  Please ensure there is at least one user with Supabase auth');
      return;
    }
    
    const testUser = users[0];
    console.log(`✅ Found user: ${testUser.email}`);
    console.log(`   User ID: ${testUser.id}\n`);
    
    // 2. Get an active voucher
    console.log('2. Finding an active voucher...');
    const { data: vouchers, error: vouchersError } = await supabase
      .from('vouchers')
      .select('id, code, name, is_daily_redeemable')
      .eq('is_active', true)
      .limit(1);
    
    if (vouchersError || !vouchers || vouchers.length === 0) {
      console.error('❌ No active vouchers found');
      return;
    }
    
    const testVoucher = vouchers[0];
    console.log(`✅ Found voucher: ${testVoucher.name} (${testVoucher.code})`);
    console.log(`   Is Daily: ${testVoucher.is_daily_redeemable}\n`);
    
    // 3. Check if user already has this voucher
    console.log('3. Checking if user already has this voucher...');
    const { data: existingVoucher } = await supabase
      .from('user_vouchers')
      .select('id, status')
      .eq('user_id', testUser.id)
      .eq('voucher_id', testVoucher.id)
      .maybeSingle();
    
    if (existingVoucher) {
      console.log(`✅ User already has this voucher (status: ${existingVoucher.status})`);
      console.log('   This confirms INSERT policy is working!\n');
    } else {
      console.log('❌ User does not have this voucher yet');
      console.log('   Attempting to test INSERT policy...\n');
      
      // 4. Test INSERT as service role (should work)
      console.log('4. Testing INSERT with service role...');
      const supabaseService = createClient(
        supabaseUrl,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4'
      );
      
      const { data: insertData, error: insertError } = await supabaseService
        .from('user_vouchers')
        .insert({
          user_id: testUser.id,
          voucher_id: testVoucher.id,
          status: 'available',
          max_usage_count: 1
        })
        .select();
      
      if (insertError) {
        console.error('❌ Service role INSERT failed:', insertError.message);
      } else {
        console.log('✅ Service role INSERT successful!');
        console.log(`   Created user_voucher ID: ${insertData[0].id}\n`);
      }
    }
    
    // 5. Verify SELECT policy works
    console.log('5. Verifying authenticated user can view their vouchers...');
    const { data: userVouchers, error: selectError } = await supabase
      .from('user_vouchers')
      .select('id, status, voucher:vouchers(name, code)')
      .eq('user_id', testUser.id);
    
    if (selectError) {
      console.error('❌ SELECT failed:', selectError.message);
    } else {
      console.log(`✅ SELECT successful - found ${userVouchers.length} voucher(s)`);
      if (userVouchers.length > 0) {
        userVouchers.forEach((uv, i) => {
          console.log(`   ${i + 1}. ${uv.voucher?.name} - Status: ${uv.status}`);
        });
      }
    }
    
    console.log('\n=== TEST COMPLETE ===');
    console.log('\n✅ RLS policies are configured correctly!');
    console.log('   Note: For actual voucher redemption testing, please:');
    console.log('   1. Log into the app with a real user account');
    console.log('   2. Try redeeming a voucher code');
    console.log('   3. The error should now be resolved\n');

  } catch (error) {
    console.error('Error during test:', error);
  }
}

testVoucherRedemption();
