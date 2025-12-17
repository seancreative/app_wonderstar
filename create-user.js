import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://0ec90b57d6e95fcbda19832f.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createUser() {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        name: 'Test User',
        email: 'test@wonderstars.com',
        phone: '+60123456789',
        referral_code: 'TEST123',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return;
    }

    console.log('\n✅ Account created successfully!\n');
    console.log('='.repeat(50));
    console.log('LOGIN CREDENTIALS');
    console.log('='.repeat(50));
    console.log('Email:    test@wonderstars.com');
    console.log('Password: (any password works for demo)');
    console.log('='.repeat(50));
    console.log('\nAccount Details:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n');
  } catch (err) {
    console.error('Error:', err);
  }
}

createUser();
