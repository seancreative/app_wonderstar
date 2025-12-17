import React from 'react';
import { UtensilsCrossed, IceCream, Sparkles, Info } from 'lucide-react';

interface StampCardProps {
  currentStamps: number;
  onRedeemIceCream?: () => void;
  onRedeemRamen?: () => void;
  canRedeemIceCream: boolean;
  canRedeemRamen: boolean;
}

const StampCard: React.FC<StampCardProps> = ({
  currentStamps,
  onRedeemIceCream,
  onRedeemRamen,
  canRedeemIceCream,
  canRedeemRamen,
}) => {
  const renderStamp = (index: number, filled: boolean) => {
    const isIceCreamMilestone = index === 4;
    const isRamenMilestone = index === 9;
    const showIcon = isIceCreamMilestone || isRamenMilestone;

    return (
      <div key={index} className="relative flex flex-col items-center">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
            filled
              ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-glow scale-100'
              : 'border-2 border-dashed border-white/40 bg-white/10 scale-95'
          }`}
        >
          {filled && showIcon ? (
            <div className="relative">
              {isIceCreamMilestone ? (
                <IceCream className="w-6 h-6 text-white" />
              ) : (
                <UtensilsCrossed className="w-6 h-6 text-white" />
              )}
              <div className="absolute inset-0 rounded-full bg-white opacity-0 animate-ping" />
            </div>
          ) : !filled && showIcon ? (
            <div className="relative">
              {isIceCreamMilestone ? (
                <IceCream className="w-6 h-6 text-white/40" />
              ) : (
                <UtensilsCrossed className="w-6 h-6 text-white/40" />
              )}
            </div>
          ) : filled ? (
            <div className="relative">
              <Sparkles className="w-5 h-5 text-white" fill="white" />
              <div className="absolute inset-0 rounded-full bg-white opacity-0 animate-ping" />
            </div>
          ) : (
            <span className="text-white/60 text-xs font-bold">{index + 1}</span>
          )}
        </div>
        {showIcon && (
          <div className="absolute -bottom-5 whitespace-nowrap">
            <span className="text-[10px] font-bold text-white">
              {isIceCreamMilestone ? 'Ice Cream' : 'Ramen'}
            </span>
          </div>
        )}
      </div>
    );
  };

  const [showInfo, setShowInfo] = React.useState(false);

  return (
    <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-6 rounded-3xl space-y-6 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-black text-white">Stamp Card</h3>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <Info className="w-4 h-4 text-white/70" />
          </button>
        </div>
        <div className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full shadow-glow">
          <span className="text-2xl font-black">{currentStamps}</span>
          <span className="text-sm font-semibold ml-1">/10</span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="overflow-x-auto pb-6 scrollbar-hide">
          <div className="flex gap-2 min-w-max justify-center">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) =>
              renderStamp(index, index < currentStamps)
            )}
          </div>
        </div>

        <div className="space-y-3">
          {canRedeemIceCream && onRedeemIceCream && (
            <button
              onClick={onRedeemIceCream}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-2xl font-bold shadow-lg hover:scale-105 transition-transform animate-pulse-glow"
            >
              <div className="flex items-center justify-center gap-2">
                <IceCream className="w-5 h-5" />
                <span>Redeem Free Ice Cream!</span>
              </div>
            </button>
          )}

          {canRedeemRamen && onRedeemRamen && (
            <button
              onClick={onRedeemRamen}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-2xl font-bold shadow-lg hover:scale-105 transition-transform animate-pulse-glow"
            >
              <div className="flex items-center justify-center gap-2">
                <UtensilsCrossed className="w-5 h-5" />
                <span>Redeem Free Ramen!</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {showInfo && (
        <div className="backdrop-blur-xl bg-white/20 border border-white/30 p-4 rounded-2xl animate-scale-in">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-yellow-300 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-white space-y-1">
              <p className="font-bold">How to earn stamps:</p>
              <ul className="space-y-1 ml-3">
                <li>• 1 paid ticket = 1 stamp</li>
                <li>• Free tickets don't count</li>
                <li>• Example: 3 adults + 3 kids = 6 stamps</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default StampCard;
