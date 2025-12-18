import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMasterBalances } from '../hooks/useMasterBalances';
import { useStars } from '../hooks/useStars';
import { useTopupPackages } from '../hooks/useTopupPackages';
import { ArrowLeft, Wallet as WalletIcon, Plus, TrendingUp, Star, Ticket, ThumbsUp, Gift, Info, CheckCircle } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import TierBenefitsModal from '../components/TierBenefitsModal';

const Wallet: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { balances, loading: balancesLoading, refresh } = useMasterBalances({
    userId: user?.id || null,
    userEmail: user?.email || null
  });
  const { currentTier } = useStars();
  const { activePackages, loading } = useTopupPackages();
  const [showTierModal, setShowTierModal] = useState(false);

  // Force refresh balances when coming from payment callback
  useEffect(() => {
    const fromPayment = location.state?.fromPayment || sessionStorage.getItem('payment_completed');

    if (fromPayment) {
      console.log('[Wallet] Detected return from payment, forcing balance refresh');

      // Clear the flag
      sessionStorage.removeItem('payment_completed');

      // Force refresh balances after a short delay to ensure database has been updated
      const refreshTimer = setTimeout(() => {
        console.log('[Wallet] Executing forced refresh after payment');
        refresh();
      }, 1000);

      return () => clearTimeout(refreshTimer);
    }
  }, [location.state, refresh]);

  return (
    <div className="min-h-screen pb-28 pt-20 bg-gradient-to-b from-primary-50 to-white">
      <PageHeader />
      <div className="glass border-b border-white/20 backdrop-blur-2xl">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">W Balance</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 pb-20 space-y-4">
        <div className="glass p-5 rounded-2xl text-center space-y-3">
          <div className="w-14 h-14 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
            <WalletIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 mb-2">
              <CheckCircle className="w-3 h-3 text-green-600" />
              <p className="text-xs font-bold text-green-700">Live from transaction history</p>
            </div>
            <p className="text-xs text-gray-600 mb-1">W Balance</p>
            <p className="text-4xl font-black gradient-primary text-gradient">
              RM{(balances?.wBalance || 0).toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-6 mt-3 text-xs">
              <div>
                <p className="text-gray-500">W Balance</p>
                <p className="font-bold text-gray-900 text-sm">RM{(balances?.wBalance || 0).toFixed(2)}</p>
              </div>
              <div className="w-px h-6 bg-gray-300"></div>
              <div>
                <p className="text-gray-500">Your Bonus</p>
                <p className="font-bold text-orange-600 text-sm">RM{(balances?.bonusBalance || 0).toFixed(2)}</p>
              </div>
            </div>
            {/* <div className="flex items-center justify-center gap-6 mt-2 text-xs">
              <div>
                <p className="text-gray-500">Lifetime Topups</p>
                <p className="font-bold text-blue-600 text-sm">RM{(balances?.lifetimeTopup || 0).toFixed(2)}</p>
              </div>
              <div className="w-px h-6 bg-gray-300"></div>
              <div>
                <p className="text-gray-500">Total Transactions</p>
                <p className="font-bold text-gray-900 text-sm">{balances?.totalTransactions || 0}</p>
              </div>
            </div> */}
          </div>
          {(balances?.bonusBalance || 0) > 0 && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs text-orange-800">
                <span className="font-bold">Your Bonus</span> can be used as additional discount on shop purchases!
              </p>
            </div>
          )}
        </div>

        <div className="glass p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">Top Up W Balance</h2>
            <button
              onClick={() => navigate('/wallet/topup')}
              className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Top Up
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Add funds to your W Balance and earn bonus stars with every top-up!
          </p>
          <div className="grid grid-cols-2 gap-3">
            {loading ? (
              <div className="col-span-2 text-center py-8 text-gray-500">
                <p>Loading packages...</p>
              </div>
            ) : activePackages.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-gray-500">
                <p>No topup packages available</p>
              </div>
            ) : (
              activePackages.map((pkg) => {
                const totalStars = pkg.base_stars + pkg.extra_stars;

                return (
                  <button
                    key={pkg.id}
                    onClick={() => navigate('/wallet/topup', { state: { selectedAmount: pkg.amount } })}
                    className="relative p-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-primary-300 hover:scale-105 active:scale-95 transition-all overflow-hidden"
                  >
                    {pkg.bonus_amount > 0 && (
                      <div className="absolute top-2 right-2">
                        <div className="flex items-center gap-0.5 px-2 py-0.5 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-full text-[10px] font-black shadow-lg">
                          <Gift className="w-3 h-3" />
                          RM{pkg.bonus_amount.toFixed(0)}
                        </div>
                      </div>
                    )}
                    {pkg.is_recommended && (
                      <div className="absolute top-2 left-2 animate-bounce">
                        <div className="flex items-center gap-0.5 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-[10px] font-black shadow-lg">
                          <ThumbsUp className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                    <div className="text-center mt-2">
                      <p className="text-2xl font-black text-gray-900">RM{pkg.amount}</p>
                      <div className="space-y-0.5 mt-2">
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-700 font-bold">
                          <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
                          Earn {pkg.base_stars} {pkg.base_stars === 1 ? 'star' : 'stars'}
                        </div>
                        {pkg.extra_stars > 0 && (
                          <div className="flex items-center justify-center gap-1 text-xs text-purple-600 font-bold">
                            <Star className="w-3 h-3" fill="currentColor" />
                            Extra {pkg.extra_stars} stars
                          </div>
                        )}
                        {pkg.bonus_amount > 0 && (
                          <div className="flex items-center justify-center gap-1 text-xs text-orange-600 font-bold">
                            <Ticket className="w-3 h-3" />
                            +RM{pkg.bonus_amount.toFixed(0)} Bonus
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <button
            onClick={() => navigate('/wallet/topup')}
            className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2 mt-3"
          >
            <Plus className="w-4 h-4" />
            View All Packages
          </button>
        </div>

        <button
          onClick={() => setShowTierModal(true)}
          className="glass p-4 rounded-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-600" />
              <h2 className="text-sm font-bold text-gray-900">Your Tier Multiplier</h2>
            </div>
            <Info className="w-4 h-4 text-primary-600" />
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Earn more stars with every purchase
          </p>
          <div className="p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border-2 border-yellow-200">
            <p className="text-center text-xs text-gray-700 mb-1">
              Every RM1 spent earns you
            </p>
            <p className="text-center">
              <span className="font-black text-primary-600 text-3xl">
                {currentTier?.earn_multiplier || 1}x
              </span>{' '}
              <span className="text-xs text-gray-600 font-medium">stars</span>
            </p>
            <p className="text-center text-xs text-primary-600 font-bold mt-2">
              Tap to view all tier benefits
            </p>
          </div>
        </button>
      </div>

      <TierBenefitsModal
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
      />

      <BottomNav />
    </div>
  );
};

export default Wallet;
