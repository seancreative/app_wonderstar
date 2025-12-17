import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', 'TEST2025')
    .maybeSingle();

  console.log('\n=== Voucher Data ===');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n=== Field Types ===');
  console.log('application_scope type:', typeof data.application_scope);
  console.log('product_application_method type:', typeof data.product_application_method);
  console.log('value type:', typeof data.value);
  
  console.log('\n=== Condition Check ===');
  console.log('application_scope === "product_level":', data.application_scope === 'product_level');
  console.log('product_application_method === "per_product":', data.product_application_method === 'per_product');
  
  const cartItems = [
    { product_id: 'prod1', quantity: 3, unit_price: 15.00 }
  ];
  
  const applicableCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const maxProducts = data.max_products_per_use || 6;
  const effectiveCount = Math.min(applicableCount, maxProducts);
  const totalDiscount = parseFloat(data.value) * effectiveCount;
  
  console.log('\n=== Calculation ===');
  console.log('applicableCount:', applicableCount);
  console.log('maxProducts:', maxProducts);
  console.log('effectiveCount:', effectiveCount);
  console.log('value:', data.value);
  console.log('totalDiscount:', totalDiscount);
}

debug().then(() => process.exit(0));
