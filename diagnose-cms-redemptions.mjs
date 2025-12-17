import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n=== CMS REDEMPTIONS DATA CHECK ===\n');

// Check voucher_redemptions
console.log('1. VOUCHER REDEMPTIONS:');
const { data: vouchers, error: vErr } = await supabase
  .from('voucher_redemptions')
  .select('id, created_at, user_id, users(name, email)')
  .limit(5);

if (vErr) {
  console.log('   ERROR:', vErr.message);
} else {
  console.log('   Total in DB:', vouchers?.length || 0);
  if (vouchers && vouchers.length > 0) {
    console.log('   Sample:', JSON.stringify(vouchers[0], null, 2).substring(0, 300));
  }
}

// Check bonus_transactions
console.log('\n2. BONUS TRANSACTIONS:');
const { data: bonus, error: bErr, count: bCount } = await supabase
  .from('bonus_transactions')
  .select('id, created_at, user_id, amount, transaction_type, source, users(name, email)', { count: 'exact' })
  .limit(5);

if (bErr) {
  console.log('   ERROR:', bErr.message);
} else {
  console.log('   Total in DB:', bCount);
  if (bonus && bonus.length > 0) {
    console.log('   Sample:', JSON.stringify(bonus[0], null, 2));
  }
}

// Check redemptions (rewards)
console.log('\n3. REWARDS REDEMPTIONS:');
const { data: rewards, error: rErr, count: rCount } = await supabase
  .from('redemptions')
  .select('id, redeemed_at, user_id, stars_cost, reward_id, qr_code, used_at, users(name, email), rewards(name, category)', { count: 'exact' })
  .limit(5);

if (rErr) {
  console.log('   ERROR:', rErr.message);
} else {
  console.log('   Total in DB:', rCount);
  if (rewards && rewards.length > 0) {
    console.log('   Sample:', JSON.stringify(rewards[0], null, 2));
  }
}

// Check order_item_redemptions
console.log('\n4. ORDER ITEM REDEMPTIONS:');
const { data: orders, error: oErr, count: oCount } = await supabase
  .from('order_item_redemptions')
  .select('id, created_at, redeemed_at, user_id, product_name, quantity, redeemed_quantity, status, users(name, email), shop_orders(order_number)', { count: 'exact' })
  .limit(5);

if (oErr) {
  console.log('   ERROR:', oErr.message);
} else {
  console.log('   Total in DB:', oCount);
  if (orders && orders.length > 0) {
    console.log('   Sample:', JSON.stringify(orders[0], null, 2).substring(0, 400));
  }
}

// Check RLS policies
console.log('\n5. RLS POLICY CHECK:');
console.log('   Checking if tables have RLS enabled...');

for (const table of ['voucher_redemptions', 'bonus_transactions', 'redemptions', 'order_item_redemptions']) {
  const { data: rlsData } = await supabase
    .rpc('pg_catalog.has_table_privilege', {
      user: 'anon',
      table: `public.${table}`,
      privilege: 'SELECT'
    })
    .single();
  
  console.log(`   ${table}:`, rlsData ? 'Has SELECT' : 'NO SELECT permission');
}

console.log('\n=== DIAGNOSIS COMPLETE ===\n');
