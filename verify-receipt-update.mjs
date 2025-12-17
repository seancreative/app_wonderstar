import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

async function verifyReceiptUpdate() {
  console.log('\n=== Verifying Receipt Updates ===\n');

  // Get all orders with receipts
  const { data: orders, error } = await supabase
    .from('shop_orders')
    .select('order_number, receipt_number, receipt_data')
    .not('receipt_data', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log(`Checking ${orders?.length || 0} receipts:\n`);

  for (const order of orders || []) {
    const company = order.receipt_data?.company || {};

    console.log(`Receipt: ${order.receipt_number} (Order: ${order.order_number})`);
    console.log(`  Company Name: ${company.name || 'NOT SET'}`);
    console.log(`  Registration No: ${company.registration_no || 'NOT SET'}`);
    console.log(`  Address: ${company.address?.substring(0, 60) || 'NOT SET'}...`);
    console.log(`  Email: ${company.email || 'NOT SET'}`);
    console.log(`  Phone: ${company.phone || 'NOT SET'}`);
    console.log(`  Website: ${company.website || 'NOT SET'}`);
    console.log('');
  }
}

verifyReceiptUpdate().then(() => {
  console.log('✓ Verification complete\n');
  process.exit(0);
}).catch(err => {
  console.error('\n✗ Error:', err);
  process.exit(1);
});
