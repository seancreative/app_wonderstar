import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n=== CHECKING ADMIN TABLE ===\n');

// Try different admin table names
const possibleTables = ['admins', 'cms_admins', 'admin_users'];

for (const tableName of possibleTables) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  
  if (!error) {
    console.log(`✓ Found table: ${tableName}`);
    console.log('  Columns:', Object.keys(data[0] || {}).join(', '));
    if (data[0]) {
      console.log('  Sample:', JSON.stringify(data[0], null, 2).substring(0, 300));
    }
  } else {
    console.log(`✗ Table "${tableName}" not found`);
  }
}

console.log('\n=== COMPLETE ===\n');
