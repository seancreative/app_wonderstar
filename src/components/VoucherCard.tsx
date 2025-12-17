import React from 'react';
import { Ticket, Gift, Tag, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { UserVoucher } from '../types/database';

interface VoucherCardProps {
  userVoucher: UserVoucher;
  onClick?: () => void;
  showStatus?: boolean;
  compact?: boolean;
}

const VoucherCard: React.FC<VoucherCardProps> = ({
  userVoucher,
  onClick,
  showStatus = true,
  compact = false
}) => {
  const voucher = userVoucher.voucher;
  if (!voucher) return null;

  const getVoucherTypeDisplay = () => {
    switch (voucher.voucher_type) {
      case 'percent':
        return { value: `${voucher.value}%`, label: 'OFF' };
      case 'amount':
        return { value: `RM${voucher.value}`, label: 'OFF' };
      case 'b1f1':
        return { value: 'BUY 1', label: 'FREE 1' };
      case 'free_item':
        return { value: 'FREE', label: 'GIFT' };
      case 'free_gift':
        return { value: 'FREE GIFT', label: voucher.free_gift_name || 'ITEM' };
      default:
        return { value: 'DISCOUNT', label: '' };
    }
  };

  const getStatusIcon = () => {
    switch (userVoucher.status) {
      case 'available':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'used':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusColor = () => {
    switch (userVoucher.status) {
      case 'available':
        return 'from-emerald-400 to-teal-400';
      case 'used':
        return 'from-gray-300 to-gray-400';
      case 'expired':
        return 'from-red-300 to-pink-400';
    }
  };

  const getBackgroundColor = () => {
    switch (userVoucher.status) {
      case 'available':
        return 'bg-gradient-to-br from-emerald-50 to-teal-50';
      case 'used':
        return 'bg-gradient-to-br from-gray-50 to-gray-100';
      case 'expired':
        return 'bg-gradient-to-br from-red-50 to-pink-50';
    }
  };

  const getTimeRemaining = () => {
    if (!userVoucher.expires_at) return null;

    const now = new Date();
    const expiry = new Date(userVoucher.expires_at);
    const diff = expiry.getTime() - now.getTime();

    if (diff < 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (userVoucher.is_daily_voucher) {
      if (hours > 0) return `${hours}h ${minutes}m left`;
      if (minutes > 0) return `${minutes}m left`;
      return 'Expires soon';
    }

    if (days > 0) return `${days}d left`;
    if (hours > 0) return `${hours}h left`;
    return 'Expires soon';
  };

  const isValidForTodayOnly = () => {
    if (!voucher.valid_for_today_only && !userVoucher.is_daily_voucher) return false;
    if (!userVoucher.expires_at) return false;

    const today = new Date();
    const expiryDate = new Date(userVoucher.expires_at);

    return (
      today.getFullYear() === expiryDate.getFullYear() &&
      today.getMonth() === expiryDate.getMonth() &&
      today.getDate() === expiryDate.getDate()
    );
  };

  const isDailyVoucher = () => {
    return userVoucher.is_daily_voucher || voucher.is_daily_redeemable;
  };

  const getDailyVoucherStatus = () => {
    if (!isDailyVoucher()) return null;

    const today = new Date();
    const lastRedeemed = userVoucher.last_redeemed_date ? new Date(userVoucher.last_redeemed_date) : null;

    if (!lastRedeemed) return 'available';

    const isToday = lastRedeemed.getFullYear() === today.getFullYear() &&
                    lastRedeemed.getMonth() === today.getMonth() &&
                    lastRedeemed.getDate() === today.getDate();

    return isToday ? 'redeemed_today' : 'available';
  };

  const isDisabled = userVoucher.status !== 'available';
  const typeDisplay = getVoucherTypeDisplay();

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full text-left p-0 rounded-2xl transition-all overflow-hidden ${
        !isDisabled ? 'hover:scale-102 active:scale-98 shadow-md hover:shadow-xl' : 'opacity-60 cursor-not-allowed'
      }`}
    >
      <div className={`relative ${getBackgroundColor()} border-2 border-white/50`}>
        {/* Left side - Voucher value */}
        <div className="flex">
          <div className={`w-24 bg-gradient-to-br ${getStatusColor()} p-4 flex flex-col items-center justify-center text-white relative`}>
            <div className="text-center">
              <div className="text-2xl font-black leading-tight">{typeDisplay.value}</div>
              {typeDisplay.label && (
                <div className="text-xs font-bold mt-0.5">{typeDisplay.label}</div>
              )}
            </div>

            {/* Decorative circles */}
            <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full" />

            {/* Icon badge */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              {voucher.voucher_type === 'free_item' ? (
                <Gift className="w-4 h-4 text-white" />
              ) : voucher.voucher_type === 'b1f1' ? (
                <Tag className="w-4 h-4 text-white" />
              ) : (
                <Ticket className="w-4 h-4 text-white" />
              )}
            </div>
          </div>

          {/* Right side - Details */}
          <div className="flex-1 p-3 relative">
            {/* Status badge */}
            {showStatus && (
              <div className="absolute top-2 right-2">
                {getStatusIcon()}
              </div>
            )}

            <div className="pr-6">
              <h3 className="text-sm font-black text-gray-900 mb-1 line-clamp-1">
                {voucher.title || voucher.code}
              </h3>

              {voucher.description && (
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {voucher.description}
                </p>
              )}

              {/* Badges row */}
              <div className="flex flex-wrap gap-1 mb-2">
                {isDailyVoucher() && (
                  <span className="text-[10px] px-2 py-0.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full font-bold">
                    Daily
                  </span>
                )}
                {isValidForTodayOnly() && !isDailyVoucher() && (
                  <span className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-full font-bold">
                    Today Only
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full font-mono font-bold">
                  {voucher.code}
                </span>
              </div>

              {/* Bottom info */}
              <div className="flex items-center justify-between text-[10px]">
                <div className="text-gray-600 font-semibold">
                  {voucher.min_purchase > 0 ? (
                    <span>Min: RM{voucher.min_purchase}</span>
                  ) : (
                    <span>No min. purchase</span>
                  )}
                </div>

                {userVoucher.expires_at && userVoucher.status === 'available' && (
                  <div className="flex items-center gap-1 text-orange-600 font-bold">
                    <Clock className="w-3 h-3" />
                    <span>{getTimeRemaining()}</span>
                  </div>
                )}

                {userVoucher.status === 'used' && (
                  <span className="text-gray-500 font-bold">Used</span>
                )}

                {userVoucher.status === 'expired' && (
                  <span className="text-red-600 font-bold">Expired</span>
                )}
              </div>

              {/* Additional info for product-level vouchers */}
              {voucher.application_scope === 'product_level' && userVoucher.status === 'available' && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-[10px] text-gray-600 font-medium">
                    {voucher.product_application_method === 'per_product' ? (
                      <>
                        {voucher.voucher_type === 'amount' ? (
                          <span className="font-bold text-emerald-700">
                            {typeDisplay.value} off each item (max {voucher.max_products_per_use})
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700">
                            {typeDisplay.value} off each item (max {voucher.max_products_per_use})
                          </span>
                        )}
                      </>
                    ) : (
                      <>Valid for {voucher.max_products_per_use} product{voucher.max_products_per_use > 1 ? 's' : ''}</>
                    )}
                    {userVoucher.usage_count > 0 && !isDailyVoucher() && ` • ${userVoucher.usage_count}/${userVoucher.max_usage_count} used`}
                  </p>
                </div>
              )}

              {/* Daily usage limit display */}
              {voucher.user_daily_limit && userVoucher.status === 'available' && !isDailyVoucher() && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-[10px] text-blue-700 font-medium">
                    Daily uses: {userVoucher.daily_usage_count || 0}/{voucher.user_daily_limit}
                    {userVoucher.daily_usage_count >= voucher.user_daily_limit && ' • Resets tomorrow'}
                  </p>
                </div>
              )}

              {/* Daily voucher status */}
              {isDailyVoucher() && getDailyVoucherStatus() === 'redeemed_today' && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <p className="text-[10px] text-green-700 font-bold">
                    ✓ Redeemed today{userVoucher.redemption_count > 0 && ` (${userVoucher.redemption_count}x total)`}
                  </p>
                </div>
              )}

              {isDailyVoucher() && getDailyVoucherStatus() === 'available' && userVoucher.redemption_count > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-[10px] text-gray-600 font-medium">
                    Redeemed {userVoucher.redemption_count}x
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Decorative dashed line */}
        <div className="absolute left-24 top-0 bottom-0 w-px border-l-2 border-dashed border-white/30" />
      </div>
    </button>
  );
};

export default VoucherCard;
