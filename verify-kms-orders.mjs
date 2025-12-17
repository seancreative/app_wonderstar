import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log('=== KMS Orders Verification ===\n');

// Check all paid orders
const { data: allOrders, error: allError } = await supabase
  .from('shop_orders')
  .select('id, order_number, outlet_id, payment_status, fnbstatus, items, created_at')
  .eq('payment_status', 'paid')
  .order('created_at', { ascending: false })
  .limit(10);

if (allError) {
  console.error('Error fetching orders:', allError);
  process.exit(1);
}

console.log(`Total paid orders in last 10: ${allOrders?.length || 0}\n`);

// Check outlets
const { data: outlets } = await supabase
  .from('outlets')
  .select('id, name, location');

console.log('Available outlets:');
outlets?.forEach(outlet => {
  console.log(`- ${outlet.name} (${outlet.location}): ${outlet.id}`);
});
console.log('');

// Analyze each order
console.log('Order analysis:');
let fnbCount = 0;
allOrders?.forEach(order => {
  const items = order.items || [];
  const outlet = outlets?.find(o => o.id === order.outlet_id);

  const hasFnB = items.some(item => {
    const cat = (item.metadata?.category || '').toLowerCase();
    return cat.includes('f&b') || cat.includes('food') || cat.includes('beverage');
  });

  if (hasFnB) fnbCount++;

  console.log(`\n${order.order_number}:`);
  console.log(`  - Outlet: ${outlet?.name || 'None'}`);
  console.log(`  - F&B Status: ${order.fnbstatus || 'null'}`);
  console.log(`  - Has F&B Items: ${hasFnB ? 'YES' : 'NO'}`);
  console.log(`  - Created: ${new Date(order.created_at).toLocaleString()}`);

  items.forEach((item, idx) => {
    console.log(`  - Item ${idx + 1}: ${item.product_name} (${item.metadata?.category || 'no category'})`);
  });
});

console.log(`\n\n=== SUMMARY ===`);
console.log(`Total paid orders: ${allOrders?.length || 0}`);
console.log(`Orders with F&B items: ${fnbCount}`);
console.log(`\nThe KMS should show ${fnbCount} orders when "All Outlets" is enabled.`);
