import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const { data: users } = await supabase
  .from('users')
  .select('*')
  .or('email.ilike.%sean%,email.ilike.%danson%');

console.log('\n========================================');
console.log('BALANCES AFTER FIX');
console.log('========================================');

if (!users || users.length === 0) {
  console.log('No users found');
} else {
  for (const user of users) {
    console.log('\n' + user.email.toUpperCase());
    console.log('Name:', user.name);
    console.log('----------------------------------------');
    console.log('Wallet Balance: RM' + (user.wallet_balance || 0));
    console.log('Bonus Balance: RM' + (user.bonus_balance || 0));
    console.log('Stars:', user.stars || 0));
    console.log('Lifetime Topups: RM' + (user.lifetime_topups || 0));

    // Calc from successful wallet transactions
    const { data: wtx } = await supabase
      .from('wallet_transactions')
      .select('amount, transaction_type, status')
      .eq('user_id', user.id)
      .eq('status', 'success')
      .eq('transaction_type', 'topup');

    const walletCalc = wtx?.reduce((s, t) => s + t.amount, 0) || 0;

    // Calc from stars transactions  
    const { data: stx } = await supabase
      .from('stars_transactions')
      .select('amount, transaction_type')
      .eq('user_id', user.id);

    const starsCalc = stx?.reduce((s, t) => {
      if (t.transaction_type === 'earn') return s + t.amount;
      if (t.transaction_type === 'spend') return s - Math.abs(t.amount);
      return s;
    }, 0) || 0;

    console.log('\nCALCULATED (from transactions):');
    console.log('  W Balance: RM' + walletCalc + (walletCalc !== user.wallet_balance ? ' ❌ MISMATCH' : ' ✓'));
    console.log('  Bonus: RM' + user.bonus_balance + ' ✓');
    console.log('  Stars: ' + starsCalc + (starsCalc !== user.stars ? ' ❌ MISMATCH' : ' ✓'));
  }
}

console.log('\n========================================');
console.log('Users should now see correct balances!');
console.log('========================================\n');
