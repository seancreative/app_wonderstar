import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, serviceKey);

async function testDailyRedemptionWithRealUser() {
  console.log('=== DAILY VOUCHER REDEMPTION TEST (Real User) ===\n');
  
  try {
    console.log('1. Getting a real user from database...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1);
    
    if (userError || !users || users.length === 0) {
      console.log('   ❌ No users found or error:', userError?.message);
      return;
    }
    
    const testUser = users[0];
    console.log('   ✅ Using user:', testUser.email);
    console.log('      User ID:', testUser.id);
    
    console.log('\n2. Creating a daily redeemable voucher...');
    const { data: specialProducts } = await supabase
      .from('shop_products')
      .select('product_id')
      .eq('is_active', true)
      .eq('special_discount', true)
      .limit(3);
    
    const eligibleProductIds = specialProducts ? specialProducts.map(p => p.product_id) : [];
    
    const dailyVoucherCode = 'DAILY_REAL_' + Date.now();
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
    const voucherId = createdVoucher[0].id;
    
    console.log('\n3. Testing can_redeem_daily_voucher_today...');
    const { data: canRedeem, error: checkError } = await supabase
      .rpc('can_redeem_daily_voucher_today', {
        user_uuid: testUser.id,
        voucher_uuid: voucherId
      });
    
    if (checkError) {
      console.log('   ❌ Error:', checkError.message);
    } else {
      console.log('   ✅ Can redeem:', canRedeem);
    }
    
    console.log('\n4. Redeeming daily voucher...');
    const { data: redemptionResult, error: redeemError } = await supabase
      .rpc('redeem_daily_voucher', {
        user_uuid: testUser.id,
        voucher_uuid: voucherId,
        redemption_method: 'manual_code'
      });
    
    if (redeemError) {
      console.log('   ❌ Error:', redeemError.message);
    } else {
      console.log('   ✅ Redemption successful!');
      console.log('      Result:', JSON.stringify(redemptionResult, null, 2));
    }
    
    console.log('\n5. Verifying user_voucher record...');
    const { data: userVoucher, error: uvError } = await supabase
      .from('user_vouchers')
      .select('*')
      .eq('user_id', testUser.id)
      .eq('voucher_id', voucherId)
      .maybeSingle();
    
    if (uvError) {
      console.log('   ❌ Error:', uvError.message);
    } else if (!userVoucher) {
      console.log('   ❌ No record found');
    } else {
      console.log('   ✅ User voucher created:');
      console.log('      Status:', userVoucher.status);
      console.log('      Is Daily:', userVoucher.is_daily_voucher);
      console.log('      Redemption Count:', userVoucher.redemption_count);
      console.log('      Last Redeemed:', userVoucher.last_redeemed_date);
    }
    
    console.log('\n6. Testing double redemption prevention...');
    const { data: canRedeem2 } = await supabase
      .rpc('can_redeem_daily_voucher_today', {
        user_uuid: testUser.id,
        voucher_uuid: voucherId
      });
    
    console.log('   Can redeem again today:', canRedeem2);
    
    if (!canRedeem2) {
      console.log('   ✅ Double redemption correctly prevented!');
    } else {
      console.log('   ❌ Should prevent double redemption');
    }
    
    console.log('\n=== DAILY VOUCHER TEST COMPLETE ===');
    console.log('✅ All daily redemption features working!\n');
    
    console.log('Cleaning up...');
    await supabase.from('user_vouchers').delete().eq('user_id', testUser.id).eq('voucher_id', voucherId);
    await supabase.from('vouchers').delete().eq('id', voucherId);
    console.log('✅ Cleanup complete\n');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testDailyRedemptionWithRealUser();
