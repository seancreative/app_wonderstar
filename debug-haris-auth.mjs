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

async function checkHarisMohdAuth() {
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, auth_id, bonus_balance, auth_migrated')
    .ilike('name', '%haris%mohd%')
    .single();

  if (!user) {
    console.log('ERROR: User not found');
    return;
  }

  console.log('\n========== HARIS MOHD AUTH CHECK ==========');
  console.log('User ID:', user.id);
  console.log('Name:', user.name);
  console.log('Email:', user.email);
  console.log('Auth ID:', user.auth_id || 'NULL');
  console.log('Auth Migrated:', user.auth_migrated || false);
  console.log('Bonus Balance:', user.bonus_balance);

  if (user.auth_id) {
    // Check if auth user exists
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(user.auth_id);

    if (authError) {
      console.log('\nAuth lookup error:', authError.message);
    }

    if (authData?.user) {
      console.log('\n✅ Auth user EXISTS in Supabase Auth');
      console.log('Auth Email:', authData.user.email);
      console.log('Auth Created:', authData.user.created_at);
    } else {
      console.log('\n❌ Auth user NOT FOUND in Supabase Auth');
      console.log('This is the problem! The auth_id points to a non-existent auth user.');
    }
  } else {
    console.log('\n❌ CRITICAL: auth_id is NULL');
    console.log('This user has not been migrated to Supabase Auth.');
    console.log('They cannot log in and their data will not load.');
  }

  console.log('==========================================\n');
}

await checkHarisMohdAuth();
