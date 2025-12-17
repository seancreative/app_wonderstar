import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\nSearching for users with emails containing "sean" or "danson"...\n');

const { data: users } = await supabase
  .from('users')
  .select('id, email, name, wallet_balance, bonus_balance, stars, lifetime_topups')
  .or('email.ilike.%sean%,email.ilike.%danson%');

if (!users || users.length === 0) {
  console.log('No matching users found');
} else {
  console.log('Found', users.length, 'matching users:');
  users.forEach(u => {
    console.log('\n---');
    console.log('Email:', u.email);
    console.log('Name:', u.name);
    console.log('Wallet Balance: RM' + (u.wallet_balance || 0));
    console.log('Bonus Balance: RM' + (u.bonus_balance || 0));
    console.log('Stars:', u.stars || 0);
  });
}

console.log('\n\nSearching all users...\n');

const { data: allUsers } = await supabase
  .from('users')
  .select('id, email, name')
  .limit(20);

if (allUsers && allUsers.length > 0) {
  console.log('All users in database (' + allUsers.length + '):');
  allUsers.forEach((u, i) => {
    console.log((i + 1) + '. ' + u.email + ' - ' + u.name);
  });
}
