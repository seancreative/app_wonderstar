import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'outlet_manager' | 'staff' | 'analyst';
  avatar_url?: string;
  auth_id?: string;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkPermission: (resource: string, action: string) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    checkAdminSession();
  }, []);

  const checkAdminSession = async () => {
    try {
      console.log('[AdminAuth] Checking admin session...');
      // Check Supabase Auth session instead of localStorage
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[AdminAuth] Session error:', sessionError);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log('[AdminAuth] Found Supabase Auth session');
        // Load admin from database using auth_id
        const { data: adminUser, error: adminError } = await supabase
          .from('admin_users')
          .select('id, email, name, role, avatar_url, is_active, auth_id')
          .eq('auth_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (adminError) {
          console.error('[AdminAuth] Error loading admin:', adminError);
        } else if (adminUser) {
          console.log('[AdminAuth] Admin loaded from database');
          setAdmin(adminUser);
          await loadPermissions(adminUser.id);
        } else {
          console.log('[AdminAuth] No active admin found for this auth user');
        }
      } else {
        console.log('[AdminAuth] No Supabase Auth session found');
      }
    } catch (error) {
      console.error('[AdminAuth] Error checking admin session:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async (adminId: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_permissions')
        .select('resource, actions')
        .eq('admin_id', adminId);

      if (error) throw error;

      const permissionsMap: Record<string, string[]> = {};
      data?.forEach((perm) => {
        permissionsMap[perm.resource] = perm.actions || [];
      });
      setPermissions(permissionsMap);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('[AdminAuth] Starting login for:', email);

      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('id, email, name, role, avatar_url, is_active, auth_id')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!adminUser) throw new Error('Invalid credentials');

      const bcrypt = await import('bcryptjs');
      const { data: storedHash } = await supabase
        .from('admin_users')
        .select('password_hash')
        .eq('id', adminUser.id)
        .single();

      if (!storedHash) throw new Error('Invalid credentials');

      const isValidPassword = await bcrypt.compare(password, storedHash.password_hash);
      if (!isValidPassword) throw new Error('Invalid credentials');

      console.log('[AdminAuth] Password validated, checking Supabase Auth...');

      // CRITICAL: Sign in to Supabase Auth for RLS policies to work
      if (adminUser.auth_id) {
        // Admin has Supabase Auth account, sign in
        console.log('[AdminAuth] Admin has auth_id, signing in to Supabase Auth');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (authError) {
          console.warn('[AdminAuth] Supabase Auth signin failed:', authError.message);
          // Continue with custom auth, but admin won't see CMS data
        } else {
          console.log('[AdminAuth] Supabase Auth signin successful');
        }
      } else {
        // Admin doesn't have Supabase Auth account yet
        console.log('[AdminAuth] Admin missing auth_id, attempting to create Supabase Auth account');

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              admin_user_id: adminUser.id,
              role: 'admin'
            }
          }
        });

        if (signUpError) {
          console.error('[AdminAuth] Failed to create Supabase Auth account:', signUpError.message);
          // Try to sign in anyway (account might already exist)
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
          });

          if (!authError && authData?.user?.id) {
            console.log('[AdminAuth] Signed in to existing Supabase Auth account');
            // Link auth_id to admin_users
            await supabase
              .from('admin_users')
              .update({ auth_id: authData.user.id })
              .eq('id', adminUser.id);
            console.log('[AdminAuth] Linked auth_id to admin_users');
          }
        } else if (signUpData?.user?.id) {
          console.log('[AdminAuth] Created Supabase Auth account, linking auth_id');
          // Link the new auth_id to admin_users
          await supabase
            .from('admin_users')
            .update({ auth_id: signUpData.user.id })
            .eq('id', adminUser.id);
          console.log('[AdminAuth] Linked auth_id to admin_users');
        }
      }

      await supabase
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', adminUser.id);

      await supabase
        .from('admin_activity_logs')
        .insert({
          admin_id: adminUser.id,
          action: 'login',
          details: { email }
        });

      // No localStorage - admin session managed by Supabase Auth
      setAdmin(adminUser);
      await loadPermissions(adminUser.id);

      console.log('[AdminAuth] Login complete');
    } catch (error) {
      console.error('[AdminAuth] Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (admin) {
        await supabase
          .from('admin_activity_logs')
          .insert({
            admin_id: admin.id,
            action: 'logout',
            details: { email: admin.email }
          });
      }

      // Sign out from Supabase Auth
      await supabase.auth.signOut();

      // No localStorage to clear
      setAdmin(null);
      setPermissions({});
    } catch (error) {
      console.error('Logout error:', error);
      setAdmin(null);
      setPermissions({});
    }
  };

  const checkPermission = (resource: string, action: string): boolean => {
    if (admin?.role === 'super_admin') return true;
    return permissions[resource]?.includes(action) || false;
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout, checkPermission }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
