import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVoucher() {
  console.log('\n=== Checking TEST2025 Voucher Configuration ===\n');
  
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', 'TEST2025')
    .maybeSingle();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data) {
    console.log('Voucher TEST2025 not found');
    return;
  }

  console.log('Voucher Found!\n');
  console.log('Code:', data.code);
  console.log('Voucher Type:', data.voucher_type);
  console.log('Value:', data.value);
  console.log('Application Scope:', data.application_scope);
  console.log('Product Application Method:', data.product_application_method);
  console.log('Max Products Per Use:', data.max_products_per_use);
  console.log('Min Purchase:', data.min_purchase);
  
  console.log('\n=== Expected Behavior ===\n');
  
  if (data.product_application_method === 'per_product') {
    const maxProducts = data.max_products_per_use || 6;
    const value = parseFloat(data.value);
    console.log('Apply to EACH applicable product');
    console.log('Maximum products:', maxProducts);
    console.log('Example with 5 products: RM' + value + ' x 5 = RM' + (value * 5) + ' discount');
  } else {
    console.log('Apply to total ONCE');
  }
}

checkVoucher().then(() => process.exit(0));
