import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, AlertCircle, CheckCircle, Loader, Users, Shield } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { formatDateTimeCMS } from '../../utils/dateFormatter';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lfmfzvhonbjgmejrevat.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUxNjM5MiwiZXhwIjoyMDc4MDkyMzkyfQ.lBi3z7dl1Od1uzEZlAwWw619LnojGJQzbeBnvDa4cN4';

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  auth_id: string | null;
  auth_migrated: boolean;
  created_at: string;
}

interface MigrationResult {
  email: string;
  name: string;
  success: boolean;
  tempPassword?: string;
  authId?: string;
  error?: string;
  alreadyMigrated?: boolean;
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 12;
  let password = 'TempPass';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default function CMSUserMigration() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await adminClient
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const migrateUser = async (user: User): Promise<MigrationResult> => {
    if (user.auth_migrated && user.auth_id) {
      return {
        email: user.email,
        name: user.name,
        success: true,
        alreadyMigrated: true
      };
    }

    const tempPassword = generateSecurePassword();

    try {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: user.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          phone: user.phone,
          migrated_from_custom_auth: true,
          original_user_id: user.id
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers();
          const existingAuthUser = existingAuthUsers?.users.find(u => u.email === user.email);

          if (existingAuthUser) {
            await adminClient
              .from('users')
              .update({
                auth_id: existingAuthUser.id,
                auth_migrated: true,
                auth_migrated_at: new Date().toISOString()
              })
              .eq('id', user.id);

            return {
              email: user.email,
              name: user.name,
              success: true,
              authId: existingAuthUser.id,
              tempPassword: 'Already existed'
            };
          }
        }
        throw authError;
      }

      await adminClient
        .from('users')
        .update({
          auth_id: authData.user.id,
          auth_migrated: true,
          auth_migrated_at: new Date().toISOString(),
          password_hash: `TEMP:${tempPassword}`
        })
        .eq('id', user.id);

      return {
        email: user.email,
        name: user.name,
        success: true,
        tempPassword,
        authId: authData.user.id
      };
    } catch (error: any) {
      return {
        email: user.email,
        name: user.name,
        success: false,
        error: error.message
      };
    }
  };

  const startMigration = async () => {
    if (!confirm('This will migrate all unmigrated users to Supabase Auth. Continue?')) {
      return;
    }

    setMigrating(true);
    setResults([]);
    const migrationResults: MigrationResult[] = [];

    const unmigrated = users.filter(u => !u.auth_migrated || !u.auth_id);
    setProgress({ current: 0, total: unmigrated.length });

    for (let i = 0; i < unmigrated.length; i++) {
      const user = unmigrated[i];
      setCurrentStep(`Migrating ${user.name} (${user.email})...`);

      const result = await migrateUser(user);
      migrationResults.push(result);

      setProgress({ current: i + 1, total: unmigrated.length });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setResults(migrationResults);
    setMigrating(false);
    setCurrentStep('Migration complete!');
    await loadUsers();
  };

  const downloadPasswords = () => {
    const passwordList = results
      .filter(r => r.success && r.tempPassword && r.tempPassword !== 'Already existed')
      .map(r => `${r.name},${r.email},${r.tempPassword}`)
      .join('\n');

    const blob = new Blob([`Name,Email,Temporary Password\n${passwordList}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-passwords-${new Date().toISOString()}.csv`;
    a.click();
  };

  const migratedCount = users.filter(u => u.auth_migrated && u.auth_id).length;
  const pendingCount = users.filter(u => !u.auth_migrated || !u.auth_id).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Migration to Supabase Auth</h1>
                <p className="text-sm text-gray-600">Migrate existing users to Supabase Authentication</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-1">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium">Total Users</span>
              </div>
              <p className="text-3xl font-bold text-blue-900">{users.length}</p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Migrated</span>
              </div>
              <p className="text-3xl font-bold text-green-900">{migratedCount}</p>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-orange-700 mb-1">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Pending</span>
              </div>
              <p className="text-3xl font-bold text-orange-900">{pendingCount}</p>
            </div>
          </div>

          {pendingCount > 0 && !migrating && results.length === 0 && (
            <div className="mb-6">
              <button
                onClick={startMigration}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Start Migration ({pendingCount} users)
              </button>
            </div>
          )}

          {migrating && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Loader className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-blue-900 font-medium">{currentStep}</span>
              </div>
              <div className="bg-white rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-blue-700 mt-2">
                {progress.current} / {progress.total} users migrated
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Migration Results</h2>
                <button
                  onClick={downloadPasswords}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Passwords CSV
                </button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Important: Save Temporary Passwords</p>
                    <p className="text-sm text-yellow-800 mt-1">
                      Users will need these passwords to log in for the first time. They should change their password after logging in.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                          <span className="font-medium text-gray-900">
                            {result.name} ({result.email})
                          </span>
                        </div>
                        {result.success && result.tempPassword && (
                          <div className="ml-7 mt-2">
                            {result.alreadyMigrated ? (
                              <p className="text-sm text-green-700">Already migrated</p>
                            ) : result.tempPassword === 'Already existed' ? (
                              <p className="text-sm text-green-700">Linked to existing auth account</p>
                            ) : (
                              <div className="bg-white p-2 rounded border border-green-300">
                                <p className="text-xs text-gray-600 mb-1">Temporary Password:</p>
                                <code className="text-sm font-mono text-gray-900 select-all">
                                  {result.tempPassword}
                                </code>
                              </div>
                            )}
                          </div>
                        )}
                        {result.error && (
                          <p className="text-sm text-red-700 ml-7 mt-1">Error: {result.error}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">All Users</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        {user.auth_migrated && user.auth_id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Migrated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDateTimeCMS(user.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
