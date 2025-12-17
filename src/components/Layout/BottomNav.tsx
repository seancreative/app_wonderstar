import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, Star, QrCode, User, GraduationCap } from 'lucide-react';
import { useShop } from '../../contexts/ShopContext';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { cartCount, getCartOutlet, setSelectedOutlet } = useShop();
  const [prevCartCount, setPrevCartCount] = useState(cartCount);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (cartCount > prevCartCount) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    }
    setPrevCartCount(cartCount);
  }, [cartCount]);

  const handleShopClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (cartCount > 0) {
      const outlet = await getCartOutlet();
      if (outlet) {
        setSelectedOutlet(outlet);
        navigate(`/shop/${outlet.slug}`);
        return;
      }
    }

    navigate('/shop');
  };

  const navItems = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/shop', icon: ShoppingBag, label: 'Shop', showBadge: true, onClick: handleShopClick },
   
    { to: '/stars', icon: Star, label: 'Stars' },
     { to: '/edu', icon: GraduationCap, label: 'AI Genius' },
    { to: '/myqr', icon: QrCode, label: 'MyQR' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto">
      <div className="glass border-t border-white/20 backdrop-blur-2xl">
        <div className="px-2 py-3">
          <div className="flex justify-around items-center">
            {navItems.map(({ to, icon: Icon, label, showBadge, onClick }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClick}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'text-primary-500 scale-110'
                      : 'theme-text-tertiary hover:theme-text-primary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`relative ${showBadge && isShaking ? 'animate-cart-shake' : ''}`}>
                      <Icon
                        className={`w-6 h-6 transition-all ${isActive ? 'animate-bounce-slow' : ''}`}
                      />
                      {showBadge && cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md">
                          {cartCount}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
