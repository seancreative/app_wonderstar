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

// Get company settings from app_config
async function getCompanySettings() {
  const { data, error } = await supabase
    .from('app_config')
    .select('config_key, config_value')
    .in('config_key', ['business_name', 'company_registration_no', 'business_address', 'contact_email', 'support_phone', 'business_website']);

  if (error) {
    console.error('Error fetching company settings:', error);
  }

  const settings = {
    name: 'Kiddo Heritage Sdn Bhd',
    registration_no: '',
    address: 'The Shore Shopping Gallery, Melaka Malaysia.',
    email: 'info@wonderpark.my',
    phone: '6012-878-9169',
    website: 'www.wonderpark.my'
  };

  data?.forEach(item => {
    const key = item.config_key;
    let value = item.config_value;

    if (!value || value === '""' || value === 'null') return;

    if (key === 'business_name') settings.name = value;
    else if (key === 'company_registration_no') settings.registration_no = value;
    else if (key === 'business_address') settings.address = value;
    else if (key === 'contact_email') settings.email = value;
    else if (key === 'support_phone') settings.phone = value;
    else if (key === 'business_website') settings.website = value;
  });

  return settings;
}

async function regenerateAllReceipts() {
  console.log('\n=== Regenerating All Receipts ===\n');

  // Fetch current company settings
  const companySettings = await getCompanySettings();
  console.log('Current company settings:', companySettings);

  // Get all orders that have receipt_data
  const { data: orders, error } = await supabase
    .from('shop_orders')
    .select('id, order_number, receipt_number, receipt_data')
    .not('receipt_data', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log(`\nFound ${orders?.length || 0} orders with receipts\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const order of orders || []) {
    try {
      const receiptData = order.receipt_data;

      // Check if company data needs update
      const currentCompany = receiptData.company || {};
      const needsUpdate =
        currentCompany.name !== companySettings.name ||
        currentCompany.registration_no !== companySettings.registration_no ||
        currentCompany.address !== companySettings.address ||
        currentCompany.email !== companySettings.email ||
        currentCompany.phone !== companySettings.phone ||
        currentCompany.website !== companySettings.website;

      if (!needsUpdate) {
        skipped++;
        continue;
      }

      // Update the company section in receipt_data
      const updatedReceiptData = {
        ...receiptData,
        company: {
          name: companySettings.name,
          registration_no: companySettings.registration_no,
          address: companySettings.address,
          email: companySettings.email,
          phone: companySettings.phone,
          website: companySettings.website
        }
      };

      // Update the order
      const { error: updateError } = await supabase
        .from('shop_orders')
        .update({
          receipt_data: updatedReceiptData,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        console.error(`❌ Error updating order ${order.order_number}:`, updateError);
        errors++;
      } else {
        console.log(`✓ Updated receipt for order ${order.order_number} (${order.receipt_number})`);
        updated++;
      }
    } catch (err) {
      console.error(`❌ Exception updating order ${order.order_number}:`, err);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total orders: ${orders?.length || 0}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already up-to-date): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log('');
}

regenerateAllReceipts().then(() => {
  console.log('✓ Regeneration complete\n');
  process.exit(0);
}).catch(err => {
  console.error('\n✗ Error:', err);
  process.exit(1);
});
