import React, { useState, useEffect } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import { Shield, Plus, Edit2, Power, Trash2, Check, X, AlertCircle, Users, Mail, Lock, Eye, EyeOff, RefreshCw, MapPin, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import bcrypt from 'bcryptjs';
import RoleSelector from '../../components/RoleSelector';
import { ROLE_LABELS, ROLE_COLORS, generatePassword, validatePassword, type StaffRole } from '../../utils/staffPermissions';

interface StaffMember {
  id: string;
  staff_name: string;
  email: string;
  role: StaffRole;
  outlet_id: string | null;
  outlet_name?: string;
  assigned_permissions?: any;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface Outlet {
  id: string;
  name: string;
  location: string;
}

const CMSStaff: React.FC = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    staff_name: '',
    email: '',
    password: '',
    role: 'staff' as StaffRole,
    outlet_id: '',
    description: '',
    permissions: {
      dashboard: true,
      orders: true,
      products: true,
      customers: true,
      redemptions: true,
      rewards: true,
      marketing: true,
      analytics: true,
      finance: true,
      settings: true
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [staffData, outletsData] = await Promise.all([
        supabase
          .from('staff_passcodes')
          .select(`
            id,
            staff_name,
            email,
            role,
            outlet_id,
            assigned_permissions,
            is_active,
            last_used_at,
            created_at,
            outlets:outlet_id (name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('outlets')
          .select('id, name, location')
          .eq('is_active', true)
          .order('name')
      ]);

      if (staffData.error) throw staffData.error;
      if (outletsData.error) throw outletsData.error;

      const staffWithOutlets = (staffData.data || []).map(s => ({
        ...s,
        outlet_name: s.outlets?.name || 'No Outlet'
      }));

      setStaff(staffWithOutlets);
      setOutlets(outletsData.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePassword = () => {
    const newPassword = generatePassword(12);
    setFormData(prev => ({ ...prev, password: newPassword }));
    setShowPassword(true);

    const validation = validatePassword(newPassword);
    setPasswordErrors(validation.errors);
  };

  const handlePasswordChange = (password: string) => {
    setFormData(prev => ({ ...prev, password }));
    const validation = validatePassword(password);
    setPasswordErrors(validation.errors);
  };

  const openAddModal = () => {
    setFormData({
      staff_name: '',
      email: '',
      password: '',
      role: 'staff',
      outlet_id: '',
      description: '',
      permissions: {
        dashboard: true,
        orders: true,
        products: true,
        customers: true,
        redemptions: true,
        rewards: true,
        marketing: true,
        analytics: true,
        finance: true,
        settings: true
      }
    });
    setEditingStaff(null);
    setShowAddModal(true);
    setError('');
    setSuccess('');
    setPasswordErrors([]);
    setShowPassword(false);
  };

  const openEditModal = (staffMember: StaffMember) => {
    const existingPermissions = staffMember.assigned_permissions || {};
    setFormData({
      staff_name: staffMember.staff_name,
      email: staffMember.email,
      password: '',
      role: staffMember.role,
      outlet_id: staffMember.outlet_id || '',
      description: '',
      permissions: {
        dashboard: existingPermissions.dashboard ?? true,
        orders: existingPermissions.orders ?? true,
        products: existingPermissions.products ?? true,
        customers: existingPermissions.customers ?? true,
        redemptions: existingPermissions.redemptions ?? true,
        rewards: existingPermissions.rewards ?? true,
        marketing: existingPermissions.marketing ?? true,
        analytics: existingPermissions.analytics ?? true,
        finance: existingPermissions.finance ?? true,
        settings: existingPermissions.settings ?? true
      }
    });
    setEditingStaff(staffMember);
    setShowAddModal(true);
    setError('');
    setSuccess('');
    setPasswordErrors([]);
    setShowPassword(false);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingStaff(null);
    setFormData({
      staff_name: '',
      email: '',
      password: '',
      role: 'staff',
      outlet_id: '',
      description: '',
      permissions: {
        dashboard: true,
        orders: true,
        products: true,
        customers: true,
        redemptions: true,
        rewards: true,
        marketing: true,
        analytics: true,
        finance: true,
        settings: true
      }
    });
    setError('');
    setPasswordErrors([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.staff_name.trim()) {
      setError('Staff name is required');
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!editingStaff && !formData.password) {
      setError('Password is required for new staff');
      return;
    }

    if (formData.password) {
      const validation = validatePassword(formData.password);
      if (!validation.valid) {
        setError('Password does not meet requirements');
        setPasswordErrors(validation.errors);
        return;
      }
    }

    try {
      if (editingStaff) {
        const updateData: any = {
          staff_name: formData.staff_name,
          email: formData.email.toLowerCase().trim(),
          role: formData.role,
          outlet_id: formData.outlet_id || null,
          assigned_permissions: formData.role === 'manager' ? formData.permissions : null
        };

        if (formData.password) {
          const salt = await bcrypt.genSalt(10);
          updateData.password_hash = await bcrypt.hash(formData.password, salt);
          // Note: If staff has auth_id, they'll need to re-login with new password
        }

        const { error: updateError } = await supabase
          .from('staff_passcodes')
          .update(updateData)
          .eq('id', editingStaff.id);

        if (updateError) throw updateError;
        setSuccess('Staff member updated successfully');
      } else {
        const { data: existingEmail } = await supabase
          .from('staff_passcodes')
          .select('id')
          .eq('email', formData.email.toLowerCase().trim())
          .maybeSingle();

        if (existingEmail) {
          setError('Email already exists');
          return;
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(formData.password, salt);

        // Create staff record (auth account will be created on first login)
        const { error: insertError } = await supabase
          .from('staff_passcodes')
          .insert({
            staff_name: formData.staff_name,
            email: formData.email.toLowerCase().trim(),
            password_hash,
            role: formData.role,
            outlet_id: formData.outlet_id || null,
            is_active: true,
            description: formData.description || null,
            assigned_permissions: formData.role === 'manager' ? formData.permissions : null,
            auth_id: null // Will be set on first login
          });

        if (insertError) throw insertError;
        setSuccess('Staff member created successfully');
      }

      await loadData();
      setTimeout(() => {
        closeModal();
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      console.error('Error saving staff:', err);
      setError(err.message || 'Failed to save staff member');
    }
  };

  const toggleStatus = async (staffMember: StaffMember) => {
    try {
      const { error: updateError } = await supabase
        .from('staff_passcodes')
        .update({ is_active: !staffMember.is_active })
        .eq('id', staffMember.id);

      if (updateError) throw updateError;

      await loadData();
      setSuccess(`Staff ${staffMember.is_active ? 'deactivated' : 'activated'} successfully`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error toggling status:', err);
      setError('Failed to update staff status');
    }
  };

  const deleteStaff = async (staffMember: StaffMember) => {
    if (!confirm(`Are you sure you want to delete ${staffMember.staff_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('staff_passcodes')
        .delete()
        .eq('id', staffMember.id);

      if (deleteError) throw deleteError;

      await loadData();
      setSuccess('Staff member deleted successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error deleting staff:', err);
      setError('Failed to delete staff member');
    }
  };

  if (loading) {
    return (
      <CMSLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading staff...</div>
        </div>
      </CMSLayout>
    );
  }

  return (
    <CMSLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-7 h-7" />
              Staff Management
            </h1>
            <p className="text-gray-600 mt-1">Manage staff accounts and roles</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Staff Member
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="text-green-800">{success}</span>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Outlet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.map((member) => (
                <tr key={member.id} className={!member.is_active ? 'opacity-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">{member.staff_name}</div>
                      <div className="text-sm text-gray-500">{member.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[member.role]}`}>
                      {ROLE_LABELS[member.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      {member.outlet_name || 'No Outlet'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {member.last_used_at
                      ? formatDateTimeCMS(member.last_used_at)
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(member)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleStatus(member)}
                        className={member.is_active ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}
                        title={member.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteStaff(member)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No staff members found. Click "Add Staff Member" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-red-800">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.staff_name}
                  onChange={(e) => setFormData({ ...formData, staff_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter staff name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="staff@example.com"
                    required
                    disabled={!!editingStaff}
                  />
                </div>
                {editingStaff && (
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed after creation</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Password {!editingStaff && '*'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className="w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={editingStaff ? 'Leave blank to keep current password' : 'Enter secure password'}
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="p-1.5 text-gray-400 hover:text-blue-600"
                      title="Generate password"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {passwordErrors.length > 0 && (
                  <ul className="mt-2 text-xs text-red-600 space-y-1">
                    {passwordErrors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                )}
                {!editingStaff && (
                  <p className="mt-1 text-xs text-gray-500">
                    Password must be at least 8 characters with uppercase, lowercase, number, and special character
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Role *
                </label>
                <RoleSelector
                  selectedRole={formData.role}
                  onChange={(role) => setFormData({ ...formData, role })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Assigned Outlet
                </label>
                <select
                  value={formData.outlet_id}
                  onChange={(e) => setFormData({ ...formData, outlet_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Outlets (Global Access)</option>
                  {outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name} - {outlet.location}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Optional: Restrict staff to a specific outlet
                </p>
              </div>

              {formData.role === 'manager' && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Manager Permissions
                  </label>
                  <p className="text-xs text-gray-600 mb-4">
                    Select which CMS sections this manager can access
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'dashboard', label: 'Dashboard' },
                      { key: 'orders', label: 'Orders' },
                      { key: 'products', label: 'Products' },
                      { key: 'customers', label: 'Customers' },
                      { key: 'redemptions', label: 'Redemptions' },
                      { key: 'rewards', label: 'Rewards' },
                      { key: 'marketing', label: 'Marketing' },
                      { key: 'analytics', label: 'Analytics' },
                      { key: 'finance', label: 'Finance' },
                      { key: 'settings', label: 'Settings' }
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          permissions: {
                            ...formData.permissions,
                            [key]: !formData.permissions[key as keyof typeof formData.permissions]
                          }
                        })}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
                      >
                        {formData.permissions[key as keyof typeof formData.permissions] ? (
                          <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingStaff ? 'Update Staff Member' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CMSLayout>
  );
};

export default CMSStaff;
