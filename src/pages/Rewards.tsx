import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useStars } from '../hooks/useStars';
import { ArrowLeft, Star, Gift } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import ConfirmationModal from '../components/ConfirmationModal';
import type { Reward } from '../types/database';

const Rewards: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { starsBalance, spendStars, currentTier } = useStars();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    reward?: Reward;
    cost?: number;
  }>({ isOpen: false });
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    qrCode?: string;
  }>({ isOpen: false });
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    message?: string;
  }>({ isOpen: false });

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'entry', label: 'Entry' },
    { id: 'toys', label: 'Toys' },
    { id: 'merch', label: 'Merch' },
    { id: 'vip', label: 'VIP' },
  ];

  useEffect(() => {
    loadRewards();
  }, [selectedCategory]);

  const loadRewards = async () => {
    setLoading(true);
    try {
      let query = supabase.from('rewards').select('*').eq('is_active', true);

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data } = await query.order('base_cost_stars', { ascending: true });
      setRewards(data || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTierCost = (baseCost: number) => {
    if (!currentTier || currentTier.redemption_discount_pct === 0) return baseCost;
    return Math.floor(baseCost * (1 - currentTier.redemption_discount_pct / 100));
  };

  const handleRedeemClick = (reward: Reward) => {
    if (!user) return;

    const cost = calculateTierCost(reward.base_cost_stars);

    if (starsBalance < cost) {
      setErrorModal({ isOpen: true, message: "You don't have enough stars for this reward!" });
      return;
    }

    setConfirmModal({ isOpen: true, reward, cost });
  };

  const handleRedeem = async () => {
    if (!user || !confirmModal.reward || !confirmModal.cost) return;

    try {
      await spendStars(confirmModal.cost, `Redeemed: ${confirmModal.reward.name}`, { rewardId: confirmModal.reward.id });

      const qrCode = `WS-${Date.now()}-${confirmModal.reward.id.substring(0, 8)}`;

      await supabase.from('redemptions').insert({
        user_id: user.id,
        reward_id: confirmModal.reward.id,
        stars_cost: confirmModal.cost,
        qr_code: qrCode,
      });

      setSuccessModal({ isOpen: true, qrCode });
      await loadRewards();
    } catch (error) {
      console.error('Error redeeming reward:', error);
      setErrorModal({ isOpen: true, message: 'Failed to redeem reward. Please try again.' });
    }
  };

  return (
    <div className="min-h-screen pb-28 pt-20 bg-gradient-to-b from-primary-50 to-white">
      <PageHeader />
      <div className="max-w-md mx-auto px-6 pt-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Rewards Store</h1>
          </div>
          <div className="glass px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg">
            <Star className="w-5 h-5 text-primary-600" fill="currentColor" />
            <span className="font-bold text-gray-900">{starsBalance}</span>
          </div>
        </div>

        <div className="glass p-2 rounded-2xl flex overflow-x-auto gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-6 py-2 rounded-xl font-semibold whitespace-nowrap transition-all ${
                selectedCategory === category.id
                  ? 'bg-white text-primary-600 shadow-lg'
                  : 'text-gray-600'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : rewards.length === 0 ? (
          <div className="glass p-8 rounded-3xl text-center">
            <Gift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No rewards available in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {rewards.map((reward) => {
              const baseCost = reward.base_cost_stars;
              const tierCost = calculateTierCost(baseCost);
              const discount = baseCost - tierCost;
              const canAfford = starsBalance >= tierCost;

              return (
                <div key={reward.id} className="glass p-4 rounded-3xl space-y-3">
                  <div className="aspect-square bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center overflow-hidden">
                    {reward.image_url ? (
                      <img src={reward.image_url} alt={reward.name} className="w-full h-full object-cover" />
                    ) : (
                      <Gift className="w-12 h-12 text-primary-600" />
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">
                      {reward.name}
                    </h3>
                    {reward.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {reward.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        {discount > 0 && (
                          <p className="text-xs text-gray-500 line-through">
                            {baseCost} stars
                          </p>
                        )}
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-primary-600" fill="currentColor" />
                          <span className="font-bold text-gray-900">{tierCost}</span>
                        </div>
                      </div>
                      {discount > 0 && (
                        <span className="text-xs font-semibold text-green-600 px-2 py-1 bg-green-100 rounded-full">
                          Save {discount}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleRedeemClick(reward)}
                      disabled={!canAfford}
                      className={`w-full py-2 rounded-xl font-semibold text-sm transition-transform ${
                        canAfford
                          ? 'gradient-primary text-white hover:scale-105'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? 'Redeem' : 'Not enough stars'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={handleRedeem}
        title="Redeem Reward"
        message={confirmModal.reward ? `Redeem ${confirmModal.reward.name} for ${confirmModal.cost} stars?` : ''}
        confirmText="Redeem"
        cancelText="Cancel"
        type="warning"
      />
      <ConfirmationModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ isOpen: false })}
        onConfirm={() => setSuccessModal({ isOpen: false })}
        title="Success!"
        message={`Your QR code: ${successModal.qrCode}\n\nShow this at the counter to claim your reward.`}
        confirmText="Got it"
        cancelText="Close"
        type="success"
      />
      <ConfirmationModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false })}
        onConfirm={() => setErrorModal({ isOpen: false })}
        title="Oops!"
        message={errorModal.message || 'An error occurred'}
        confirmText="OK"
        cancelText="Close"
        type="danger"
      />
    </div>
  );
};

export default Rewards;
