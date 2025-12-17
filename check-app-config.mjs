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

async function checkAppConfig() {
  console.log('\n=== Checking app_config table ===\n');

  const { data, error } = await supabase
    .from('app_config')
    .select('config_key, config_value')
    .in('config_key', ['business_name', 'company_registration_no', 'business_address', 'contact_email', 'support_phone', 'business_website']);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Raw data from Supabase:');
  data?.forEach(item => {
    console.log(`\nKey: ${item.config_key}`);
    console.log(`  Value: ${JSON.stringify(item.config_value)}`);
    console.log(`  Type: ${typeof item.config_value}`);
    console.log(`  Is object: ${typeof item.config_value === 'object'}`);

    // Try different parsing strategies
    let parsed = item.config_value;

    if (typeof parsed === 'string') {
      console.log(`  As string: "${parsed}"`);
      try {
        const jsonParsed = JSON.parse(parsed);
        console.log(`  JSON.parse result: "${jsonParsed}" (type: ${typeof jsonParsed})`);
      } catch (e) {
        console.log(`  JSON.parse failed: ${e.message}`);
      }
    }
  });
}

checkAppConfig().then(() => {
  console.log('\n✓ Check complete\n');
  process.exit(0);
}).catch(err => {
  console.error('\n✗ Error:', err);
  process.exit(1);
});
