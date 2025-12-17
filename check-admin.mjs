import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lfmfzvhonbjgmejrevat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4'
);

console.log('Checking admin users...\n');

const { data: admins, error } = await supabase
  .from('admin_users')
  .select('id, email, name, role, auth_id, is_active')
  .order('created_at', { ascending: true });

if (error) {
  console.error('Error:', error);
} else {
  console.log('Found', admins.length, 'admin users:\n');
  admins.forEach((admin, index) => {
    console.log((index + 1) + '. ' + admin.email);
    console.log('   Name: ' + admin.name);
    console.log('   Role: ' + admin.role);
    console.log('   Active: ' + admin.is_active);
    console.log('   Auth ID: ' + (admin.auth_id || 'NOT SET'));
    console.log('');
  });
}
