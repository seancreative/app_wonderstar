import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const emails = ['seancreative@gmail.com', 'danson3@gmail.com'];

console.log('\n================================================================================');
console.log('TOPUP DIAGNOSIS FOR USERS');
console.log('================================================================================\n');

for (const email of emails) {
  console.log('================================================================================');
  console.log(`USER: ${email}`);
  console.log('================================================================================\n');

  const { data: user } = await supabase
    .from('users')
    .select('id, email, name, wallet_balance, bonus_balance, stars, lifetime_topups')
    .eq('email', email)
    .single();

  if (!user) {
    console.log('User not found\n');
    continue;
  }

  console.log('USER INFO:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Wallet Balance: RM${user.wallet_balance || 0}`);
  console.log(`   Bonus Balance: RM${user.bonus_balance || 0}`);
  console.log(`   Stars: ${user.stars || 0}`);
  console.log(`   Lifetime Topups: RM${user.lifetime_topups || 0}\n`);

  const { data: payments } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('PAYMENT TRANSACTIONS (Last 5):');
  if (!payments || payments.length === 0) {
    console.log('   No transactions found\n');
  } else {
    payments.forEach((p, i) => {
      console.log(`   ${i + 1}. Payment #${p.unique_order_id || p.id.slice(0, 8)}`);
      console.log(`      Status: ${p.status}`);
      console.log(`      Amount: RM${p.amount}`);
      console.log(`      Type: ${p.payment_type}`);
      console.log(`      Created: ${new Date(p.created_at).toLocaleString()}`);
      console.log(`      Wallet TX ID: ${p.wallet_transaction_id || 'N/A'}`);
      if (p.metadata) {
        console.log(`      Metadata: ${JSON.stringify(p.metadata)}`);
      }
      console.log('');
    });
  }

  const { data: walletTxs } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('WALLET TRANSACTIONS (Last 5):');
  if (!walletTxs || walletTxs.length === 0) {
    console.log('   No transactions found\n');
  } else {
    walletTxs.forEach((w, i) => {
      console.log(`   ${i + 1}. Wallet TX #${w.id.slice(0, 8)}`);
      console.log(`      Type: ${w.transaction_type}, Status: ${w.status}`);
      console.log(`      Amount: RM${w.amount}, Bonus: RM${w.bonus_amount || 0}`);
      console.log(`      Description: ${w.description}`);
      console.log(`      Created: ${new Date(w.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  const { data: starsTxs } = await supabase
    .from('stars_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false})
    .limit(5);

  console.log('STARS TRANSACTIONS (Last 5):');
  if (!starsTxs || starsTxs.length === 0) {
    console.log('   No transactions found\n');
  } else {
    starsTxs.forEach((s, i) => {
      console.log(`   ${i + 1}. Stars TX #${s.id.slice(0, 8)}`);
      console.log(`      Type: ${s.transaction_type}, Amount: ${s.amount}`);
      console.log(`      Source: ${s.source}, Multiplier: ${s.multiplier}`);
      console.log(`      Created: ${new Date(s.created_at).toLocaleString()}`);
      if (s.metadata) {
        console.log(`      Metadata: ${JSON.stringify(s.metadata)}`);
      }
      console.log('');
    });
  }

  const { data: bonusTxs } = await supabase
    .from('bonus_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('BONUS TRANSACTIONS (Last 5):');
  if (!bonusTxs || bonusTxs.length === 0) {
    console.log('   No transactions found\n');
  } else {
    bonusTxs.forEach((b, i) => {
      console.log(`   ${i + 1}. Bonus TX #${b.id.slice(0, 8)}`);
      console.log(`      Type: ${b.transaction_type}, Amount: RM${b.amount}`);
      console.log(`      Source: ${b.source}`);
      console.log(`      Description: ${b.description}`);
      console.log(`      Created: ${new Date(b.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  const { data: packages } = await supabase
    .from('wallet_topup_packages')
    .select('*')
    .eq('amount', 1)
    .eq('is_active', true);

  console.log('RM1 TOPUP PACKAGE:');
  if (!packages || packages.length === 0) {
    console.log('   No package found\n');
  } else {
    const pkg = packages[0];
    console.log(`   ID: ${pkg.id}`);
    console.log(`   Amount: RM${pkg.amount}`);
    console.log(`   Bonus Amount: RM${pkg.bonus_amount || 0}`);
    console.log(`   Base Stars: ${pkg.base_stars || 0}`);
    console.log(`   Extra Stars: ${pkg.extra_stars || 0}`);
    console.log(`   Total Stars: ${(pkg.base_stars || 0) + (pkg.extra_stars || 0)}\n`);
  }
}

console.log('================================================================================');
console.log('DIAGNOSIS COMPLETE');
console.log('================================================================================\n');
