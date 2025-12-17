import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import CMSLayout from '../../components/cms/CMSLayout';
import { Award, Gift, Star, TrendingUp, Users, Package, Plus, Edit2, Trash2, Check, X, AlertCircle, Image } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ImageUploadWithCrop from '../../components/cms/ImageUploadWithCrop';
import { formatDateTimeCMS } from '../../utils/dateFormatter';

interface RewardsStats {
  totalStarsDistributed: number;
  activeRewards: number;
  totalRedemptions: number;
  pendingRedemptions: number;
}

interface Reward {
  id: string;
  display_id?: string;
  name: string;
  description: string;
  category: 'entry' | 'toys' | 'merch' | 'vip';
  base_cost_stars: number;
  stock?: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

const CMSRewards: React.FC = () => {
  const navigate = useNavigate();
  const { admin, loading: adminLoading } = useAdminAuth();
  const { staff, loading: staffLoading } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RewardsStats>({
    totalStarsDistributed: 0,
    activeRewards: 0,
    totalRedemptions: 0,
    pendingRedemptions: 0
  });
  const [recentRedemptions, setRecentRedemptions] = useState<any[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'entry' as 'entry' | 'toys' | 'merch' | 'vip',
    base_cost_stars: '',
    stock: '999',
    image_url: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const authLoading = adminLoading || staffLoading;
  const currentUser = admin || staff;
  const isStaff = !admin && !!staff;

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate('/cms/login');
      return;
    }

    // Check staff permissions
    if (isStaff && staff?.role === 'manager') {
      const permissions = (staff as any).assigned_permissions || {};
      if (!permissions.rewards) {
        navigate('/cms/unauthorized');
        return;
      }
    }

    if (currentUser) {
      loadRewardsData();
    }
  }, [admin, staff, authLoading, navigate]);

  const loadRewardsData = async () => {
    try {
      const [starsResult, redemptionsResult, rewardsResult] = await Promise.all([
        supabase
          .from('stars_transactions')
          .select('amount')
          .eq('transaction_type', 'earn'),
        supabase
          .from('redemptions')
          .select('*, users!redemptions_user_id_fkey(name, email), rewards(name, base_cost_stars)')
          .order('redeemed_at', { ascending: false })
          .limit(20),
        supabase
          .from('rewards')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      const stars = starsResult.data || [];
      const redemptions = redemptionsResult.data || [];
      const rewardsData = rewardsResult.data || [];

      const totalStarsDistributed = stars.reduce((sum, s) => sum + s.amount, 0);
      const pendingRedemptions = redemptions.filter(r => !r.used_at).length;

      setStats({
        totalStarsDistributed,
        activeRewards: rewardsData.filter(r => r.is_active).length,
        totalRedemptions: redemptions.length,
        pendingRedemptions
      });

      setRecentRedemptions(redemptions);
      setRewards(rewardsData);
    } catch (error) {
      console.error('Error loading rewards data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReward = () => {
    setFormData({ name: '', description: '', category: 'entry', base_cost_stars: '', stock: '999', image_url: '' });
    setEditingReward(null);
    setShowAddModal(true);
    setError('');
    setSuccess('');
  };

  const handleEditReward = (reward: Reward) => {
    setFormData({
      name: reward.name,
      description: reward.description,
      category: reward.category,
      base_cost_stars: reward.base_cost_stars.toString(),
      stock: (reward.stock || 999).toString(),
      image_url: reward.image_url || ''
    });
    setEditingReward(reward);
    setShowAddModal(true);
    setError('');
    setSuccess('');
  };

  const handleSaveReward = async () => {
    try {
      setError('');
      setSuccess('');

      if (!formData.name || !formData.description || !formData.base_cost_stars || !formData.category) {
        setError('Please fill in all fields');
        return;
      }

      const rewardData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        base_cost_stars: parseInt(formData.base_cost_stars),
        stock: parseInt(formData.stock || '999'),
        image_url: formData.image_url || null,
        is_active: true
      };

      if (editingReward) {
        const { error } = await supabase
          .from('rewards')
          .update(rewardData)
          .eq('id', editingReward.id);

        if (error) throw error;
        setSuccess('Reward updated successfully!');
      } else {
        const { error } = await supabase
          .from('rewards')
          .insert([rewardData]);

        if (error) throw error;
        setSuccess('Reward created successfully!');
      }

      setShowAddModal(false);
      loadRewardsData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to save reward');
    }
  };

  const handleDeleteReward = async (rewardId: string) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;

    try {
      const { error } = await supabase
        .from('rewards')
        .delete()
        .eq('id', rewardId);

      if (error) throw error;

      setSuccess('Reward deleted successfully!');
      loadRewardsData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to delete reward');
    }
  };

  const handleToggleStatus = async (reward: Reward) => {
    try {
      const { error } = await supabase
        .from('rewards')
        .update({ is_active: !reward.is_active })
        .eq('id', reward.id);

      if (error) throw error;

      loadRewardsData();
    } catch (error: any) {
      setError(error.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <CMSLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </CMSLayout>
    );
  }

  return (
    <CMSLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Rewards Management</h1>
            <p className="text-gray-600 font-medium">Manage customer rewards, stars, and redemptions</p>
          </div>
          <button
            onClick={handleAddReward}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Add Reward
          </button>
        </div>

        {success && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 font-semibold">{success}</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800 font-semibold">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl border-2 border-yellow-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-sm font-bold text-yellow-700 mb-1">Stars Distributed</p>
            <p className="text-3xl font-black text-yellow-900">{stats.totalStarsDistributed.toLocaleString()}</p>
            <p className="text-xs text-yellow-700 mt-2">Total earned by users</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Award className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-blue-700 mb-1">Active Rewards</p>
            <p className="text-3xl font-black text-blue-900">{stats.activeRewards}</p>
            <p className="text-xs text-blue-700 mt-2">Available for redemption</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Gift className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-green-700 mb-1">Total Redemptions</p>
            <p className="text-3xl font-black text-green-900">{stats.totalRedemptions}</p>
            <p className="text-xs text-green-700 mt-2">All time</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border-2 border-orange-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-orange-700 mb-1">Pending</p>
            <p className="text-3xl font-black text-orange-900">{stats.pendingRedemptions}</p>
            <p className="text-xs text-orange-700 mt-2">Awaiting fulfillment</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-black text-gray-900">Rewards List</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Reward ID</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Name</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Category</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Stars Required</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Stock</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Status</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rewards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No rewards yet</p>
                      <p className="text-sm text-gray-500 mt-1">Click "Add Reward" to create a new reward</p>
                    </td>
                  </tr>
                ) : (
                  rewards.map((reward) => (
                    <tr key={reward.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-mono font-bold text-gray-900">{reward.display_id || 'Pending'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {reward.image_url ? (
                            <img src={reward.image_url} alt={reward.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Image className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <p className="font-bold text-gray-900">{reward.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 capitalize">
                          {reward.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-600" fill="currentColor" />
                          <span className="font-bold text-gray-900">{reward.base_cost_stars}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">{reward.stock || 999}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          reward.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {reward.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(reward)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              reward.is_active
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                          >
                            {reward.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleEditReward(reward)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteReward(reward.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-black text-gray-900">Recent Redemptions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">User</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Reward</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Stars Cost</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">QR Code</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRedemptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No redemptions yet</p>
                    </td>
                  </tr>
                ) : (
                  recentRedemptions.map((redemption: any) => (
                    <tr key={redemption.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {formatDateTimeCMS(redemption.redeemed_at)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {redemption.users?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {redemption.rewards?.name || 'Unknown Reward'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-600" fill="currentColor" />
                          <span className="font-bold text-gray-900">{redemption.stars_cost}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">
                        {redemption.qr_code || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          redemption.used_at ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {redemption.used_at ? 'Used' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Reward Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
              <h2 className="text-2xl font-black text-gray-900 mb-6">
                {editingReward ? 'Edit Reward' : 'Add New Reward'}
              </h2>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl mb-4">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800 font-semibold">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Reward Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., Free Ice Cream Cone"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                    rows={3}
                    placeholder="Describe what customers get with this reward..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as 'entry' | 'toys' | 'merch' | 'vip' })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                  >
                    <option value="entry">Entry</option>
                    <option value="toys">Toys</option>
                    <option value="merch">Merch</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Stars Required
                    </label>
                    <input
                      type="number"
                      value={formData.base_cost_stars}
                      onChange={(e) => setFormData({ ...formData, base_cost_stars: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                      placeholder="e.g., 100"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Stock
                    </label>
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:border-blue-500 focus:outline-none"
                      placeholder="e.g., 999"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Reward Image
                  </label>
                  <ImageUploadWithCrop
                    onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                    bucket="product-images"
                    folder="rewards"
                    currentImageUrl={formData.image_url}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveReward}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform"
                >
                  {editingReward ? 'Update Reward' : 'Create Reward'}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CMSLayout>
  );
};

export default CMSRewards;
