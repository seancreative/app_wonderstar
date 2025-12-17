import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('\n=== Checking shop_orders Schema ===\n');
  
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Sample order columns:');
    console.log(Object.keys(data[0]).sort());
    
    console.log('\n=== Checking for confirmed_at column ===');
    console.log('Has confirmed_at:', 'confirmed_at' in data[0]);
  } else {
    console.log('No orders found in database');
  }
}

checkSchema().then(() => process.exit(0));
