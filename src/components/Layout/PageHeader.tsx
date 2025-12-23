import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Trophy, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useShop } from '../../contexts/ShopContext';
import { useStars } from '../../hooks/useStars';

interface PageHeaderProps {
  variant?: 'fixed' | 'sticky' | 'static';
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ variant = 'fixed', className = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedOutlet, cartCount, getCartOutlet, setSelectedOutlet } = useShop();
  const { currentTier } = useStars({ enabled: false }); // Don't auto-fetch on every page, use cached data
  const [prevCartCount, setPrevCartCount] = useState(cartCount);
  const [isShaking, setIsShaking] = useState(false);
  const [showStarburst, setShowStarburst] = useState(false);

  useEffect(() => {
    if (cartCount > prevCartCount) {
      setIsShaking(true);
      setShowStarburst(true);

      setTimeout(() => setIsShaking(false), 600);
      setTimeout(() => setShowStarburst(false), 800);
    }
    setPrevCartCount(cartCount);
  }, [cartCount]);

  const handleCartClick = async () => {
    if (selectedOutlet) {
      navigate(`/shop/${selectedOutlet.slug}/cart`);
    } else if (cartCount > 0) {
      const outlet = await getCartOutlet();
      if (outlet) {
        setSelectedOutlet(outlet);
        navigate(`/shop/${outlet.slug}/cart`);
        return;
      }
      navigate('/shop');
    } else {
      navigate('/shop');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getTierColor = () => {
    if (!currentTier) return 'from-silver-400 to-silver-600';
    if (currentTier.name === 'Gold') return 'from-gold-400 to-gold-600';
    if (currentTier.name === 'Platinum') return 'from-platinum-300 to-platinum-500';
    return 'from-silver-400 to-silver-600';
  };

  const positionClass = variant === 'fixed' ? 'fixed top-0 left-0 right-0' : variant === 'sticky' ? 'sticky top-0' : 'relative w-full';

  return (
    <div className={`${positionClass} z-50 glass border-b border-white/20 backdrop-blur-2xl max-w-md mx-auto ${className}`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button onClick={() => navigate('/home')} className="hover:scale-105 transition-transform">
              <img
                src="/wonderstar-nobg.png"
                alt="WonderStars"
                className="h-12 w-auto flex-shrink-0"
              />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs theme-text-tertiary font-medium">{getGreeting()}</p>
              <h1 className="text-xl font-bold theme-text-primary truncate">{user?.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r ${getTierColor()} text-white rounded-full text-[10px] font-bold shadow-md`}>
              <Trophy className="w-3 h-3" />
              {currentTier?.name || 'Silver'}
            </div>

            <div className="relative">
              <button
                onClick={handleCartClick}
                className={`relative p-2 bg-white rounded-xl shadow-md hover:scale-110 transition-transform ${isShaking ? 'animate-cart-shake' : ''
                  }`}
              >
                <ShoppingCart className="w-5 h-5 text-primary-600" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
                {showStarburst && (
                  <>
                    <Sparkles className="absolute -top-1 -left-1 w-4 h-4 text-gold-400 animate-starburst" />
                    <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-gold-400 animate-starburst" style={{ animationDelay: '0.1s' }} />
                    <Sparkles className="absolute -bottom-1 -left-1 w-4 h-4 text-gold-400 animate-starburst" style={{ animationDelay: '0.2s' }} />
                    <Sparkles className="absolute -bottom-1 -right-1 w-4 h-4 text-gold-400 animate-starburst" style={{ animationDelay: '0.15s' }} />
                  </>
                )}
              </button>
              {currentTier && currentTier.earn_multiplier > 1 && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-[9px] font-black shadow-md">
                    <Sparkles className="w-2.5 h-2.5" fill="white" />
                    <span>{currentTier.earn_multiplier}x</span>
                  </div>
                </div>
              )}

            </div>
          </div>  <button
            onClick={() => navigate('/profile')}
            className="flex-shrink-0 hover:scale-110 active:scale-95 transition-transform"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 via-primary-600 to-pink-600 flex items-center justify-center text-white text-sm font-black shadow-md overflow-hidden border-2 border-white">
              {user?.profile_picture_url ? (
                <img
                  src={user.profile_picture_url}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user?.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
