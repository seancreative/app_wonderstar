import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumn() {
  try {
    // Try to insert a test voucher with is_daily_redeemable field
    const testData = {
      code: 'TEST_DAILY_CHECK_' + Date.now(),
      description: 'Test voucher to check column',
      voucher_type: 'percent',
      value: 10,
      is_active: true,
      application_scope: 'order_total',
      is_daily_redeemable: true
    };

    const { data, error } = await supabase
      .from('vouchers')
      .insert([testData])
      .select();

    if (error) {
      console.error('❌ ERROR:', error.message);
      
      if (error.message.includes('is_daily_redeemable')) {
        console.log('\n❌ CONFIRMED: is_daily_redeemable column DOES NOT EXIST');
        console.log('\n📋 This migration needs to be applied:');
        console.log('   File: supabase/migrations/20251118120000_create_daily_special_discount_voucher_system.sql');
      }
      return;
    }

    console.log('✅ SUCCESS: is_daily_redeemable column exists!');
    console.log('Test voucher created:', data);

    // Clean up test voucher
    if (data && data[0]) {
      await supabase.from('vouchers').delete().eq('id', data[0].id);
      console.log('Test voucher cleaned up');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkColumn();
