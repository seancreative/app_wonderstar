import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

async function createStaffMember() {
  try {
    const { data: outlets, error: outletError } = await supabase
      .from('outlets')
      .select('id, name')
      .limit(1)
      .single();

    if (outletError) throw outletError;

    const staffData = {
      staff_name: 'Test Staff',
      email: 'staff@wonderstars.com',
      passcode: '1234',
      outlet_id: outlets.id,
      is_active: true,
      is_superadmin: false,
      description: 'Test staff member for scanner access'
    };

    const { data, error } = await supabase
      .from('staff_passcodes')
      .insert(staffData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.log('Staff member already exists with this passcode, checking email...');
        const { data: existing, error: checkError } = await supabase
          .from('staff_passcodes')
          .select('*')
          .eq('passcode', staffData.passcode)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          const { data: updated, error: updateError } = await supabase
            .from('staff_passcodes')
            .update({ email: staffData.email })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) throw updateError;
          console.log('Staff member updated successfully:', updated);
        }
      } else {
        throw error;
      }
    } else {
      console.log('Staff member created successfully:', data);
    }

    console.log('\nYou can now login with:');
    console.log('Email: staff@wonderstars.com');
    console.log('Passcode: 1234');
  } catch (error) {
    console.error('Error creating staff member:', error);
  }
}

createStaffMember();
