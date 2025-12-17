import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkOrder() {
  console.log('Checking order WP15096244...\n');
  
  const { data: order, error } = await supabase
    .from('shop_orders')
    .select('*')
    .or('order_number.eq.WP15096244,order_number.ilike.%15096244%')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!order) {
    console.log('Order not found');
    return;
  }
  
  console.log('Order found:');
  console.log('Order Number:', order.order_number);
  console.log('Created:', order.created_at);
  console.log('\n=== FINANCIAL BREAKDOWN ===');
  console.log('Gross Sales:', order.gross_sales || order.subtotal);
  console.log('Subtotal:', order.subtotal);
  console.log('Discount Amount (DV - Voucher):', order.discount_amount);
  console.log('Bonus Discount Amount (DB):', order.bonus_discount_amount);
  console.log('Permanent Discount Amount (DO):', order.permanent_discount_amount);
  console.log('Total Amount (Paid):', order.total_amount);
  console.log('\n=== VOUCHER INFO ===');
  console.log('Voucher Code:', order.voucher_code);
  console.log('Voucher ID:', order.voucher_id);
  console.log('User Voucher ID:', order.user_voucher_id);
  console.log('\n=== METADATA ===');
  console.log('Metadata:', JSON.stringify(order.metadata, null, 2));
  console.log('\n=== ITEMS ===');
  console.log('Items:', JSON.stringify(order.items, null, 2));
}

checkOrder();
