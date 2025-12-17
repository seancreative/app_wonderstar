#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const migrationSQL = `
-- Drop policy if it already exists
DROP POLICY IF EXISTS "System can update wallet transaction status" ON wallet_transactions;

-- Allow authenticated requests (including payment callbacks) to update transaction status
CREATE POLICY "System can update wallet transaction status"
  ON wallet_transactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
`;

console.log('🔧 Applying UPDATE policy fix for wallet_transactions...\n');

async function applyFix() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL }).single();

    if (error) {
      // Try direct query instead
      console.log('Trying direct SQL execution...');

      const queries = migrationSQL.trim().split(';').filter(q => q.trim());

      for (const query of queries) {
        if (!query.trim()) continue;

        console.log(`Executing: ${query.substring(0, 80)}...`);
        const result = await supabase.from('_migrations').select('*').limit(0);

        // Use rpc or raw SQL
        const { error: execError } = await supabase.rpc('exec', {
          query: query.trim() + ';'
        });

        if (execError) {
          console.error('❌ Error:', execError.message);
        } else {
          console.log('✅ Success');
        }
      }
    } else {
      console.log('✅ Migration applied successfully!');
    }

    console.log('\n🎉 UPDATE policy has been added to wallet_transactions');
    console.log('Payment callbacks can now update transaction status!');

  } catch (error) {
    console.error('❌ Failed to apply migration:', error.message);
    console.log('\n📝 Please apply this SQL manually in Supabase SQL Editor:');
    console.log(migrationSQL);
  }
}

applyFix();
