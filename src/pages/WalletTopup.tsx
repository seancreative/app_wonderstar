import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Wallet, CreditCard, Loader2, AlertCircle, Gift, Star, Sparkles, ThumbsUp, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { wpayService } from '../services/wpayService';
import BottomNav from '../components/Layout/BottomNav';
import type { WalletTopupPackage } from '../types/database';

type PaymentMethod = 'card' | 'fpx' | 'grabpay' | 'tng';

const WalletTopup: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [packages, setPackages] = useState<WalletTopupPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<WalletTopupPackage | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('card');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // WPay profile preview
  const [wpayPreview, setWpayPreview] = useState<any>(null);
  const [, setLoadingPreview] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  // Load preview when package changes
  useEffect(() => {
    if (selectedPackage && user?.email) {
      loadWPayPreview(selectedPackage.amount);
    }
  }, [selectedPackage, user?.email]);

  const loadPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('wallet_topup_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPackages(data || []);

      const preSelectedAmount = (location.state as any)?.selectedAmount;
      if (data && data.length > 0) {
        if (preSelectedAmount) {
          const preSelected = data.find(pkg => pkg.amount === preSelectedAmount);
          setSelectedPackage(preSelected || data[0]);
        } else {
          setSelectedPackage(data[0]);
        }
      }
    } catch (err) {
      console.error('Error loading packages:', err);
      setError('Failed to load topup packages');
    } finally {
      setLoading(false);
    }
  };

  const loadWPayPreview = async (amount: number) => {
    if (!user?.email) return;

    setLoadingPreview(true);
    try {
      const result = await wpayService.getTopupPreview(user.email, amount);
      if (result.wpay_status === 'success') {
        setWpayPreview(result);
      }
    } catch (err) {
      console.error('[WPay] Failed to load preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleTopup = async () => {
    if (!selectedPackage || !user) {
      setError('Please select a package and ensure you are logged in');
      return;
    }

    if (!user.email) {
      setError('User email is required for payment');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      console.log('[WPay Topup] Starting top-up process');
      console.log('[WPay Topup] User:', { id: user.id, name: user.name, email: user.email });
      console.log('[WPay Topup] Package:', selectedPackage);
      console.log('[WPay Topup] Payment method:', selectedPayment);

      // Generate unique order ID
      const orderId = wpayService.generateOrderId('TOP');
      console.log('[WPay Topup] Generated order ID:', orderId);

      // Call WPay API to process payment
      const result = await wpayService.processPayment({
        email: user.email,
        payment_category: 'topup',
        payment_type: 'online',
        order_id: orderId,
        amount: selectedPackage.amount,
        payment_method: selectedPayment,
        customer_name: user.name,
        customer_phone: user.phone || '',
        product_name: `W-Balance Top-up RM${selectedPackage.amount}`,
        customer_country: user.country || 'MY',
        metadata: {
          package_id: selectedPackage.id,
          base_stars: selectedPackage.base_stars,
          extra_stars: selectedPackage.extra_stars,
          bonus_amount: selectedPackage.bonus_amount,
          user_id: user.id
        }
      });

      console.log('[WPay Topup] API Response:', result);

      if (result.wpay_status === 'pending' && result.payment_url && result.payment_data) {
        // Online payment - redirect to Fiuu
        console.log('[WPay Topup] Redirecting to payment gateway');
        await wpayService.submitPaymentForm(result.payment_url, result.payment_data);
      } else if (result.wpay_status === 'success') {
        // Immediate success (shouldn't happen for online, but handle it)
        console.log('[WPay Topup] Payment completed immediately');
        navigate('/wpay/callback?wpay_status=success&order_id=' + orderId);
      } else {
        // Error
        throw new Error(result.message || 'Payment failed');
      }

    } catch (err) {
      console.error('[WPay Topup] Error:', err);
      let errorMessage = 'Failed to process top-up';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setProcessing(false);
    }
  };

  const paymentMethods = [
    { id: 'card', name: 'Credit/Debit Card', icon: '💳' },
    { id: 'fpx', name: 'Online Banking', icon: '🏦' },
    { id: 'grabpay', name: 'GrabPay', icon: '🟢' },
    { id: 'tng', name: 'Touch n Go', icon: '🔵' },
  ];

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'text-amber-700',
      silver: 'text-gray-500',
      gold: 'text-yellow-500',
      platinum: 'text-blue-400',
      vip: 'text-red-600',
    };
    return colors[tier] || colors.bronze;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 pt-4 bg-gradient-to-b from-primary-50 to-white">
      {/* Custom Header */}
      <div className="glass border-b border-white/20 backdrop-blur-2xl fixed top-0 left-0 right-0 z-50 max-w-md mx-auto">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/wallet')}
            className="p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Top Up W Balance</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 mt-16">
        {/* WPay Profile Preview */}
        {wpayPreview?.profile && (
          <div className="glass-strong rounded-3xl p-4 bg-gradient-to-r from-primary-50 to-purple-50 border-2 border-primary-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className={`w-5 h-5 ${getTierColor(wpayPreview.profile.tier_type)}`} />
                <span className="font-bold text-gray-800 capitalize">{wpayPreview.profile.tier_type} Member</span>
              </div>
              <div className="text-xs text-gray-600">
                {wpayPreview.profile.tier_factor}x Stars
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-white/60 rounded-xl p-2">
                <div className="text-gray-600 text-xs">W-Balance</div>
                <div className="font-bold text-primary-600">RM{wpayPreview.profile.wbalance.toFixed(2)}</div>
              </div>
              <div className="bg-white/60 rounded-xl p-2">
                <div className="text-gray-600 text-xs">Bonus</div>
                <div className="font-bold text-orange-600">RM{wpayPreview.profile.bonus.toFixed(2)}</div>
              </div>
              <div className="bg-white/60 rounded-xl p-2">
                <div className="text-gray-600 text-xs">Stars</div>
                <div className="font-bold text-yellow-600">{wpayPreview.profile.stars}</div>
              </div>
            </div>
          </div>
        )}

        {/* Package Selection */}
        <div className="glass-strong rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Select Amount</h2>
              <p className="text-sm text-gray-600">Choose your W Balance top-up package</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {packages.map((pkg) => {
              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${selectedPackage?.id === pkg.id
                    ? 'border-primary-500 bg-primary-50 shadow-lg scale-105'
                    : 'border-gray-200 bg-white hover:border-primary-300'
                    }`}
                >
                  {pkg.bonus_amount > 0 && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center gap-0.5 px-2 py-0.5 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-full text-[10px] font-black shadow-lg">
                        <Gift className="w-3 h-3" />
                        RM{pkg.bonus_amount}
                      </div>
                    </div>
                  )}
                  {pkg.is_recommended && (
                    <div className="absolute top-2 left-2 animate-bounce">
                      <div className="flex items-center gap-0.5 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-[10px] font-black shadow-lg">
                        <ThumbsUp className="w-3 h-3" />
                      </div>
                    </div>
                  )}
                  <div className="text-2xl font-black text-gray-900 mt-2">
                    RM{pkg.amount.toFixed(0)}
                  </div>
                  <div className="space-y-0.5 mt-2">
                    <div className="flex items-center justify-center gap-1 text-xs text-gray-700 font-bold">
                      <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
                      Earn {pkg.base_stars} stars
                    </div>
                    {pkg.extra_stars > 0 ? (
                      <div className="flex items-center justify-center gap-1 text-xs text-purple-600 font-bold">
                        <Star className="w-3 h-3" fill="currentColor" />
                        Extra {pkg.extra_stars} stars
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 font-medium">
                        No bonus
                      </div>
                    )}
                    {pkg.bonus_amount > 0 && (
                      <div className="flex items-center justify-center gap-1 text-xs text-orange-600 font-bold">
                        <Gift className="w-3 h-3" />
                        Get RM{pkg.bonus_amount} Bonus
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Method */}
        <div className="glass-strong rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Payment Method</h2>
              <p className="text-sm text-gray-600">Select your payment option</p>
            </div>
          </div>

          <div className="space-y-2">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedPayment(method.id as PaymentMethod)}
                className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${selectedPayment === method.id
                  ? 'border-primary-500 bg-primary-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:border-primary-300'
                  }`}
              >
                <span className="text-2xl">{method.icon}</span>
                <span className="font-bold text-gray-900">{method.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {selectedPackage && (
          <div className="glass-strong rounded-3xl p-6 space-y-4">
            <h3 className="font-black text-gray-900 mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Top-up Amount</span>
                <span className="font-bold text-gray-900">RM{selectedPackage.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Base Stars</span>
                <span className="font-bold text-gray-900">{selectedPackage.base_stars} stars</span>
              </div>
              {selectedPackage.extra_stars > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Bonus Stars</span>
                  <span className="font-bold text-purple-600">+{selectedPackage.extra_stars} stars</span>
                </div>
              )}
              {selectedPackage.bonus_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Bonus Reward</span>
                  <span className="font-bold text-orange-600">RM{selectedPackage.bonus_amount} Bonus</span>
                </div>
              )}

              {/* WPay Preview Section */}
              {wpayPreview?.preview && (
                <>
                  <div className="border-t border-gray-200 pt-2 mt-2"></div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">WPay Stars (with {wpayPreview.profile.tier_factor}x multiplier)</span>
                    <span className="font-bold text-yellow-600">+{wpayPreview.preview.stars_to_award} stars</span>
                  </div>
                  {wpayPreview.preview.bonus_to_award > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">WPay Tier Bonus</span>
                      <span className="font-bold text-green-600">+RM{wpayPreview.preview.bonus_to_award.toFixed(2)}</span>
                    </div>
                  )}
                  {wpayPreview.preview.tier_upgrade && (
                    <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-3 mt-2">
                      <div className="flex items-center gap-2 text-purple-700">
                        <Trophy className="w-5 h-5" />
                        <span className="font-bold text-sm">
                          🎉 You'll upgrade to {wpayPreview.preview.new_tier.toUpperCase()}!
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between text-lg">
                  <span className="font-black text-gray-900">Total Payment</span>
                  <span className="font-black text-primary-600">RM{selectedPackage.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {(selectedPackage.extra_stars > 0 || selectedPackage.bonus_amount > 0) && (
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <Sparkles className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-orange-900 text-sm mb-1">Your Rewards</h4>
                    <ul className="space-y-1 text-xs text-orange-800">
                      {selectedPackage.extra_stars > 0 && (
                        <li className="flex items-center gap-2">
                          <Star className="w-3 h-3 flex-shrink-0" fill="currentColor" />
                          <span className="font-semibold">Total Stars Earned: {selectedPackage.base_stars + selectedPackage.extra_stars} stars</span>
                        </li>
                      )}
                      {selectedPackage.bonus_amount > 0 && (
                        <li className="flex items-center gap-2">
                          <Gift className="w-3 h-3 flex-shrink-0" />
                          <span className="font-semibold">Get RM{selectedPackage.bonus_amount} Bonus (use as discount)</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="glass-strong rounded-2xl p-4 bg-red-50 border-2 border-red-200">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900 text-sm">Payment Error</p>
                <p className="text-red-700 text-xs mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleTopup}
          disabled={!selectedPackage || processing}
          className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-black text-lg shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </span>
          ) : (
            `Pay RM${selectedPackage?.amount.toFixed(2) || '0.00'}`
          )}
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default WalletTopup;
