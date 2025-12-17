import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\nChecking Redemption Tables...\n');

const tables = [
  'voucher_redemptions',
  'bonus_transactions', 
  'redemptions',
  'order_item_redemptions',
  'stamps_redemptions'
];

for (const table of tables) {
  console.log('========================================');
  console.log('TABLE:', table);
  console.log('========================================');
  
  const { data, error, count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: false })
    .limit(3);
  
  if (error) {
    console.log('ERROR:', error.message);
  } else {
    console.log('Total Records:', count);
    if (data && data.length > 0) {
      console.log('Sample Record:', JSON.stringify(data[0], null, 2).substring(0, 500));
    } else {
      console.log('No records found');
    }
  }
  console.log('');
}

console.log('========================================');
console.log('COMPLETE');
console.log('========================================');
