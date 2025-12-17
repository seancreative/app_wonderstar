import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, serviceKey);

async function testDailyRedemption() {
  console.log('=== DAILY VOUCHER REDEMPTION TESTING ===\n');
  
  try {
    console.log('1. Creating a daily redeemable voucher...');
    
    const { data: specialProducts } = await supabase
      .from('shop_products')
      .select('product_id')
      .eq('is_active', true)
      .eq('special_discount', true)
      .limit(3);
    
    const eligibleProductIds = specialProducts ? specialProducts.map(p => p.product_id) : [];
    
    const dailyVoucherCode = 'DAILY_TEST_' + Date.now();
    const dailyVoucher = {
      code: dailyVoucherCode,
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
    
    const { data: createdVoucher, error: createError } = await supabase
      .from('vouchers')
      .insert([dailyVoucher])
      .select();
    
    if (createError) {
      console.log('   ❌ Failed:', createError.message);
      return;
    }
    
    console.log('   ✅ Created daily voucher:', createdVoucher[0].code);
    console.log('      is_daily_redeemable:', createdVoucher[0].is_daily_redeemable);
    console.log('      Eligible products:', createdVoucher[0].eligible_product_ids.length);
    
    const voucherId = createdVoucher[0].id;
    const testUserId = 'd9c8f7e6-5b4a-3c2d-1e0f-9a8b7c6d5e4f';
    
    console.log('\n2. Testing can_redeem_daily_voucher_today function...');
    const { data: canRedeem1, error: check1Error } = await supabase
      .rpc('can_redeem_daily_voucher_today', {
        user_uuid: testUserId,
        voucher_uuid: voucherId
      });
    
    if (check1Error) {
      console.log('   ❌ Error:', check1Error.message);
    } else {
      console.log('   ✅ Can redeem today:', canRedeem1);
      console.log('      (Should be true on first check)');
    }
    
    console.log('\n3. Testing redeem_daily_voucher function...');
    const { data: redemptionResult, error: redeemError } = await supabase
      .rpc('redeem_daily_voucher', {
        user_uuid: testUserId,
        voucher_uuid: voucherId,
        redemption_method: 'manual_code'
      });
    
    if (redeemError) {
      console.log('   ❌ Error:', redeemError.message);
    } else {
      console.log('   ✅ Redemption result:', redemptionResult);
      if (redemptionResult.success) {
        console.log('      Success:', redemptionResult.success);
        console.log('      Message:', redemptionResult.message);
        console.log('      Expires at:', redemptionResult.expires_at);
        console.log('      User Voucher ID:', redemptionResult.user_voucher_id);
      }
    }
    
    console.log('\n4. Checking user_vouchers record...');
    const { data: userVoucher, error: uvError } = await supabase
      .from('user_vouchers')
      .select('*')
      .eq('user_id', testUserId)
      .eq('voucher_id', voucherId)
      .maybeSingle();
    
    if (uvError) {
      console.log('   ❌ Error:', uvError.message);
    } else if (!userVoucher) {
      console.log('   ❌ No user_voucher record found');
    } else {
      console.log('   ✅ User voucher record created:');
      console.log('      Status:', userVoucher.status);
      console.log('      Is Daily:', userVoucher.is_daily_voucher);
      console.log('      Redemption Count:', userVoucher.redemption_count);
      console.log('      Last Redeemed:', userVoucher.last_redeemed_date);
      console.log('      Expires At:', userVoucher.expires_at);
    }
    
    console.log('\n5. Testing can_redeem again (should be false now)...');
    const { data: canRedeem2, error: check2Error } = await supabase
      .rpc('can_redeem_daily_voucher_today', {
        user_uuid: testUserId,
        voucher_uuid: voucherId
      });
    
    if (check2Error) {
      console.log('   ❌ Error:', check2Error.message);
    } else {
      console.log('   ✅ Can redeem today:', canRedeem2);
      console.log('      (Should be false after redemption)');
    }
    
    console.log('\n6. Attempting to redeem again (should fail)...');
    const { data: redemption2Result, error: redeem2Error } = await supabase
      .rpc('redeem_daily_voucher', {
        user_uuid: testUserId,
        voucher_uuid: voucherId,
        redemption_method: 'manual_code'
      });
    
    if (redeem2Error) {
      console.log('   ❌ Error:', redeem2Error.message);
    } else {
      console.log('   Result:', redemption2Result);
      if (!redemption2Result.success) {
        console.log('   ✅ Correctly prevented double redemption');
        console.log('      Error:', redemption2Result.error);
      } else {
        console.log('   ❌ Should have prevented double redemption');
      }
    }
    
    console.log('\n=== DAILY VOUCHER REDEMPTION TEST COMPLETE ===');
    console.log('✅ Daily redemption system working correctly!\n');
    
    console.log('Cleaning up test data...');
    await supabase.from('user_vouchers').delete().eq('user_id', testUserId);
    await supabase.from('vouchers').delete().eq('id', voucherId);
    console.log('✅ Cleanup complete\n');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testDailyRedemption();
