import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

const emails = ['seancreative@gmail.com', 'danson3@gmail.com'];

for (const email of emails) {
  console.log('\n=========================================');
  console.log('USER:', email);
  console.log('=========================================');

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (!user) {
    console.log('ERROR: User not found');
    continue;
  }

  console.log('Name:', user.name);
  console.log('Wallet: RM' + (user.wallet_balance || 0));
  console.log('Bonus: RM' + (user.bonus_balance || 0));
  console.log('Stars:', user.stars || 0);
  console.log('Lifetime Topups: RM' + (user.lifetime_topups || 0));

  const { data: payments } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nPAYMENT TRANSACTIONS (Last 3):');
  if (payments && payments.length > 0) {
    for (const p of payments) {
      console.log('  Order:', p.unique_order_id, '| Status:', p.status, '| Amount: RM' + p.amount);
      console.log('  Metadata:', JSON.stringify(p.metadata));
    }
  } else {
    console.log('  None');
  }

  const { data: walletTxs } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nWALLET TRANSACTIONS (Last 3):');
  if (walletTxs && walletTxs.length > 0) {
    for (const w of walletTxs) {
      console.log('  Type:', w.transaction_type, '| Status:', w.status, '| Amount: RM' + w.amount, '| Bonus: RM' + (w.bonus_amount || 0));
    }
  } else {
    console.log('  None');
  }

  const { data: starsTxs } = await supabase
    .from('stars_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false})
    .limit(3);

  console.log('\nSTARS TRANSACTIONS (Last 3):');
  if (starsTxs && starsTxs.length > 0) {
    for (const s of starsTxs) {
      console.log('  Type:', s.transaction_type, '| Amount:', s.amount, '| Source:', s.source);
    }
  } else {
    console.log('  None');
  }

  const { data: bonusTxs } = await supabase
    .from('bonus_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nBONUS TRANSACTIONS (Last 3):');
  if (bonusTxs && bonusTxs.length > 0) {
    for (const b of bonusTxs) {
      console.log('  Type:', b.transaction_type, '| Amount: RM' + b.amount, '| Source:', b.source);
    }
  } else {
    console.log('  None');
  }
}

console.log('\n=========================================');
console.log('COMPLETE');
console.log('=========================================');
