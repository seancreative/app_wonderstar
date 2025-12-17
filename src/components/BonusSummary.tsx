import React, { useState, useEffect } from 'react';
import { Star, Ticket, Tag, TrendingUp, Sparkles, Award } from 'lucide-react';

interface BonusSummaryProps {
  tierName: string;
  tierDiscountPct: number;
  tierDiscountAmount: number;
  tierMultiplier: number;
  starsEarned: number;
  stampsEarned: number;
  hasVouchers?: boolean;
}

const BonusSummary: React.FC<BonusSummaryProps> = ({
  tierName,
  tierDiscountPct,
  tierDiscountAmount,
  tierMultiplier,
  starsEarned,
  stampsEarned,
  hasVouchers = false,
}) => {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    const delays = [300, 600, 900, 1200, 1500];
    const timers = delays.map((delay, index) =>
      setTimeout(() => setAnimationStep(index + 1), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  const AnimatedItem = ({
    index,
    icon: Icon,
    label,
    value,
    color = 'primary',
    highlight = false
  }: {
    index: number;
    icon: any;
    label: string;
    value: string;
    color?: string;
    highlight?: boolean;
  }) => {
    const colorClasses = {
      primary: 'from-primary-500 to-primary-600',
      gold: 'from-yellow-400 to-orange-500',
      green: 'from-green-500 to-emerald-600',
      amber: 'from-amber-500 to-orange-500',
      purple: 'from-purple-500 to-indigo-600',
    };

    const iconColors = {
      primary: 'text-primary-600',
      gold: 'text-yellow-600',
      green: 'text-green-600',
      amber: 'text-amber-600',
      purple: 'text-purple-600',
    };

    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${
          animationStep >= index
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        } ${
          highlight
            ? `bg-gradient-to-r ${colorClasses[color as keyof typeof colorClasses]} shadow-lg animate-pulse-glow`
            : 'bg-white'
        }`}
        style={{ transitionDelay: `${index * 150}ms` }}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          highlight
            ? 'bg-white/20'
            : 'bg-gradient-to-br ' + colorClasses[color as keyof typeof colorClasses]
        }`}>
          <Icon className={`w-5 h-5 ${highlight ? 'text-white' : iconColors[color as keyof typeof iconColors]}`} />
        </div>
        <div className="flex-1">
          <p className={`text-xs font-semibold ${highlight ? 'text-white/90' : 'text-gray-600'}`}>
            {label}
          </p>
          <p className={`text-sm font-black ${highlight ? 'text-white' : 'text-gray-900'}`}>
            {value}
          </p>
        </div>
        {animationStep >= index && (
          <div className="animate-bounce-soft">
            <Sparkles className={`w-5 h-5 ${highlight ? 'text-white' : iconColors[color as keyof typeof iconColors]}`} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="glass p-5 rounded-2xl space-y-3 relative overflow-hidden animate-slide-up">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-500/10 to-transparent rounded-full blur-2xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-yellow-500/10 to-transparent rounded-full blur-2xl" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-primary-600" />
            Bonus Summary
          </h3>
          <div className="px-3 py-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full text-xs font-bold animate-bounce-soft">
            {tierName}
          </div>
        </div>

        <div className="space-y-2">
          {tierDiscountAmount > 0 && (
            <AnimatedItem
              index={1}
              icon={Tag}
              label={`${tierName} Tier Discount (${tierDiscountPct}%)`}
              value={`-RM ${tierDiscountAmount.toFixed(2)}`}
              color="green"
              highlight={true}
            />
          )}

          {tierMultiplier > 1 && (
            <AnimatedItem
              index={2}
              icon={TrendingUp}
              label={`${tierName} Stars Multiplier`}
              value={`${tierMultiplier}x Earning Rate`}
              color="gold"
            />
          )}

          <AnimatedItem
            index={3}
            icon={Star}
            label="Total Stars Earned"
            value={`+${starsEarned} Stars`}
            color="gold"
          />

          {stampsEarned > 0 && (
            <AnimatedItem
              index={4}
              icon={Ticket}
              label="Stamps Earned"
              value={`+${stampsEarned} Stamp${stampsEarned !== 1 ? 's' : ''}`}
              color="amber"
            />
          )}

          {hasVouchers && animationStep >= 5 && (
            <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-dashed border-purple-300 animate-scale-in">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-600 animate-spin-slow" />
                <p className="text-xs font-bold text-purple-900">
                  Redeem vouchers for even more savings!
                </p>
              </div>
            </div>
          )}
        </div>

        {animationStep >= 4 && (
          <div className="mt-4 p-3 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-600" />
              <p className="text-xs font-semibold text-gray-700">
                You're earning amazing rewards with {tierName} tier benefits!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BonusSummary;
