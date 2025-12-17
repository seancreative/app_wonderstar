import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env', 'utf-8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testMyQRTopups() {
  console.log('Testing MyQR Wallet Topup Display\n');
  console.log('================================================\n');

  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .limit(5);

  for (const user of users || []) {
    const { data: topups } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('transaction_type', 'topup')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(3);

    if (topups && topups.length > 0) {
      console.log('User:', user.name, user.email);
      console.log('Found', topups.length, 'successful topups\n');

      topups.forEach((topup, idx) => {
        console.log('Topup', idx + 1);
        console.log('  Amount: RM', topup.amount);
        console.log('  Bonus: RM', topup.bonus_amount || 0);
        console.log('  Status:', topup.status);
        console.log('  Order Number:', topup.metadata?.order_number || 'N/A');
        console.log('  Payment Method:', topup.metadata?.payment_method || 'N/A');
        console.log('  Created:', new Date(topup.created_at).toLocaleString());
        
        if (topup.metadata?.order_number) {
          console.log('  Will show in MyQR with View Receipt button');
        }
        console.log('');
      });

      console.log('================================================\n');
      break;
    }
  }
}

testMyQRTopups();
