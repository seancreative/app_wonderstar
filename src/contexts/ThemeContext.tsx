import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Theme = 'light' | 'dark' | 'colorful' | 'robotic' | 'aifuture' | 'cyberpunk' | 'icecream' | 'pastel';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('colorful');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Defer theme loading to after initial render to reduce initial API calls
    const loadThemeDeferred = () => {
      const loadUserAndTheme = async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // User is logged in, load theme from database
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', session.user.id)
            .maybeSingle();

          if (userData?.id) {
            setUserId(userData.id);
            loadThemeFromDatabase(userData.id);
          }
        }
        // For anonymous users, use default theme (no localStorage)
      };

      loadUserAndTheme();
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(loadThemeDeferred, { timeout: 2000 });
    } else {
      setTimeout(loadThemeDeferred, 100);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const loadThemeFromDatabase = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', uid)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading theme:', error);
        return;
      }

      if (data?.theme) {
        setThemeState(data.theme as Theme);
      }
    } catch (error) {
      console.error('Error loading theme from database:', error);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    // No localStorage - save to database only

    if (userId) {
      try {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: userId,
            theme: newTheme,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (error) {
          console.error('Error saving theme:', error);
        }
      } catch (error) {
        console.error('Error updating theme:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
