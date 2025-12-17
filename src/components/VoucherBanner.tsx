import React, { useState } from 'react';
import { Ticket, ChevronRight, X } from 'lucide-react';

interface VoucherBannerProps {
  voucherCode?: string;
  voucherTitle?: string;
  onApply?: () => void;
  onRemove?: () => void;
  isApplied?: boolean;
}

const VoucherBanner: React.FC<VoucherBannerProps> = ({
  voucherCode,
  voucherTitle,
  onApply,
  onRemove,
  isApplied = false,
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);

  console.log('[VoucherBanner] Received props:', { voucherCode, voucherTitle, isApplied });

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmation(true);
  };

  const handleConfirmRemove = () => {
    setShowConfirmation(false);
    onRemove?.();
  };

  const handleCancelRemove = () => {
    setShowConfirmation(false);
  };

  return (
    <>
      <div className="fixed top-[72px] left-0 right-0 z-30 max-w-md mx-auto shadow-md slide-down">
        <div className="relative bg-gradient-to-r from-orange-50 to-amber-50 border-b-4 border-orange-500">
          <button
            onClick={onApply}
            className={`w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-orange-100/50 transition-colors active:scale-[0.99] ${
              isApplied ? 'pr-14' : ''
            }`}
          >
            <div className="p-1.5 bg-orange-500 rounded-lg animate-pulse-gentle flex-shrink-0">
              <Ticket className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 text-left overflow-hidden">
              <p className="text-[11px] font-bold text-gray-900 truncate leading-tight">
                {isApplied ? (
                  <>
                    <span className="text-green-600">{voucherCode} Applied ✓</span>
                  </>
                ) : (
                  <>
                    <span className="text-orange-600">Select Voucher</span>
                  </>
                )}
              </p>
              {isApplied && voucherTitle && (
                <p className="text-[10px] text-gray-600 truncate leading-tight">{voucherTitle}</p>
              )}
              {!isApplied && (
                <p className="text-[10px] text-gray-600 truncate leading-tight">Tap to choose a voucher</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!isApplied && (
                <>
                  <span className="text-xs font-bold text-orange-600">
                    Select
                  </span>
                  <ChevronRight className="w-4 h-4 text-orange-600" />
                </>
              )}
            </div>
          </button>

          {isApplied && onRemove && (
            <button
              onClick={handleRemoveClick}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full transition-all hover:scale-110 active:scale-95 shadow-md z-10"
              aria-label="Remove voucher"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>
      </div>

      {showConfirmation && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={handleCancelRemove}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full shadow-2xl animate-scale-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-red-500 to-pink-500 px-6 py-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-gentle">
                <Ticket className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">
                Remove Voucher?
              </h3>
              <p className="text-white/90 text-sm font-semibold">
                {voucherCode}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-center text-gray-700 font-medium">
                Are you sure you want to remove this voucher?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelRemove}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRemove}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoucherBanner;
