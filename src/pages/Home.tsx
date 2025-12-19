import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMasterBalances } from '../hooks/useMasterBalances';
import { useStars } from '../hooks/useStars';
import {
  Wallet, Star, Gift,
  Sparkles, Zap, Plus, ShoppingBag, QrCode, Users, Ticket, ChevronRight, Tag, Trophy, Info, Share2
} from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import RedeemVoucherCodeModal from '../components/RedeemVoucherCodeModal';
import TierBenefitsModal from '../components/TierBenefitsModal';
import LoadingScreen from '../components/LoadingScreen';
import { useVouchers } from '../hooks/useVouchers';
import { supabase } from '../lib/supabase';
import WorkshopSlider from '../components/WorkshopSlider';
import { formatCurrency } from '../utils/currencyFormatter';

interface PromoBanner {
  id: string;
  image_url: string;
  title: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { balances, loading: balancesLoading } = useMasterBalances({
    userId: user?.id || null,
    userEmail: user?.email || null
  });



  const { currentTier, lifetimeTopups } = useStars();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showTierBenefitsModal, setShowTierBenefitsModal] = useState(false);
  const { redeemCode } = useVouchers(user?.id);
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleViewVouchers = () => {
    navigate('/stars');
    setTimeout(() => {
      const vouchersSection = document.querySelector('[data-section="vouchers"]');
      if (vouchersSection) {
        vouchersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleRedeemVoucher = () => {
    navigate('/stars');
    setTimeout(() => {
      const vouchersSection = document.querySelector('[data-section="vouchers"]');
      if (vouchersSection) {
        vouchersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleViewRewards = () => {
    navigate('/stars');
    setTimeout(() => {
      const rewardsSection = document.querySelector('[data-section="rewards"]');
      if (rewardsSection) {
        rewardsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleUseVoucher = () => {
    setShowVoucherModal(true);
  };

  const handleViewTickets = () => {
    navigate('/myqr');
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('promo_banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error loading banners:', error);
    }
  };

  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (Math.abs(distance) < minSwipeDistance) return;

    if (distance > 0) {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    } else {
      setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  const isLoading = balancesLoading;

  return (
    <div className="min-h-screen pb-28 pt-20">
      <PageHeader />
      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {isLoading ? (
          <LoadingScreen variant="content" text="Loading your dashboard..." />
        ) : (
          <>

            <div
              className="relative w-full aspect-square overflow-hidden rounded-2xl shadow-xl animate-slide-up"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {banners.map((banner, index) => (
                <div
                  key={banner.id}
                  className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide
                    ? 'opacity-100 translate-x-0'
                    : index < currentSlide
                      ? 'opacity-0 -translate-x-full'
                      : 'opacity-0 translate-x-full'
                    }`}
                >
                  <div className="relative w-full h-full">
                    {banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-400 via-orange-500 to-red-500"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Main Balance Cards - Horizontal Layout */}
            <div className="space-y-3 animate-pop-in">
              {/* W Balance Card */}
              <div className="relative glass p-4 rounded-2xl shadow-lg overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10"></div>
                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                      <Wallet className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wide">W Balance</p>
                      <p className="text-3xl font-black text-transparent bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text">
                        RM{(balances?.wBalance || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/wallet')}
                    className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform shadow-md whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Top Up</span>
                  </button>
                </div>
              </div>

              {/* Bonus and Stars - Side by Side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Bonus Balance */}
                <div className="relative glass p-4 rounded-2xl shadow-lg overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-yellow-500/10"></div>
                  <div className="relative space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wide">Bonus</p>
                        <p className="text-xl font-black text-transparent bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text truncate">
                          {formatCurrency(balances?.bonusBalance || 0)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/shop')}
                      className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-transform shadow-md"
                    >
                      Use in Shop
                    </button>
                  </div>
                </div>

                {/* Stars Balance */}
                <div className="relative glass p-4 rounded-2xl shadow-lg overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-primary-600/10 to-pink-600/10"></div>
                  <div className="relative space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg">
                        <Star className="w-5 h-5 text-white" fill="white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wide">Stars</p>
                        <p className="text-xl font-black text-transparent bg-gradient-to-r from-primary-600 to-pink-600 bg-clip-text truncate">
                          {(balances?.starsBalance || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/rewards')}
                      className="w-full py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-transform shadow-md"
                    >
                      Redeem
                    </button>
                  </div>
                </div>
              </div>

              {/* Top up bonus banner */}
              <div className="relative overflow-hidden rounded-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 via-yellow-400/30 to-amber-400/20 animate-pulse-slow"></div>
                <div className="relative flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/50 shadow-sm">
                  <Zap className="w-4 h-4 text-amber-600 animate-bounce-gentle" />
                  <span className="text-xs font-bold text-amber-700">
                    Top up now & Get Bonus Balance!
                  </span>
                  <Sparkles className="w-4 h-4 text-amber-500 animate-twinkle" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 animate-slide-up">
              <button
                onClick={() => navigate('/shop')}
                className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <div className="p-2 bg-white/20 rounded-xl">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold text-white text-center leading-tight">Tickets & F&B</span>
                <ChevronRight className="w-4 h-4 text-white/80" />
              </button>

              <button
                onClick={() => navigate('/myqr')}
                className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <div className="p-2 bg-white/20 rounded-xl">
                  <QrCode className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold text-white text-center leading-tight">View MyQR</span>
                <ChevronRight className="w-4 h-4 text-white/80" />
              </button>

              <button
                onClick={() => navigate('/profile')}
                className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <div className="p-2 bg-white/20 rounded-xl">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold text-white text-center leading-tight">Register My Kids</span>
                <ChevronRight className="w-4 h-4 text-white/80" />
              </button>

              <button
                onClick={() => navigate('/share-gacha')}
                className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all animate-bounce-gentle"
              >
                <div className="p-2 bg-white/20 rounded-xl">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold text-white text-center leading-tight">Share & Win</span>
                <ChevronRight className="w-4 h-4 text-white/80" />
              </button>
            </div>

            <WorkshopSlider />

            <div className="relative glass p-5 rounded-2xl shadow-lg animate-slide-up overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-purple-600/10 to-pink-500/10"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setShowTierBenefitsModal(true)}
                    className="flex items-center gap-2 group"
                  >
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg group-hover:shadow-xl transition-all">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-black text-gray-900 group-hover:text-purple-600 transition-colors">{currentTier?.name || 'Bronze'} Tier</h2>
                  </button>
                  <button
                    onClick={() => setShowTierBenefitsModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full text-xs font-bold transition-all"
                  >
                    View Benefits
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 font-bold">To {currentTier?.next_tier_name || 'Silver'}</span>
                    <span className="text-purple-600 font-black">
                      {currentTier?.amount_to_next_tier === 0
                        ? 'Max Tier!'
                        : (lifetimeTopups === 0)
                          ? 'Unlock Better Rewards!'
                          : `RM${(currentTier?.amount_to_next_tier || 0).toFixed(2)} more needed`
                      }
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 rounded-full transition-all duration-500"
                      style={{ width: `${currentTier?.progress_to_next || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="glass p-5 rounded-2xl shadow-lg animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-lg">
                  <Ticket className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-black text-gray-900">My Rewards</h2>
                <Sparkles className="w-4 h-4 text-pink-500 animate-pulse" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRedeemVoucher}
                  className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-pink-50 to-pink-100 hover:from-pink-100 hover:to-pink-200 rounded-xl border-2 border-pink-200 hover:border-pink-300 transition-all shadow-md hover:shadow-lg hover:scale-105"
                >
                  <div className="p-2 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-md">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-900 text-center">Redeem Voucher</span>
                </button>

                <button
                  onClick={handleUseVoucher}
                  className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 rounded-xl border-2 border-amber-200 hover:border-amber-300 transition-all shadow-md hover:shadow-lg hover:scale-105"
                >
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-md">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-900 text-center">Use Voucher</span>
                </button>

                <button
                  onClick={handleViewRewards}
                  className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl border-2 border-purple-200 hover:border-purple-300 transition-all shadow-md hover:shadow-lg hover:scale-105"
                >
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md">
                    <Star className="w-5 h-5 text-white" fill="white" />
                  </div>
                  <span className="text-xs font-bold text-gray-900 text-center">View Rewards</span>
                </button>

                <button
                  onClick={handleViewTickets}
                  className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl border-2 border-blue-200 hover:border-blue-300 transition-all shadow-md hover:shadow-lg hover:scale-105"
                >
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                    <Ticket className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-900 text-center">View Tickets</span>
                </button>
              </div>
            </div>
            <button
              onClick={() => navigate('/egg-gacha')}
              className="w-full relative group overflow-hidden rounded-lg p-0 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] transition-all active:shadow-none active:translate-x-[8px] active:translate-y-[8px]"
              style={{ imageRendering: 'pixelated' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 via-orange-400 to-pink-500 animate-pulse"></div>

              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
                backgroundSize: '4px 4px'
              }}></div>

              <div className="relative flex items-center justify-between p-5 gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <div className="w-24 h-24 bg-black rounded-lg p-1 transform group-hover:scale-110 transition-transform">
                      <div className="w-full h-full bg-white rounded-md flex items-center justify-center p-2">
                        <img
                          src="/wondergacha-s.gif"
                          alt="Gacha Machine"
                          className="w-full h-full object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                    </div>
                    <div className="absolute -top-2 -left-2 w-4 h-4 bg-yellow-400 border-2 border-black rotate-45"></div>
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-pink-400 border-2 border-black rotate-45"></div>
                    <div className="absolute -top-1 -right-1 flex gap-1">
                      <div className="w-3 h-3 bg-yellow-400 border-2 border-black animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-3 h-3 bg-yellow-400 border-2 border-black animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-3 h-3 bg-yellow-400 border-2 border-black animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-xl font-black text-black mb-1 drop-shadow-[2px_2px_0px_rgba(255,255,255,0.8)] tracking-tight leading-tight" style={{
                      color: '#FFFF00',
                      letterSpacing: '0.05rem',
                      textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
                      fontFamily: "'Press Start 2P', 'Courier New', monospace", textTransform: 'uppercase'
                    }}>
                      WONDERPARK GACHA & SURE WIN!
                    </h3>
                    <p className="text-xs font-bold text-black/80 tracking-wide uppercase">
                      ▶ FIRST TIME FREE PLAY! 50 STARS EACH! ◀
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 bg-black rounded flex items-center justify-center border-2 border-white shadow-inner group-hover:animate-pulse">
                    <ChevronRight className="w-5 h-5 text-yellow-400" strokeWidth={4} />
                  </div>
                  <span className="text-[8px] font-black text-black uppercase tracking-wider">Play!</span>
                </div>
              </div>

              <div className="absolute inset-0 pointer-events-none opacity-10" style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)'
              }}></div>
            </button>

            <button
              onClick={() => navigate('/share-gacha')}
              className="w-full mt-4 py-4 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #00FFFF 0%, #00CED1 100%)',
                border: '4px solid #000',
                boxShadow: '4px 4px 0 #000',
                animation: 'bounce 2s infinite',
                cursor: 'pointer'
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <Share2 className="w-5 h-5" style={{ color: '#000' }} />
                <span
                  style={{
                    fontFamily: "'Press Start 2P', 'Courier New', monospace",
                    fontSize: '0.7rem',
                    color: '#000',
                    textShadow: '1px 1px 0 #FFF',
                    textTransform: 'uppercase'
                  }}
                >
                  SHARE & FREE SPIN!
                </span>
                <span style={{ fontSize: '1.2rem' }}>🎁</span>
              </div>
            </button>
          </>
        )}
      </div>

      <RedeemVoucherCodeModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        onRedeem={redeemCode}
      />

      <TierBenefitsModal
        isOpen={showTierBenefitsModal}
        onClose={() => setShowTierBenefitsModal(false)}
      />
    </div>
  );
};

export default Home;
