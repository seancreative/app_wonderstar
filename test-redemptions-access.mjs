import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n=== TESTING REDEMPTIONS ACCESS AFTER RLS FIX ===\n');

// Test 1: Voucher Redemptions
console.log('1. VOUCHER REDEMPTIONS:');
const { data: vouchers, error: vErr, count: vCount } = await supabase
  .from('voucher_redemptions')
  .select('id, created_at, user_id, users(name, email)', { count: 'exact' })
  .limit(3);

console.log('   Count:', vCount);
if (vErr) console.log('   ERROR:', vErr.message);
else console.log('   ✓ Query successful');

// Test 2: Bonus Transactions (with correct fields)
console.log('\n2. BONUS TRANSACTIONS:');
const { data: bonus, error: bErr, count: bCount } = await supabase
  .from('bonus_transactions')
  .select('id, created_at, amount, transaction_type, order_number, metadata, users(name, email)', { count: 'exact' })
  .limit(3);

console.log('   Count:', bCount);
if (bErr) {
  console.log('   ERROR:', bErr.message);
} else {
  console.log('   ✓ Query successful');
  if (bonus && bonus.length > 0) {
    console.log('   Sample:', JSON.stringify(bonus[0], null, 2));
  }
}

// Test 3: Rewards Redemptions
console.log('\n3. REWARDS REDEMPTIONS:');
const { data: rewards, error: rErr, count: rCount } = await supabase
  .from('redemptions')
  .select('id, redeemed_at, stars_cost, used_at, users(name, email), rewards(name, category)', { count: 'exact' })
  .limit(3);

console.log('   Count:', rCount);
if (rErr) {
  console.log('   ERROR:', rErr.message);
} else {
  console.log('   ✓ Query successful');
  if (rewards && rewards.length > 0) {
    console.log('   Sample:', JSON.stringify(rewards[0], null, 2));
  }
}

// Test 4: Order Item Redemptions (with manual join approach)
console.log('\n4. ORDER ITEM REDEMPTIONS:');
const { data: orders, error: oErr, count: oCount } = await supabase
  .from('order_item_redemptions')
  .select('id, created_at, redeemed_at, product_name, quantity, redeemed_quantity, status, order_id, redeemed_at_outlet_id, users(name, email)', { count: 'exact' })
  .limit(3);

console.log('   Count:', oCount);
if (oErr) {
  console.log('   ERROR:', oErr.message);
} else {
  console.log('   ✓ Query successful');
  if (orders && orders.length > 0) {
    console.log('   Sample:', JSON.stringify(orders[0], null, 2).substring(0, 400));
    
    // Test fetching related data
    const orderIds = orders.map(o => o.order_id);
    const { data: shopOrders } = await supabase
      .from('shop_orders')
      .select('id, order_number')
      .in('id', orderIds);
    
    console.log('   Related shop_orders:', shopOrders?.length || 0, 'found');
  }
}

console.log('\n=== TEST COMPLETE ===\n');
