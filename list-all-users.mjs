import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

const { data: users } = await supabase
  .from('users')
  .select('id, email, name, wallet_balance, bonus_balance, stars, lifetime_topups')
  .order('created_at', { ascending: false })
  .limit(20);

console.log('\nAll Users (Last 20):');
console.log('='.repeat(80));

if (users && users.length > 0) {
  users.forEach((u, i) => {
    console.log((i + 1) + '. ' + u.email);
    console.log('   Name: ' + u.name);
    console.log('   ID: ' + u.id);
    console.log('   W: RM' + (u.wallet_balance || 0) + ' | B: RM' + (u.bonus_balance || 0) + ' | S: ' + (u.stars || 0) + ' | LT: RM' + (u.lifetime_topups || 0));
    console.log('');
  });
} else {
  console.log('No users found');
}
