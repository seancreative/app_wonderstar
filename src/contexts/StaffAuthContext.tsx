import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';
import { checkPermission, getPermissionsForRole, type StaffRole, type PermissionMap } from '../utils/staffPermissions';

interface StaffUser {
  id: string;
  email: string;
  staff_name: string;
  role: StaffRole;
  outlet_id: string | null;
  permissions: PermissionMap;
  assigned_permissions?: any;
  auth_id: string;
}

interface StaffAuthContextType {
  staff: StaffUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkPermission: (resource: string, action: string) => boolean;
  hasAnyPermission: (resource: string) => boolean;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

export const useStaffAuth = () => {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error('useStaffAuth must be used within StaffAuthProvider');
  }
  return context;
};

export const StaffAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStaffSession();
  }, []);

  const checkStaffSession = async () => {
    try {
      console.log('[StaffAuth] Checking staff session...');
      // Check Supabase Auth session instead of localStorage
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[StaffAuth] Session error:', sessionError);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log('[StaffAuth] Found Supabase Auth session');
        // Load staff from database using auth_id
        const { data: staffUser, error: staffError } = await supabase
          .from('staff_passcodes')
          .select('id, email, staff_name, role, outlet_id, assigned_permissions, auth_id')
          .eq('auth_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (staffError) {
          console.error('[StaffAuth] Error loading staff:', staffError);
        } else if (staffUser) {
          console.log('[StaffAuth] Staff loaded from database');
          const permissions = getPermissionsForRole(
            staffUser.role as StaffRole,
            staffUser.assigned_permissions || {}
          );
          setStaff({
            ...staffUser,
            permissions,
            assigned_permissions: staffUser.assigned_permissions
          });
        } else {
          console.log('[StaffAuth] No active staff found for this auth user');
        }
      } else {
        console.log('[StaffAuth] No Supabase Auth session found');
      }
    } catch (error) {
      console.error('[StaffAuth] Error checking staff session:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('[StaffAuth] Starting login for:', email);

      const { data: staffUser, error } = await supabase
        .from('staff_passcodes')
        .select('id, email, staff_name, role, outlet_id, password_hash, assigned_permissions, auth_id')
        .eq('email', email.toLowerCase().trim())
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('[StaffAuth] Database error:', error);
        throw error;
      }

      if (!staffUser) {
        console.error('[StaffAuth] No staff user found for email:', email);
        throw new Error('Invalid email or password');
      }

      if (!staffUser.password_hash) {
        console.error('[StaffAuth] No password hash found for user');
        throw new Error('Invalid email or password');
      }

      console.log('[StaffAuth] Verifying password...');
      const isAuthenticated = await bcrypt.compare(password, staffUser.password_hash);

      if (!isAuthenticated) {
        console.error('[StaffAuth] Authentication failed');
        throw new Error('Invalid email or password');
      }

      console.log('[StaffAuth] Password verified, signing in to Supabase Auth...');

      if (staffUser.auth_id) {
        // Staff has Supabase Auth account
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (authError) {
          console.error('[StaffAuth] Supabase Auth signin failed:', authError.message);
          throw new Error('Authentication failed. Please try again.');
        }
        console.log('[StaffAuth] Supabase Auth signin successful');
      } else {
        // Create Supabase Auth account for staff
        console.log('[StaffAuth] Creating Supabase Auth account...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              staff_id: staffUser.id,
              staff_role: staffUser.role
            }
          }
        });

        if (signUpError) {
          // Try to sign in (account might exist)
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
          });

          if (!authError && authData?.user?.id) {
            await supabase
              .from('staff_passcodes')
              .update({ auth_id: authData.user.id })
              .eq('id', staffUser.id);
            console.log('[StaffAuth] Linked existing auth_id to staff');
          } else {
            throw new Error('Authentication failed. Please contact administrator.');
          }
        } else if (signUpData?.user?.id) {
          await supabase
            .from('staff_passcodes')
            .update({ auth_id: signUpData.user.id })
            .eq('id', staffUser.id);
          console.log('[StaffAuth] Created and linked Supabase Auth account');
        }
      }

      // Update last used timestamp
      await supabase
        .from('staff_passcodes')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', staffUser.id);

      // Build staff object with permissions
      const permissions = getPermissionsForRole(
        staffUser.role as StaffRole,
        staffUser.assigned_permissions || {}
      );

      const { password_hash, ...staffData } = staffUser;
      setStaff({
        ...staffData,
        permissions,
        assigned_permissions: staffUser.assigned_permissions,
        auth_id: staffUser.auth_id || ''
      });
      console.log('[StaffAuth] Login successful, role:', staffUser.role);
    } catch (error) {
      console.error('[StaffAuth] Staff login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('[StaffAuth] Logging out...');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[StaffAuth] Error signing out:', error);
    } finally {
      setStaff(null);
      console.log('[StaffAuth] Logout complete');
    }
  };

  const checkStaffPermission = (resource: string, action: string): boolean => {
    if (!staff) return false;
    return checkPermission(staff.permissions, resource, action);
  };

  const hasAnyStaffPermission = (resource: string): boolean => {
    if (!staff) return false;
    const resourcePermissions = staff.permissions[resource] || [];
    return resourcePermissions.length > 0;
  };

  return (
    <StaffAuthContext.Provider
      value={{
        staff,
        loading,
        login,
        logout,
        checkPermission: checkStaffPermission,
        hasAnyPermission: hasAnyStaffPermission
      }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
};
