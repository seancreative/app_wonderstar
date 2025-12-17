import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const emails = ['seancreative@gmail.com', 'danson3@gmail.com'];

for (const email of emails) {
  console.log('\n================================================');
  console.log('USER:', email);
  console.log('================================================');

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (!user) {
    console.log('NOT FOUND');
    continue;
  }

  console.log('\nCURRENT STATE:');
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

  console.log('\nLAST 3 PAYMENTS:');
  if (payments && payments.length > 0) {
    for (const p of payments) {
      console.log('\n  Order:', p.unique_order_id);
      console.log('  Status:', p.status);
      console.log('  Amount: RM' + p.amount);
      console.log('  Wallet TX ID:', p.wallet_transaction_id || 'None');
      if (p.metadata) {
        const m = p.metadata;
        console.log('  Package ID:', m.package_id);
        console.log('  Base Stars:', m.base_stars);
        console.log('  Extra Stars:', m.extra_stars);
        console.log('  Bonus Amount:', m.bonus_amount);
      }
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

  console.log('\nLAST 3 WALLET TX:');
  if (walletTxs && walletTxs.length > 0) {
    for (const w of walletTxs) {
      console.log('\n  Type:', w.transaction_type);
      console.log('  Status:', w.status);
      console.log('  Amount: RM' + w.amount);
      console.log('  Bonus: RM' + (w.bonus_amount || 0));
      console.log('  Description:', w.description);
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

  console.log('\nLAST 3 STARS TX:');
  if (starsTxs && starsTxs.length > 0) {
    for (const s of starsTxs) {
      console.log('\n  Type:', s.transaction_type);
      console.log('  Amount:', s.amount);
      console.log('  Source:', s.source);
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

  console.log('\nLAST 3 BONUS TX:');
  if (bonusTxs && bonusTxs.length > 0) {
    for (const b of bonusTxs) {
      console.log('\n  Type:', b.transaction_type);
      console.log('  Amount: RM' + b.amount);
      console.log('  Source:', b.source);
      console.log('  Description:', b.description);
    }
  } else {
    console.log('  None');
  }
}

console.log('\n================================================');
console.log('COMPLETE');
console.log('================================================');
