import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const emails = ['seancreative@gmail.com', 'danson3@gmail.com'];

console.log('Checking auth.users and creating missing user records...\n');

for (const email of emails) {
  console.log('========================================');
  console.log('Processing:', email);
  console.log('========================================');

  // Check if user exists in users table
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    console.log('User already exists in users table');
    console.log('  ID:', existingUser.id);
    console.log('  Auth ID:', existingUser.auth_id);
    console.log('  Name:', existingUser.name);
    console.log('  Wallet Balance: RM' + (existingUser.wallet_balance || 0));
    console.log('  Bonus Balance: RM' + (existingUser.bonus_balance || 0));
    console.log('');
    continue;
  }

  // Try to get from auth.users
  const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.log('Error listing auth users:', listError.message);
    continue;
  }

  const authUser = authUsers.find(u => u.email === email);

  if (!authUser) {
    console.log('User not found in auth.users');
    console.log('This user needs to sign up first!');
    console.log('');
    continue;
  }

  console.log('Found in auth.users:');
  console.log('  Auth ID:', authUser.id);
  console.log('  Email:', authUser.email);
  console.log('  Created:', new Date(authUser.created_at).toLocaleString());
  console.log('  User metadata:', JSON.stringify(authUser.user_metadata));

  // Create user record
  const referralCode = 'WS' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const name = authUser.user_metadata?.name || authUser.email.split('@')[0];
  const phone = authUser.user_metadata?.phone || '+60123456789';

  console.log('\nCreating user record...');

  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      auth_id: authUser.id,
      name: name,
      email: authUser.email,
      phone: phone,
      referral_code: referralCode,
      auth_migrated: true,
      auth_migrated_at: new Date().toISOString(),
      wallet_balance: 0,
      bonus_balance: 0,
      stars: 0,
      lifetime_topups: 0
    })
    .select()
    .single();

  if (createError) {
    console.log('ERROR creating user:', createError.message);
    console.log('');
    continue;
  }

  console.log('SUCCESS! User created:');
  console.log('  User ID:', newUser.id);
  console.log('  Name:', newUser.name);
  console.log('  Email:', newUser.email);
  console.log('  Referral Code:', newUser.referral_code);
  console.log('');

  // Create welcome notification
  await supabase.from('notifications').insert({
    user_id: newUser.id,
    title: 'Welcome to WonderStars!',
    message: 'Start earning stars on every visit and unlock amazing rewards.',
    notification_type: 'system'
  });

  console.log('Welcome notification created');
  console.log('');
}

console.log('========================================');
console.log('COMPLETE');
console.log('========================================');
