import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';

interface KitchenUser {
  id: string;
  email: string;
  staff_name: string;
  role: string;
  outlet_id: string | null;
  auth_id: string;
  isAdmin: boolean;
}

interface KitchenAuthContextType {
  kitchenUser: KitchenUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const KitchenAuthContext = createContext<KitchenAuthContextType | undefined>(undefined);

export const useKitchenAuth = () => {
  const context = useContext(KitchenAuthContext);
  if (!context) {
    throw new Error('useKitchenAuth must be used within KitchenAuthProvider');
  }
  return context;
};

export const KitchenAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [kitchenUser, setKitchenUser] = useState<KitchenUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkKitchenSession();
  }, []);

  const checkKitchenSession = async () => {
    try {
      console.log('[KitchenAuth] Checking kitchen session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[KitchenAuth] Session error:', sessionError);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log('[KitchenAuth] Found Supabase Auth session');

        const { data: staffUser, error: staffError } = await supabase
          .from('staff_passcodes')
          .select('id, email, staff_name, role, outlet_id, auth_id')
          .eq('auth_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (staffError) {
          console.error('[KitchenAuth] Error loading staff:', staffError);
        } else if (staffUser) {
          console.log('[KitchenAuth] Kitchen user loaded from database');
          setKitchenUser({
            ...staffUser,
            isAdmin: staffUser.role === 'admin'
          });
        } else {
          console.log('[KitchenAuth] No active kitchen user found for this auth user');
        }
      } else {
        console.log('[KitchenAuth] No Supabase Auth session found');
      }
    } catch (error) {
      console.error('[KitchenAuth] Error checking kitchen session:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('[KitchenAuth] Starting KMS login for:', email);

      const { data: staffUser, error } = await supabase
        .from('staff_passcodes')
        .select('id, email, staff_name, role, outlet_id, password_hash, auth_id')
        .eq('email', email.toLowerCase().trim())
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[KitchenAuth] Database error:', error);
        throw error;
      }

      if (!staffUser) {
        console.error('[KitchenAuth] No staff user found for email:', email);
        throw new Error('Invalid email or password');
      }

      if (!staffUser.password_hash) {
        console.error('[KitchenAuth] No password hash found for user');
        throw new Error('Invalid email or password');
      }

      console.log('[KitchenAuth] Verifying password...');
      const isAuthenticated = await bcrypt.compare(password, staffUser.password_hash);

      if (!isAuthenticated) {
        console.error('[KitchenAuth] Authentication failed');
        throw new Error('Invalid email or password');
      }

      console.log('[KitchenAuth] Password verified, signing in to Supabase Auth...');

      if (staffUser.auth_id) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (authError) {
          console.error('[KitchenAuth] Supabase Auth signin failed:', authError.message);
          throw new Error('Authentication failed. Please try again.');
        }
        console.log('[KitchenAuth] Supabase Auth signin successful');
      } else {
        console.log('[KitchenAuth] Creating Supabase Auth account...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              staff_id: staffUser.id,
              staff_role: staffUser.role,
              kms_user: true
            }
          }
        });

        if (signUpError) {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
          });

          if (!authError && authData?.user?.id) {
            await supabase
              .from('staff_passcodes')
              .update({ auth_id: authData.user.id })
              .eq('id', staffUser.id);
            console.log('[KitchenAuth] Linked existing auth_id to staff');
          } else {
            throw new Error('Authentication failed. Please contact administrator.');
          }
        } else if (signUpData?.user?.id) {
          await supabase
            .from('staff_passcodes')
            .update({ auth_id: signUpData.user.id })
            .eq('id', staffUser.id);
          console.log('[KitchenAuth] Created and linked Supabase Auth account');
        }
      }

      await supabase
        .from('staff_passcodes')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', staffUser.id);

      const { password_hash, ...staffData } = staffUser;
      setKitchenUser({
        ...staffData,
        auth_id: staffUser.auth_id || '',
        isAdmin: staffUser.role === 'admin'
      });
      console.log('[KitchenAuth] KMS login successful, role:', staffUser.role);
    } catch (error) {
      console.error('[KitchenAuth] KMS login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('[KitchenAuth] Logging out from KMS...');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[KitchenAuth] Error signing out:', error);
    } finally {
      setKitchenUser(null);
      console.log('[KitchenAuth] KMS logout complete');
    }
  };

  return (
    <KitchenAuthContext.Provider
      value={{
        kitchenUser,
        loading,
        login,
        logout
      }}
    >
      {children}
    </KitchenAuthContext.Provider>
  );
};
