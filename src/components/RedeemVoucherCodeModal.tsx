import React, { useState } from 'react';
import { X, Ticket, Loader2, PartyPopper } from 'lucide-react';
import ConfettiAnimation from './ConfettiAnimation';
import VoucherCard from './VoucherCard';
import type { UserVoucher } from '../types/database';

interface RedeemVoucherCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRedeem: (code: string) => Promise<{ success: boolean; voucher?: UserVoucher; error?: string }>;
}

const RedeemVoucherCodeModal: React.FC<RedeemVoucherCodeModalProps> = ({
  isOpen,
  onClose,
  onRedeem
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redeemedVoucher, setRedeemedVoucher] = useState<UserVoucher | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      setError('Please enter a voucher code');
      return;
    }

    setLoading(true);
    setError('');

    const result = await onRedeem(code.trim());

    setLoading(false);

    if (result.success && result.voucher) {
      setRedeemedVoucher(result.voucher);
      setShowConfetti(true);
      setCode('');
    } else {
      setError(result.error || 'Failed to redeem voucher');
    }
  };

  const handleClose = () => {
    setCode('');
    setError('');
    setRedeemedVoucher(null);
    setShowConfetti(false);
    onClose();
  };

  const handleCodeChange = (value: string) => {
    setCode(value.toUpperCase());
    setError('');
  };

  if (!isOpen) return null;

  return (
    <>
      <ConfettiAnimation
        active={showConfetti}
        duration={3000}
        onComplete={() => setShowConfetti(false)}
      />

      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-3xl max-w-md w-full shadow-2xl animate-scale-in overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {redeemedVoucher ? (
            <div className="p-8 space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-glow animate-bounce-once mb-4">
                  <PartyPopper className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">
                  Success! 🎉
                </h2>
                <p className="text-gray-600 font-medium">
                  Voucher redeemed successfully!
                </p>
              </div>

              <VoucherCard userVoucher={redeemedVoucher} showStatus={false} />

              <button
                onClick={handleClose}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-black text-lg hover:scale-105 transition-transform shadow-lg"
              >
                Awesome!
              </button>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 px-6 py-8 text-center relative">
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-gentle">
                  <Ticket className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-black text-white mb-2">
                  Redeem Voucher
                </h2>
                <p className="text-white/90 font-medium">
                  Enter your voucher code below
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Voucher Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="Enter code (e.g., VCH-ABC123)"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 font-mono font-bold text-center text-lg uppercase placeholder:text-gray-400 placeholder:font-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={loading}
                    autoFocus
                  />
                  {error && (
                    <p className="mt-2 text-sm text-red-600 font-semibold">
                      {error}
                    </p>
                  )}
                </div>

                <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
                  <h4 className="font-black text-purple-900 text-sm mb-2">How to get voucher codes:</h4>
                  <ul className="space-y-1 text-xs text-purple-800 mb-3">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0"></div>
                      <span>Top up your W Balance</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0"></div>
                      <span>Check in daily at our outlets</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0"></div>
                      <span>Special promotions and events</span>
                    </li>
                  </ul>
                  <div className="bg-green-100 border border-green-300 rounded-lg p-2 mt-2">
                    <p className="text-xs text-green-900 font-bold">
                      \ud83c\udfaf Daily Vouchers: Some vouchers can be redeemed once per day! Valid until midnight.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-black text-lg hover:scale-105 active:scale-95 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Redeeming...
                    </span>
                  ) : (
                    'Redeem Voucher'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default RedeemVoucherCodeModal;
