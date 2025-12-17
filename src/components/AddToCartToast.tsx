import React, { useEffect, useState } from 'react';
import { CheckCircle, ShoppingCart } from 'lucide-react';

interface AddToCartToastProps {
  show: boolean;
  productName: string;
  onClose: () => void;
}

const AddToCartToast: React.FC<AddToCartToastProps> = ({ show, productName, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 pointer-events-none">
      <div
        className={`pointer-events-auto transition-all duration-300 ${
          isVisible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 -translate-y-4 scale-95'
        }`}
      >
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-green-500 p-4 min-w-[280px] max-w-[340px]">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-30"></div>
                <div className="relative w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShoppingCart className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-bold text-gray-900">Added to Cart!</h3>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{productName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddToCartToast;
