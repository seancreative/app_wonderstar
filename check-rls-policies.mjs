import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, serviceKey);

async function checkRLSPolicies() {
  console.log('=== CHECKING RLS POLICIES ON user_vouchers ===\n');
  
  const { data, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE tablename = 'user_vouchers'
        ORDER BY policyname;
      `
    });
  
  if (error) {
    console.log('Trying alternative method...\n');
    
    const query = `
      SELECT policyname, cmd, roles
      FROM pg_policies
      WHERE tablename = 'user_vouchers';
    `;
    
    console.log('Query:', query);
    console.log('\nNote: Cannot directly query pg_policies without proper RPC function.');
    console.log('Please check Supabase dashboard > Database > Policies for user_vouchers table\n');
  } else {
    console.log('Policies found:', JSON.stringify(data, null, 2));
  }
}

checkRLSPolicies();
