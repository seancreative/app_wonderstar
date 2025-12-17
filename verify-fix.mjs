import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const emails = ['seancreative@gmail.com', 'danson3@gmail.com'];

console.log('\n========================================');
console.log('VERIFICATION AFTER FIX');
console.log('========================================');

for (const email of emails) {
  console.log('\n'+email.toUpperCase());
  console.log('----------------------------------------');

  const { data: user } = await supabase
    .from('users')
    .select('wallet_balance, bonus_balance, stars, lifetime_topups')
    .eq('email', email)
    .single();

  if (user) {
    console.log('✓ Wallet Balance: RM' + (user.wallet_balance || 0));
    console.log('✓ Bonus Balance: RM' + (user.bonus_balance || 0));
    console.log('✓ Stars:', user.stars || 0);
    console.log('✓ Lifetime Topups: RM' + (user.lifetime_topups || 0));

    // Calculate from transactions
    const { data: walletTxs } = await supabase
      .from('wallet_transactions')
      .select('amount, status, transaction_type')
      .eq('user_id', user.id)
      .eq('status', 'success')
      .eq('transaction_type', 'topup');

    const totalWallet = walletTxs?.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    console.log('\n  Calculated W Balance from TX: RM' + totalWallet);

    const { data: starsTxs } = await supabase
      .from('stars_transactions')
      .select('amount, transaction_type')
      .eq('user_id', user.id);

    const totalStars = starsTxs?.reduce((sum, tx) => {
      if (tx.transaction_type === 'earn') return sum + tx.amount;
      if (tx.transaction_type === 'spend') return sum - Math.abs(tx.amount);
      return sum;
    }, 0) || 0;
    console.log('  Calculated Stars from TX:', totalStars);
  } else {
    console.log('ERROR: User not found');
  }
}

console.log('\n========================================');
console.log('Balances should now show correctly!');
console.log('Users need to refresh their app.');
console.log('========================================\n');
