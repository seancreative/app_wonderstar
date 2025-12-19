import React from 'react';
import { X, Star, ShoppingBag, Crown, Sparkles, ArrowRight, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStars } from '../hooks/useStars';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { MembershipTier } from '../types/database';

interface TierBenefitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TierBenefitsModal: React.FC<TierBenefitsModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  // const { user } = useAuth(); // Removed, using lifetimeTopups from useStars
  const { currentTier, nextTier, lifetimeTopups } = useStars();
  const [allTiers, setAllTiers] = React.useState<MembershipTier[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      loadAllTiers();
    }
  }, [isOpen]);

  const loadAllTiers = async () => {
    const { data } = await supabase
      .from('membership_tiers')
      .select('*')
      .order('sort_order', { ascending: true });

    if (data) {
      setAllTiers(data);
    }
  };

  const getAmountToNextTier = () => {
    if (!nextTier) return 0;
    const current = lifetimeTopups;
    return Math.max(nextTier.threshold - current, 0);
  };

  const getTierIcon = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'bronze': return Trophy;
      case 'silver': return Star;
      case 'gold': return Crown;
      case 'platinum': return Sparkles;
      case 'vip': return Crown;
      default: return Star;
    }
  };

  const getTierGradient = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'bronze': return 'from-amber-700 to-amber-900';
      case 'silver': return 'from-gray-400 to-gray-600';
      case 'gold': return 'from-yellow-400 to-yellow-600';
      case 'platinum': return 'from-slate-300 to-slate-500';
      case 'vip': return 'from-purple-500 to-purple-700';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getBenefitComparison = (benefit: number, isPercentage: boolean = false) => {
    if (benefit === 0) return '-';
    return isPercentage ? `${benefit}%` : `${benefit}x`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-gradient-to-br from-white to-gray-50 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Crown className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black">Tier Benefits</h2>
              <p className="text-purple-100 text-sm font-medium">Compare and unlock exclusive rewards</p>
            </div>
          </div>


          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentTier && (
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-2">
                  <div className={`p-2 bg-gradient-to-br ${getTierGradient(currentTier.name)} rounded-lg`}>
                    {React.createElement(getTierIcon(currentTier.name), { className: 'w-4 h-4 text-white' })}
                  </div>
                  <div>
                    <p className="text-xs text-purple-100 font-medium">Current Tier</p>
                    <p className="text-sm font-black text-white">{currentTier.name}</p>
                  </div>
                </div>
              </div>
            )}

            {nextTier && getAmountToNextTier() > 0 && (
              <div className="p-3 bg-green-500/20 border border-green-300/50 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-green-200" />
                  <div>
                    <p className="text-xs text-green-100 font-medium">Next: {nextTier.name}</p>
                    <p className="text-sm font-black text-white">RM{getAmountToNextTier().toFixed(0)} more</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allTiers.map((tier, index) => {
              const Icon = getTierIcon(tier.name);
              const isCurrentTier = currentTier?.id === tier.id;

              return (
                <div
                  key={tier.id}
                  className={`relative p-4 rounded-2xl border-2 transition-all ${isCurrentTier
                    ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-xl'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
                    }`}
                >
                  {isCurrentTier && (
                    <div className="absolute -top-2 left-3 px-3 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-black rounded-full shadow-lg">
                      YOU ARE HERE
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-3 bg-gradient-to-br ${getTierGradient(tier.name)} rounded-xl shadow-lg flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-gray-900">{tier.name}</h3>
                      {!isCurrentTier && tier.threshold > lifetimeTopups && (
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                          Locked
                        </p>
                      )}
                      {isCurrentTier && (
                        <p className="text-xs text-green-600 font-bold">
                          Current tier
                        </p>
                      )}
                      {tier.threshold <= lifetimeTopups && !isCurrentTier && (
                        <p className="text-xs text-green-600 font-bold">
                          Unlocked!
                        </p>
                      )}
                    </div>
                    {index > 0 && (
                      <div className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black">
                        +{((tier.earn_multiplier / allTiers[0].earn_multiplier - 1) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="p-3 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="w-4 h-4 text-yellow-600" fill="currentColor" />
                        <p className="text-xs font-bold text-gray-700">Stars Multiplier</p>
                      </div>
                      <p className="text-2xl font-black text-yellow-700">{tier.earn_multiplier}x</p>
                      <p className="text-xs text-gray-600 font-medium mt-1">Earn {tier.earn_multiplier}x stars per RM</p>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border-2 border-pink-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-pink-600" fill="currentColor" />
                        <p className="text-xs font-bold text-gray-700">Permanent Perks</p>
                      </div>
                      <p className="text-xl font-black text-pink-700">{tier.name !== 'Bronze' ? 'Unlocked' : '-'}</p>
                      <p className="text-xs text-gray-600 font-medium mt-1">{tier.name !== 'Bronze' ? 'Lifetime benefits' : 'Entry tier'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200">
            <h4 className="font-black text-gray-900 mb-3 flex items-center gap-2">
              <Crown className="w-5 h-5 text-indigo-600" />
              How It Works
            </h4>
            <div className="space-y-2 text-sm text-gray-700">
              <p className="flex items-start gap-2">
                <span className="font-black text-indigo-600 flex-shrink-0">1.</span>
                <span className="font-medium">Top up your W Balance to increase your lifetime spending</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-black text-indigo-600 flex-shrink-0">2.</span>
                <span className="font-medium">Reach tier thresholds to unlock permanent benefits</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-black text-indigo-600 flex-shrink-0">3.</span>
                <span className="font-medium">Enjoy multiplied stars and exclusive perks forever</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-black text-indigo-600 flex-shrink-0">4.</span>
                <span className="font-medium">Your tier never decreases - once unlocked, it's yours to keep!</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 p-6 bg-gradient-to-t from-white via-white to-transparent border-t border-gray-200">
          <button
            onClick={() => {
              onClose();
              navigate('/wallet/topup');
            }}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-lg hover:scale-105 transition-transform shadow-xl flex items-center justify-center gap-2"
          >
            <Crown className="w-6 h-6" />
            Top Up Now & Level Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default TierBenefitsModal;
