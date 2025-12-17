import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserTheme() {
  try {
    // First, get the user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('email', 'seancreative@gmail.com')
      .limit(1);

    if (userError) {
      console.error('Error fetching user:', userError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('User not found with email: seancreative@gmail.com');
      return;
    }

    const user = users[0];
    console.log('\n=== USER FOUND ===');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Name:', user.full_name);

    // Now check user preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (prefsError) {
      console.error('Error fetching preferences:', prefsError);
      return;
    }

    console.log('\n=== THEME PREFERENCES ===');
    if (prefs) {
      console.log('Theme:', prefs.theme || 'Not set (defaults to "colorful")');
      console.log('Full preferences:', JSON.stringify(prefs, null, 2));
    } else {
      console.log('No preferences found - using default theme: "colorful"');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkUserTheme();
