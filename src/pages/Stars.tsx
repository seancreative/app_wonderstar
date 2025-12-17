import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStars } from '../hooks/useStars';
import { useStamps } from '../hooks/useStamps';
import { useMasterBalances } from '../hooks/useMasterBalances';
import { useVouchers } from '../hooks/useVouchers';
import { useAuth } from '../contexts/AuthContext';
import { Star, Gift, Trophy, Sparkles, CheckCircle, Award, Info, X, Wallet, TrendingUp, Crown, PartyPopper, Plus, ShoppingCart, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/Layout/PageHeader';
import VoucherCard from '../components/VoucherCard';
import RedeemVoucherCodeModal from '../components/RedeemVoucherCodeModal';
import TierBenefitsModal from '../components/TierBenefitsModal';
import ConfirmationModal from '../components/ConfirmationModal';
import LoadingScreen from '../components/LoadingScreen';
import type { Voucher, Reward } from '../types/database';
import { formatCurrency } from '../utils/currencyFormatter';

const Stars: React.FC = () => {
  const navigate = useNavigate();
  const { currentTier, nextTier, spendStars, loading: starsLoading } = useStars();
  const { user } = useAuth();
  const { balances, loading: balancesLoading } = useMasterBalances({
    userId: user?.id || null
  });

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(true);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [voucherTab, setVoucherTab] = useState<'available' | 'used' | 'expired'>('available');
  const { availableVouchers, usedVouchers, expiredVouchers, redeemCode } = useVouchers(user?.id);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
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

  const overviewRef = useRef<HTMLDivElement>(null);
  const starsStampsRef = useRef<HTMLDivElement>(null);
  const vouchersRef = useRef<HTMLDivElement>(null);
  const rewardsRef = useRef<HTMLDivElement>(null);
  const tierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadVouchers();
    loadRewards();
  }, []);

  const loadVouchers = async () => {
    try {
      const { data } = await supabase
        .from('vouchers')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })
        .limit(4);

      setVouchers(data || []);
    } catch (error) {
      console.error('Error loading vouchers:', error);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const loadRewards = async () => {
    setLoadingRewards(true);
    try {
      const { data } = await supabase
        .from('rewards')
        .select('*')
        .eq('is_active', true)
        .order('base_cost_stars', { ascending: true });
      setRewards(data || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoadingRewards(false);
    }
  };

  const calculateTierCost = (baseCost: number) => {
    if (!currentTier || currentTier.redemption_discount_pct === 0) return baseCost;
    return Math.floor(baseCost * (1 - currentTier.redemption_discount_pct / 100));
  };

  const handleRedeemRewardClick = (reward: Reward) => {
    if (!user) return;

    const cost = calculateTierCost(reward.base_cost_stars);

    if ((balances?.starsBalance || 0) < cost) {
      setErrorModal({ isOpen: true, message: "You don't have enough stars for this reward!" });
      return;
    }

    setConfirmModal({ isOpen: true, reward, cost });
  };

  const handleRedeemReward = async () => {
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

      setConfirmModal({ isOpen: false });
      setSuccessModal({ isOpen: true, qrCode });
      await loadRewards();
    } catch (error) {
      console.error('Error redeeming reward:', error);
      setErrorModal({ isOpen: true, message: 'Failed to redeem reward. Please try again.' });
    }
  };

  const scrollToSection = (section: string, ref: React.RefObject<HTMLDivElement>) => {
    setActiveSection(section);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };


  const handleUseVoucher = async (voucherCode: string) => {
    if (user) {
      try {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            selected_voucher_code: voucherCode,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
      } catch (error) {
        console.error('Error saving voucher preference:', error);
      }
    }
    navigate('/shop');
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
  };

  const getProgressPercentage = () => {
    if (!currentTier || !nextTier) return 100;
    const current = user?.lifetime_topups || 0;
    const range = nextTier.threshold - currentTier.threshold;
    const progress = current - currentTier.threshold;
    return Math.min((progress / range) * 100, 100);
  };

  const getAmountToNextTier = () => {
    if (!nextTier) return 0;
    const current = user?.lifetime_topups || 0;
    return Math.max(nextTier.threshold - current, 0);
  };

  const InfoTooltip = ({ id, content }: { id: string; content: string }) => (
    <div className="relative inline-block">
      <button
        onClick={() => setShowTooltip(showTooltip === id ? null : id)}
        className="p-1 hover:bg-white/20 rounded-full transition-colors"
      >
        <Info className="w-4 h-4 text-white/70" />
      </button>
      {showTooltip === id && (
        <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-white rounded-2xl shadow-2xl z-50 animate-scale-in">
          <button
            onClick={() => setShowTooltip(null)}
            className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-3 h-3 text-gray-600" />
          </button>
          <p className="text-xs text-gray-700 font-medium pr-6">{content}</p>
        </div>
      )}
    </div>
  );

  const navItems = [
    { id: 'wallet', label: 'W Balance', icon: Wallet, ref: starsStampsRef },
    { id: 'tier', label: 'Tier', icon: Trophy, ref: tierRef },
    { id: 'stars', label: 'Stars', icon: Star, ref: overviewRef },
    { id: 'vouchers', label: 'Vouchers', icon: Award, ref: vouchersRef },
  ];

  const isLoading = starsLoading || balancesLoading;

  return (
    <div className="min-h-screen pb-28 pt-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
        </div>
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${15 + Math.random() * 10}s`,
              }}
            >
              <Sparkles className="w-4 h-4 text-white/20" />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <PageHeader />

        <div className="max-w-md mx-auto px-6 pt-6 space-y-4">
          {isLoading ? (
            <LoadingScreen variant="content" text="Loading your stars..." />
          ) : (
            <>
          <div className="text-center space-y-2 animate-slide-up">
            <div className="flex items-center justify-center gap-2">
              <Crown className="w-10 h-10 text-yellow-300 animate-bounce-soft" />
              <h1 className="text-4xl font-black text-white drop-shadow-lg">Rewards Hub</h1>
              <Crown className="w-10 h-10 text-yellow-300 animate-bounce-soft" />
            </div>
            <p className="text-purple-100 font-medium">Your exclusive rewards universe!</p>
          </div>

          <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-2 shadow-2xl">
            <div className="grid grid-cols-4 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id, item.ref)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                    activeSection === item.id
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-glow scale-105'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={starsStampsRef} className="space-y-4">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-5 rounded-3xl shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-white" />
                  <h3 className="text-lg font-black text-white">W Balance</h3>
                </div>
                <InfoTooltip
                  id="wallet"
                  content="Your W Balance can be used to pay for tickets, workshops, and shop purchases!"
                />
              </div>

              <div className="backdrop-blur-xl bg-white/20 border border-white/30 p-5 rounded-2xl space-y-4">
                <div className="text-center">
                  <p className="text-xs text-purple-100 font-semibold mb-1">Total Balance</p>
                  <p className="text-5xl font-black text-white mb-2">RM {(balances?.wBalance || 0).toFixed(2)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('/wallet')}
                    className="py-3 bg-gradient-to-r from-green-400 to-green-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-5 h-5" />
                    Top Up Now
                  </button>
                  <button
                    onClick={() => navigate('/shop')}
                    className="py-3 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Shop Now
                  </button>
                </div>

      
              </div>
            </div>

          </div>
 
          <button
            ref={tierRef}
            onClick={() => setShowTierModal(true)}
            className="backdrop-blur-xl bg-white/10 border border-white/20 p-5 rounded-3xl shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer w-full"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-white" />
                <h3 className="text-lg font-black text-white">{currentTier?.name} Tier</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-white/20 rounded-full">
                  <p className="text-xs font-bold text-white">View Benefits</p>
                </div>
                <Info className="w-5 h-5 text-white/70" />
              </div>
            </div>
{nextTier && getAmountToNextTier() > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-100 font-semibold">To {nextTier.name}</span>
                  <span className="font-bold text-white">
                    RM{getAmountToNextTier().toFixed(0)} more needed
                  </span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500 animate-pulse-gentle"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
              </div>
            )}
          </button>
  
          <div ref={overviewRef} className="grid grid-cols-2 gap-3">
            {/* Your Stars */}
            <div className="backdrop-blur-xl bg-black/40 border border-white/20 p-4 rounded-3xl shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-glow flex-shrink-0">
                  <Star className="w-6 h-6 text-white" fill="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-purple-100 font-semibold">Your Stars</p>
                  <p className="text-2xl font-black text-white">{(balances?.starsBalance || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-[10px] font-bold text-center mb-2">
                {currentTier?.earn_multiplier}x Earn Rate
              </div>
              <button
                onClick={() => scrollToSection('rewards', rewardsRef)}
                className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Gift className="w-4 h-4" />
                <span>Redeem</span>
              </button>
            </div>

            {/* Your Bonus */}
            <div className="backdrop-blur-xl bg-black/40 border border-white/20 p-4 rounded-3xl shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-glow flex-shrink-0">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-purple-100 font-semibold">Your Bonus</p>
                  <p className="text-2xl font-black text-white truncate">{formatCurrency(balances?.bonusBalance || 0)}</p>
                </div>
              </div>
              <div className="px-2 py-1 bg-gradient-to-r from-orange-400 to-amber-500 text-white rounded-full text-[10px] font-bold text-center mb-2">
                Extra Savings
              </div>
              <button
                onClick={() => navigate('/shop')}
                className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Use Now</span>
              </button>
            </div>
          </div>
       <button
                  onClick={() => navigate('/share-gacha')}
                  className="w-full py-3 bg-gradient-to-r from-cyan-400 to-cyan-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 animate-bounce-gentle"
                >
                  <Share2 className="w-5 h-5" />
                  Share & Win Gacha!
                </button>
          <div ref={vouchersRef} data-section="vouchers">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-6 rounded-3xl shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-6 h-6 text-white" />
                  <h3 className="text-xl font-black text-white">My Vouchers</h3>
                </div>
                <button
                  onClick={() => setShowRedeemModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-green-400 to-green-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Redeem Code
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                {['available', 'used', 'expired'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setVoucherTab(tab as any)}
                    className={`px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                      voucherTab === tab
                        ? 'bg-white text-purple-600 shadow-lg'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === 'available' && ` (${availableVouchers.length})`}
                    {tab === 'used' && ` (${usedVouchers.length})`}
                    {tab === 'expired' && ` (${expiredVouchers.length})`}
                  </button>
                ))}
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}>
                {voucherTab === 'available' && (
                  <>
                    {availableVouchers.length === 0 ? (
                      <div className="text-center py-8">
                        <Award className="w-16 h-16 text-white/30 mx-auto mb-4" />
                        <p className="text-white/70 font-medium mb-2">No vouchers available</p>
                        <p className="text-white/50 text-sm">Redeem a code or earn vouchers to get started!</p>
                      </div>
                    ) : (
                      availableVouchers.map((userVoucher) => (
                        <VoucherCard
                          key={userVoucher.id}
                          userVoucher={userVoucher}
                          onClick={() => handleUseVoucher(userVoucher.voucher?.code || '')}
                        />
                      ))
                    )}
                  </>
                )}

                {voucherTab === 'used' && (
                  <>
                    {usedVouchers.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle className="w-16 h-16 text-white/30 mx-auto mb-4" />
                        <p className="text-white/70 font-medium mb-2">No used vouchers</p>
                        <p className="text-white/50 text-sm">Your used vouchers will appear here</p>
                      </div>
                    ) : (
                      usedVouchers.map((userVoucher) => (
                        <VoucherCard
                          key={userVoucher.id}
                          userVoucher={userVoucher}
                        />
                      ))
                    )}
                  </>
                )}

                {voucherTab === 'expired' && (
                  <>
                    {expiredVouchers.length === 0 ? (
                      <div className="text-center py-8">
                        <X className="w-16 h-16 text-white/30 mx-auto mb-4" />
                        <p className="text-white/70 font-medium mb-2">No expired vouchers</p>
                        <p className="text-white/50 text-sm">Your expired vouchers will appear here</p>
                      </div>
                    ) : (
                      expiredVouchers.map((userVoucher) => (
                        <VoucherCard
                          key={userVoucher.id}
                          userVoucher={userVoucher}
                        />
                      ))
                    )}
                  </>
                )}
              </div>

              <div className="pt-3 border-t border-white/20">
                <p className="text-xs text-white/70 font-medium text-center">
                  Earn vouchers through top-ups, check-ins, and special promotions!
                </p>
              </div>
            </div>
          </div>


          <div ref={rewardsRef} data-section="rewards">
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-6 rounded-3xl shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-6 h-6 text-white" />
                  <h3 className="text-xl font-black text-white">Rewards Store</h3>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl shadow-lg">
                  <Star className="w-5 h-5 text-white" fill="white" />
                  <span className="font-black text-white">{(balances?.starsBalance || 0).toLocaleString()}</span>
                </div>
              </div>

              {loadingRewards ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto"></div>
                  <p className="text-white/70 font-medium mt-4">Loading rewards...</p>
                </div>
              ) : rewards.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="w-16 h-16 text-white/30 mx-auto mb-4" />
                  <p className="text-white/70 font-medium mb-2">No rewards available</p>
                  <p className="text-white/50 text-sm">Check back soon for amazing rewards!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {rewards.map((reward) => {
                    const baseCost = reward.base_cost_stars;
                    const tierCost = calculateTierCost(baseCost);
                    const discount = baseCost - tierCost;
                    const canAfford = (balances?.starsBalance || 0) >= tierCost;

                    return (
                      <div
                        key={reward.id}
                        className={`backdrop-blur-xl bg-white/10 border border-white/20 p-4 rounded-3xl space-y-3 transition-all ${
                          canAfford ? 'animate-pulse-gentle hover:scale-105 hover:shadow-glow' : 'opacity-60'
                        }`}
                      >
                        <div className="aspect-square bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-2xl flex items-center justify-center overflow-hidden relative">
                          {reward.image_url ? (
                            <img src={reward.image_url} alt={reward.name} className="w-full h-full object-cover" />
                          ) : (
                            <Gift className="w-12 h-12 text-white" />
                          )}
                          {canAfford && (
                            <div className="absolute top-2 right-2">
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-bounce-soft">
                                <CheckCircle className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-white text-sm leading-tight">
                            {reward.name}
                          </h3>
                          {reward.description && (
                            <p className="text-xs text-purple-100 mt-1 line-clamp-2">
                              {reward.description}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              {discount > 0 && (
                                <p className="text-xs text-white/50 line-through">
                                  {baseCost} stars
                                </p>
                              )}
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-300" fill="currentColor" />
                                <span className="font-black text-white">{tierCost}</span>
                              </div>
                            </div>
                            {discount > 0 && (
                              <span className="text-xs font-bold text-green-300 px-2 py-1 bg-green-500/20 rounded-full border border-green-300/30">
                                Save {discount}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleRedeemRewardClick(reward)}
                            disabled={!canAfford}
                            className={`w-full py-2 rounded-xl font-bold text-sm transition-all ${
                              canAfford
                                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white hover:scale-105 shadow-lg'
                                : 'bg-white/10 text-white/50 cursor-not-allowed'
                            }`}
                          >
                            {canAfford ? (
                              <span className="flex items-center justify-center gap-1">
                                <ShoppingCart className="w-4 h-4" />
                                Redeem Now
                              </span>
                            ) : (
                              <span className="text-xs">Need {tierCost - (balances?.starsBalance || 0)} more</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-white/20">
                <p className="text-xs text-white/70 font-medium text-center">
                  Earn stars with every purchase and redeem them for exclusive rewards!
                </p>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      <RedeemVoucherCodeModal
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        onRedeem={redeemCode}
      />

      <TierBenefitsModal
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={handleRedeemReward}
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

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default Stars;
