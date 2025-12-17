import React, { useState } from 'react';
import { X, Lock, Phone, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';
import { activityTimelineService } from '../services/activityTimelineService';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onUpdate,
}) => {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const validateMalaysianPhone = (phoneNumber: string): boolean => {
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.startsWith('60')) {
      return /^60\d{9,10}$/.test(cleaned);
    }

    return /^0\d{9,10}$/.test(cleaned);
  };

  const formatMalaysianPhone = (phoneNumber: string): string => {
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.startsWith('60')) {
      return cleaned;
    }

    if (cleaned.startsWith('0')) {
      return '60' + cleaned.substring(1);
    }

    return '60' + cleaned;
  };

  const validatePasswordStrength = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const getPasswordStrengthColor = (password: string): string => {
    if (!password) return 'bg-gray-200';
    const strength = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;

    if (strength <= 2) return 'bg-red-400';
    if (strength === 3) return 'bg-yellow-400';
    if (strength === 4) return 'bg-blue-400';
    return 'bg-green-400';
  };

  const getPasswordStrengthText = (password: string): string => {
    if (!password) return '';
    const strength = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;

    if (strength <= 2) return 'Weak';
    if (strength === 3) return 'Fair';
    if (strength === 4) return 'Good';
    return 'Strong';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!user) return;

    if (phone && phone !== user.phone && !validateMalaysianPhone(phone)) {
      setError('Please enter a valid Malaysian phone number');
      return;
    }

    if (newPassword) {
      if (!currentPassword) {
        setError('Please enter your current password to change it');
        return;
      }

      if (!user.password_hash) {
        setError('No password set for this account');
        return;
      }

      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidCurrentPassword) {
        setError('Current password is incorrect');
        return;
      }

      const strengthError = validatePasswordStrength(newPassword);
      if (strengthError) {
        setError(strengthError);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      const updates: any = {};

      if (phone !== user.phone) {
        updates.phone = formatMalaysianPhone(phone);
      }

      if (newPassword) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        updates.password_hash = hashedPassword;
      }

      if (Object.keys(updates).length === 0) {
        setError('No changes to save');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Log activity
      const fieldsUpdated = [];
      if (updates.phone) fieldsUpdated.push('phone');
      if (updates.password_hash) fieldsUpdated.push('password');

      if (fieldsUpdated.length > 0) {
        await activityTimelineService.helpers.logProfileUpdate(user.id, fieldsUpdated);
      }

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onUpdate();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-slide-up">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-600 p-6 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white">Edit Profile</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-all"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold theme-text-secondary mb-2">
                Name (Cannot be changed)
              </label>
              <div className="p-4 bg-gray-100 rounded-xl border-2 border-gray-200">
                <p className="font-bold theme-text-primary">{user?.name}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold theme-text-secondary mb-2">
                Email (Cannot be changed)
              </label>
              <div className="p-4 bg-gray-100 rounded-xl border-2 border-gray-200">
                <p className="font-bold theme-text-primary">{user?.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold theme-text-secondary mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., 0123456789 or 60123456789"
                className="w-full p-4 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all font-bold"
              />
              <p className="text-xs theme-text-secondary mt-1 ml-1">
                Malaysian phone numbers only (e.g., 012-3456789)
              </p>
            </div>

            <div className="pt-4 border-t-2 border-gray-200">
              <h3 className="text-lg font-black theme-text-primary mb-4">
                Change Password (Optional)
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold theme-text-secondary mb-2">
                    <Lock className="w-4 h-4 inline mr-2" />
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full p-4 pr-12 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold theme-text-secondary mb-2">
                    <Lock className="w-4 h-4 inline mr-2" />
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full p-4 pr-12 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold theme-text-secondary">
                          Password Strength:
                        </span>
                        <span className="text-xs font-bold theme-text-primary">
                          {getPasswordStrengthText(newPassword)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${getPasswordStrengthColor(newPassword)}`}
                          style={{
                            width: `${([
                              newPassword.length >= 8,
                              /[A-Z]/.test(newPassword),
                              /[a-z]/.test(newPassword),
                              /[0-9]/.test(newPassword),
                              /[^A-Za-z0-9]/.test(newPassword),
                            ].filter(Boolean).length / 5) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <ul className="mt-2 space-y-1 text-xs">
                    <li className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-green-600' : 'theme-text-secondary'}`}>
                      <Check className="w-3 h-3" />
                      At least 8 characters
                    </li>
                    <li className={`flex items-center gap-2 ${/[A-Z]/.test(newPassword) ? 'text-green-600' : 'theme-text-secondary'}`}>
                      <Check className="w-3 h-3" />
                      One uppercase letter
                    </li>
                    <li className={`flex items-center gap-2 ${/[a-z]/.test(newPassword) ? 'text-green-600' : 'theme-text-secondary'}`}>
                      <Check className="w-3 h-3" />
                      One lowercase letter
                    </li>
                    <li className={`flex items-center gap-2 ${/[0-9]/.test(newPassword) ? 'text-green-600' : 'theme-text-secondary'}`}>
                      <Check className="w-3 h-3" />
                      One number
                    </li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-bold theme-text-secondary mb-2">
                    <Lock className="w-4 h-4 inline mr-2" />
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full p-4 pr-12 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Passwords do not match
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 font-bold">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600 font-bold">Profile updated successfully!</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-black text-lg shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-black text-lg shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
