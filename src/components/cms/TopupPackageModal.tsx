import React, { useState, useEffect } from 'react';
import { X, DollarSign, Star, Gift, TrendingUp } from 'lucide-react';
import type { WalletTopupPackage } from '../../types/database';

interface TopupPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<WalletTopupPackage, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; error?: string }>;
  editPackage?: WalletTopupPackage | null;
}

const TopupPackageModal: React.FC<TopupPackageModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editPackage
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    base_stars: '',
    extra_stars: '',
    bonus_amount: '',
    is_recommended: false,
    is_active: true,
    display_order: ''
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editPackage) {
      setFormData({
        amount: editPackage.amount.toString(),
        base_stars: editPackage.base_stars.toString(),
        extra_stars: editPackage.extra_stars.toString(),
        bonus_amount: editPackage.bonus_amount.toString(),
        is_recommended: editPackage.is_recommended,
        is_active: editPackage.is_active,
        display_order: editPackage.display_order.toString()
      });
    } else {
      setFormData({
        amount: '',
        base_stars: '',
        extra_stars: '0',
        bonus_amount: '0.00',
        is_recommended: false,
        is_active: true,
        display_order: '0'
      });
    }
    setErrors({});
  }, [editPackage, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.base_stars || parseInt(formData.base_stars) < 0) {
      newErrors.base_stars = 'Base stars must be 0 or greater';
    }

    if (!formData.extra_stars || parseInt(formData.extra_stars) < 0) {
      newErrors.extra_stars = 'Extra stars must be 0 or greater';
    }

    if (!formData.bonus_amount || parseFloat(formData.bonus_amount) < 0) {
      newErrors.bonus_amount = 'Bonus amount must be 0 or greater';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    try {
      const packageData = {
        amount: parseFloat(formData.amount),
        base_stars: parseInt(formData.base_stars),
        extra_stars: parseInt(formData.extra_stars),
        bonus_amount: parseFloat(formData.bonus_amount),
        is_recommended: formData.is_recommended,
        is_active: formData.is_active,
        display_order: parseInt(formData.display_order) || 0
      };

      const result = await onSave(packageData);

      if (result.success) {
        onClose();
      } else {
        alert(result.error || 'Failed to save package');
      }
    } catch (err) {
      console.error('Error saving package:', err);
      alert('Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleAmountChange = (value: string) => {
    setFormData(prev => {
      const amount = parseFloat(value) || 0;
      return {
        ...prev,
        amount: value,
        base_stars: Math.floor(amount).toString()
      };
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-black text-gray-900">
            {editPackage ? 'Edit Topup Package' : 'Add New Topup Package'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Topup Amount (RM) *
              </label>
              <input
                type="number"
                step="1"
                value={formData.amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none font-medium ${
                  errors.amount ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="50"
              />
              {errors.amount && (
                <p className="text-red-600 text-xs mt-1 font-medium">{errors.amount}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                <Star className="w-4 h-4 inline mr-1" />
                Base Stars *
              </label>
              <input
                type="number"
                value={formData.base_stars}
                onChange={(e) => setFormData({ ...formData, base_stars: e.target.value })}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none font-medium ${
                  errors.base_stars ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="50"
              />
              {errors.base_stars && (
                <p className="text-red-600 text-xs mt-1 font-medium">{errors.base_stars}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Auto-filled based on amount (1 star per RM)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Extra Stars
              </label>
              <input
                type="number"
                value={formData.extra_stars}
                onChange={(e) => setFormData({ ...formData, extra_stars: e.target.value })}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none font-medium ${
                  errors.extra_stars ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="5"
              />
              {errors.extra_stars && (
                <p className="text-red-600 text-xs mt-1 font-medium">{errors.extra_stars}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Bonus stars on top of base stars</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                <Gift className="w-4 h-4 inline mr-1" />
                Bonus Amount (RM)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.bonus_amount}
                onChange={(e) => setFormData({ ...formData, bonus_amount: e.target.value })}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none font-medium ${
                  errors.bonus_amount ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="5.00"
              />
              {errors.bonus_amount && (
                <p className="text-red-600 text-xs mt-1 font-medium">{errors.bonus_amount}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Cash bonus added to Bonus balance</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={formData.is_recommended}
                onChange={(e) => setFormData({ ...formData, is_recommended: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300"
              />
              <div>
                <p className="font-bold text-gray-900">Recommended Package</p>
                <p className="text-sm text-gray-600">Highlight this package to customers</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300"
              />
              <div>
                <p className="font-bold text-gray-900">Active Package</p>
                <p className="text-sm text-gray-600">Show this package to customers</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : editPackage ? 'Update Package' : 'Create Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TopupPackageModal;
