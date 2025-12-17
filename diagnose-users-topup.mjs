import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

const emails = ['seancreative@gmail.com', 'danson3@gmail.com'];

for (const email of emails) {
  console.log('\n========================================');
  console.log('USER:', email);
  console.log('========================================');

  const { data: user } = await supabase
    .from('users')
    .select('id, email, name, wallet_balance, bonus_balance, stars, lifetime_topups')
    .eq('email', email)
    .single();

  if (!user) {
    console.log('User not found');
    continue;
  }

  console.log('USER INFO:');
  console.log('  ID:', user.id);
  console.log('  Name:', user.name);
  console.log('  Wallet Balance: RM' + (user.wallet_balance || 0));
  console.log('  Bonus Balance: RM' + (user.bonus_balance || 0));
  console.log('  Stars:', user.stars || 0);
  console.log('  Lifetime Topups: RM' + (user.lifetime_topups || 0));

  const { data: payments } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nPAYMENT TRANSACTIONS (Last 3):');
  if (payments && payments.length > 0) {
    payments.forEach((p, i) => {
      console.log('  ' + (i + 1) + '. Order:', p.unique_order_id);
      console.log('     Status:', p.status);
      console.log('     Amount: RM' + p.amount);
      console.log('     Type:', p.payment_type);
      console.log('     Wallet TX ID:', p.wallet_transaction_id || 'None');
      console.log('     Metadata:', JSON.stringify(p.metadata || {}));
    });
  } else {
    console.log('  None found');
  }

  const { data: walletTxs } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nWALLET TRANSACTIONS (Last 3):');
  if (walletTxs && walletTxs.length > 0) {
    walletTxs.forEach((w, i) => {
      console.log('  ' + (i + 1) + '. Type:', w.transaction_type);
      console.log('     Status:', w.status);
      console.log('     Amount: RM' + w.amount);
      console.log('     Bonus: RM' + (w.bonus_amount || 0));
      console.log('     Description:', w.description);
    });
  } else {
    console.log('  None found');
  }

  const { data: starsTxs } = await supabase
    .from('stars_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nSTARS TRANSACTIONS (Last 3):');
  if (starsTxs && starsTxs.length > 0) {
    starsTxs.forEach((s, i) => {
      console.log('  ' + (i + 1) + '. Type:', s.transaction_type);
      console.log('     Amount:', s.amount);
      console.log('     Source:', s.source);
      console.log('     Metadata:', JSON.stringify(s.metadata || {}));
    });
  } else {
    console.log('  None found');
  }

  const { data: bonusTxs } = await supabase
    .from('bonus_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nBONUS TRANSACTIONS (Last 3):');
  if (bonusTxs && bonusTxs.length > 0) {
    bonusTxs.forEach((b, i) => {
      console.log('  ' + (i + 1) + '. Type:', b.transaction_type);
      console.log('     Amount: RM' + b.amount);
      console.log('     Source:', b.source);
    });
  } else {
    console.log('  None found');
  }
}

console.log('\n========================================');
console.log('DIAGNOSIS COMPLETE');
console.log('========================================');
