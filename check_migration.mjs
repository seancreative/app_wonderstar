import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigration() {
  try {
    // Check if is_daily_redeemable column exists
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error querying vouchers:', error);
      console.log('\nColumn details:', error.details);
      console.log('Message:', error.message);
      
      if (error.message.includes('is_daily_redeemable')) {
        console.log('\n❌ ISSUE CONFIRMED: is_daily_redeemable column does NOT exist in vouchers table');
        console.log('\n✅ SOLUTION: Run the migration file:');
        console.log('   supabase/migrations/20251118120000_create_daily_special_discount_voucher_system.sql');
      }
      return;
    }

    console.log('✅ Vouchers table query successful');
    console.log('Sample voucher data:', data);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkMigration();
