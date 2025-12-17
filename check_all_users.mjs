import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lfmfzvhonbjgmejrevat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllUsersThemes() {
  try {
    // Get all users with their preferences
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .limit(10);

    if (userError) {
      console.error('Error fetching users:', userError);
      return;
    }

    console.log('\n=== ALL USERS ===');
    console.log('Found', users?.length || 0, 'users');
    
    if (users && users.length > 0) {
      for (const user of users) {
        console.log('\n---');
        console.log('Email:', user.email);
        console.log('Name:', user.name);
        
        // Get preferences
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('theme')
          .eq('user_id', user.id)
          .maybeSingle();
          
        console.log('Theme:', prefs?.theme || 'colorful (default)');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllUsersThemes();
