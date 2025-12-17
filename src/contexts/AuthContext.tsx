import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../types/database';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, phone: string, password: string, country?: string, state?: string, zipcode?: string, termsAccepted?: boolean, pdpaAccepted?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  reloadUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        if (session?.user) {
          await loadUserFromAuth(session.user.id);
        } else {
          setUser(null);
          setLoading(false);
        }
      })();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Auto-refresh user data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session?.user) {
        console.log('[AuthContext] Page visible, refreshing user data');
        loadUserFromAuth(session.user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session]);

  const initializeAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setSession(session);
        await loadUserFromAuth(session.user.id);
      }
      // No localStorage fallback - rely 100% on Supabase Auth
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserFromAuth = async (authId: string) => {
    console.log('[AuthContext] Loading user from auth_id:', authId);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Error loading user:', error);
        throw error;
      }

      if (data) {
        console.log('[AuthContext] User loaded successfully:', {
          id: data.id,
          name: data.name,
          email: data.email
        });
        setUser(data);
        // No localStorage - session is managed by Supabase Auth
      } else {
        console.warn('[AuthContext] No user found for auth_id:', authId);
      }
    } catch (error) {
      console.error('[AuthContext] Error loading user from auth:', error);
    }
  };

  // Legacy function removed - no longer using localStorage
  // All authentication is now through Supabase Auth sessions

  const signup = async (name: string, email: string, phone: string, password: string, country?: string, state?: string, zipcode?: string, termsAccepted?: boolean, pdpaAccepted?: boolean) => {
    setLoading(true);
    try {
      const referralCode = `WS${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create auth user');
      if (!authData.session) throw new Error('No session created');

      await supabase.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      });

      const { data: phoneVerification } = await supabase
        .from('phone_verifications')
        .select('verified, verified_at')
        .eq('phone', phone)
        .maybeSingle();

      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          name,
          email,
          phone,
          country,
          state,
          zipcode,
          terms_accepted: termsAccepted,
          pdpa_accepted: pdpaAccepted,
          referral_code: referralCode,
          auth_migrated: true,
          auth_migrated_at: new Date().toISOString(),
          phone_verified: phoneVerification?.verified || false,
          phone_verified_at: phoneVerification?.verified_at || null,
        })
        .select()
        .single();

      if (userError) throw userError;

      setUser(userData);
      setSession(authData.session);
      // No localStorage - session managed by Supabase Auth

      await supabase.from('notifications').insert({
        user_id: userData.id,
        title: 'Welcome to WonderStars!',
        message: 'Start earning stars on every visit and unlock amazing rewards.',
        notification_type: 'system'
      });
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('Auth login failed, trying legacy mode:', error.message);
        const { data: legacyUser, error: legacyError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (legacyError) throw legacyError;
        if (!legacyUser) throw new Error('User not found');

        if (!legacyUser.auth_id) {
          console.warn('User not migrated to Supabase Auth yet');
          throw new Error('Please contact support to migrate your account to the new system');
        }

        throw error;
      }

      if (!data.user) throw new Error('Login failed');

      setSession(data.session);
      await loadUserFromAuth(data.user.id);
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setSession(null);
      // No localStorage to clear - Supabase Auth handles session cleanup
    }
  };

  const resetPassword = async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
      // Store attempt in sessionStorage before API call
      sessionStorage.setItem('email_debug_data', JSON.stringify({
        email,
        redirectTo,
        status: 'pending',
        message: 'Sending password reset email...',
        timestamp: new Date().toISOString(),
        supabaseUrl,
        authEvent: null
      }));

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        // Update with error status
        sessionStorage.setItem('email_debug_data', JSON.stringify({
          email,
          redirectTo,
          status: 'error',
          message: error.message || 'Failed to send reset email',
          timestamp: new Date().toISOString(),
          supabaseUrl,
          authEvent: null
        }));
        throw error;
      }

      // Update with success status
      sessionStorage.setItem('email_debug_data', JSON.stringify({
        email,
        redirectTo,
        status: 'success',
        message: 'Password reset email sent successfully',
        timestamp: new Date().toISOString(),
        supabaseUrl,
        authEvent: null
      }));
    } catch (error) {
      throw error;
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const reloadUser = async () => {
    if (!session?.user) return;
    await loadUserFromAuth(session.user.id);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      login,
      signup,
      logout,
      updateUser,
      reloadUser,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
