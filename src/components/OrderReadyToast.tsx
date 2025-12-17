import React from 'react';
import { Bell, Package, X } from 'lucide-react';

interface OrderReadyToastProps {
  collectionNumber: string;
  orderNumber: string;
  outletName?: string;
  onClose: () => void;
  onTap: () => void;
}

const OrderReadyToast: React.FC<OrderReadyToastProps> = ({
  collectionNumber,
  orderNumber,
  outletName,
  onClose,
  onTap
}) => {
  return (
    <div
      className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[9999] animate-slide-down"
      style={{ maxWidth: '90vw', width: '400px' }}
    >
      <div
        onClick={onTap}
        className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl shadow-2xl border-4 border-green-300 cursor-pointer hover:scale-105 transition-transform"
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="bg-white rounded-full p-2 animate-bounce">
                <Bell className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-white font-black text-lg">Ready to Collect!</h3>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white bg-opacity-20 rounded-xl p-3 mb-3">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-white animate-pulse" />
              <div>
                <p className="text-white text-xs font-semibold opacity-90">Order Number</p>
                <p className="text-white text-2xl font-black">#{collectionNumber}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-white text-sm font-bold">
              Your order is ready for pickup!
            </p>
            {outletName && (
              <p className="text-white text-xs opacity-90">
                📍 {outletName}
              </p>
            )}
            <p className="text-white text-xs opacity-75 italic">
              Tap to view QR code
            </p>
          </div>
        </div>

        <div className="bg-white bg-opacity-10 px-4 py-2 rounded-b-xl">
          <p className="text-white text-xs text-center font-semibold">
            Show your QR code at the counter
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderReadyToast;
