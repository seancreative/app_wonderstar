import React, { useState, useEffect } from 'react';
import { X, Gift, TrendingDown, AlertCircle } from 'lucide-react';

interface BonusSliderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bonusBalance: number;
  subtotal: number;
  discount: number;
  onApply: (amount: number) => void;
}

const BonusSliderModal: React.FC<BonusSliderModalProps> = ({
  isOpen,
  onClose,
  bonusBalance,
  subtotal,
  discount,
  onApply
}) => {
  const maxAllowedBonus = Math.floor(Math.min(bonusBalance, Math.max(0, subtotal - discount)));
  const [selectedAmount, setSelectedAmount] = useState(0);

  useEffect(() => {
    setSelectedAmount(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseInt(e.target.value);
    setSelectedAmount(amount);
  };

  const handleApply = () => {
    if (selectedAmount > 0) {
      onApply(selectedAmount);
      onClose();
    }
  };

  const finalTotal = Math.max(0, subtotal - discount - selectedAmount);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Apply Bonus Discount</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-2xl border border-orange-200">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-bold text-orange-900">Available Bonus Balance</span>
            </div>
            <p className="text-3xl font-black text-orange-600">
              RM {bonusBalance.toFixed(2)}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Select Amount</span>
              <span className="text-lg font-black text-orange-600">
                RM {selectedAmount}
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={maxAllowedBonus}
                step="1"
                value={selectedAmount}
                onChange={handleSliderChange}
                className="w-full h-3 bg-gradient-to-r from-gray-200 via-orange-200 to-orange-400 rounded-full appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #fb923c 0%, #fb923c ${maxAllowedBonus > 0 ? (selectedAmount / maxAllowedBonus * 100) : 0}%, #e5e7eb ${maxAllowedBonus > 0 ? (selectedAmount / maxAllowedBonus * 100) : 0}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>RM 0</span>
                <span>RM {maxAllowedBonus}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold text-gray-900">RM {subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Voucher Discount</span>
                <span className="font-semibold text-green-600">- RM {discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-orange-600">Bonus Discount</span>
              <span className="font-semibold text-orange-600">- RM {selectedAmount}</span>
            </div>
            <div className="pt-2 border-t border-gray-300 flex justify-between items-center">
              <span className="font-bold text-gray-900">Final Total</span>
              <div className="text-right">
                <p className="text-2xl font-black text-gray-900">
                  RM {finalTotal.toFixed(2)}
                </p>
                {finalTotal === 0 && (
                  <p className="text-xs text-green-600 font-bold mt-1">FREE ORDER!</p>
                )}
              </div>
            </div>
          </div>

          {maxAllowedBonus === 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-900">
                No bonus discount can be applied. Order is already fully discounted or bonus balance insufficient.
              </p>
            </div>
          )}

          {selectedAmount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
              <TrendingDown className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-900 font-semibold">
                You'll save RM {(discount + selectedAmount).toFixed(2)} total!
                {finalTotal === 0 && " Your order will be completely free!"}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedAmount === 0 || maxAllowedBonus === 0}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              Apply RM {selectedAmount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BonusSliderModal;
