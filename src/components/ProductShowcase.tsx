import React, { useState, useEffect } from 'react';
import { Star, Gift, ShoppingBag, Sparkles, Coins, Trophy, Ticket, Zap } from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const ProductShowcase: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const features: Feature[] = [
    {
      icon: <Star className="w-8 h-8" />,
      title: "Earn WonderStars",
      description: "Collect stars with every purchase and unlock amazing rewards!",
      color: "from-yellow-400 to-orange-500"
    },
    {
      icon: <ShoppingBag className="w-8 h-8" />,
      title: "Order Food & Drinks",
      description: "Browse our menu and order directly from your phone",
      color: "from-green-400 to-emerald-500"
    },
    {
      icon: <Gift className="w-8 h-8" />,
      title: "Lucky Egg Gacha",
      description: "Spin for prizes! Win free items, discounts, and bonus coins",
      color: "from-pink-400 to-rose-500"
    },
    {
      icon: <Ticket className="w-8 h-8" />,
      title: "Exclusive Vouchers",
      description: "Get special discounts and free gift vouchers daily",
      color: "from-blue-400 to-cyan-500"
    },
    {
      icon: <Coins className="w-8 h-8" />,
      title: "Digital Wallet",
      description: "Top up your wallet and enjoy bonus credits on every reload",
      color: "from-emerald-400 to-teal-500"
    },
    {
      icon: <Trophy className="w-8 h-8" />,
      title: "Tier Rewards",
      description: "Level up your membership for bigger discounts and perks",
      color: "from-amber-400 to-yellow-500"
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "AI Workshops",
      description: "Book exciting educational workshops for your kids",
      color: "from-fuchsia-400 to-pink-500"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "QR Check-In",
      description: "Quick check-in and redemption with your personal QR code",
      color: "from-orange-400 to-red-500"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % features.length);
        setIsAnimating(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [features.length]);

  const currentFeature = features[currentIndex];

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="relative h-44 overflow-hidden">
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          <div className="text-center space-y-3 px-6">
            <div
              className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${currentFeature.color} shadow-lg animate-bounce-soft`}
            >
              <div className="text-white">
                {currentFeature.icon}
              </div>
            </div>

            <div className="space-y-1 animate-fade-in">
              <h3 className="text-lg font-bold text-white drop-shadow-lg">
                {currentFeature.title}
              </h3>
              <p className="text-sm text-white/90 leading-relaxed drop-shadow-md">
                {currentFeature.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-1.5 mt-2">
        {features.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setIsAnimating(true);
              setTimeout(() => {
                setCurrentIndex(index);
                setIsAnimating(false);
              }, 300);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'w-8 bg-white shadow-lg'
                : 'w-1.5 bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default ProductShowcase;
