import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Wallet, CreditCard, Loader2, AlertCircle, Gift, Ticket, Star, Sparkles, ThumbsUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { fiuuService } from '../services/fiuuService';
import PageHeader from '../components/Layout/PageHeader';
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

  useEffect(() => {
    loadPackages();
  }, []);

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

  const handleTopup = async () => {
    if (!selectedPackage || !user) {
      setError('Please select a package and ensure you are logged in');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      console.log('[Topup] Starting top-up process');
      console.log('[Topup] User:', { id: user.id, name: user.name, email: user.email });
      console.log('[Topup] Package:', selectedPackage);
      console.log('[Topup] Payment method:', selectedPayment);

      // Generate order number with TU- prefix for topup orders
      const orderNumber = `TU-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      console.log('[Topup] Generated order_number:', orderNumber);

      console.log('[Topup] Step 1: Creating shop order for W Balance top-up');
      const { data: shopOrder, error: orderError } = await supabase
        .from('shop_orders')
        .insert({
          user_id: user.id,
          outlet_id: null,
          order_number: orderNumber,
          items: [{
            name: `W Balance Top-up RM${selectedPackage.amount}`,
            quantity: 1,
            price: selectedPackage.amount,
            base_stars: selectedPackage.base_stars,
            extra_stars: selectedPackage.extra_stars
          }],
          subtotal: selectedPackage.amount,
          total_amount: selectedPackage.amount,
          payment_method: selectedPayment,
          payment_type: 'topup',
          status: 'waiting_payment',
          payment_status: 'pending',
          metadata: {
            is_topup: true,
            package_id: selectedPackage.id,
            base_stars: selectedPackage.base_stars,
            extra_stars: selectedPackage.extra_stars,
            bonus_amount: selectedPackage.bonus_amount
          }
        })
        .select()
        .single();

      if (orderError) {
        console.error('[Topup] Shop order creation failed:', orderError);
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      if (!shopOrder?.id) {
        console.error('[Topup] Order creation failed - no order returned:', shopOrder);
        throw new Error('Order creation failed');
      }

      // Verify order_number matches what we generated
      if (shopOrder.order_number !== orderNumber) {
        console.warn('[Topup] Order number mismatch - expected:', orderNumber, 'got:', shopOrder.order_number);
      }

      console.log('[Topup] Shop order created successfully:', {
        id: shopOrder.id,
        order_number: shopOrder.order_number || orderNumber
      });

      console.log('[Topup] Step 2: Creating wallet transaction');
      const { data: walletTx, error: walletError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'topup',
          amount: selectedPackage.amount,
          bonus_amount: selectedPackage.bonus_amount || 0,
          status: 'pending',
          description: `W Balance top-up ${orderNumber}`,
          metadata: {
            order_id: shopOrder.id,
            order_number: orderNumber,
            package_id: selectedPackage.id,
            base_stars: selectedPackage.base_stars,
            extra_stars: selectedPackage.extra_stars,
            bonus_amount: selectedPackage.bonus_amount,
            payment_method: selectedPayment
          }
        } as any)
        .select()
        .single();

      if (walletError) {
        console.error('[Topup] Wallet transaction creation failed:', walletError);
        throw new Error(`Failed to create wallet transaction: ${walletError.message}`);
      }

      console.log('[Topup] Wallet transaction created successfully:', walletTx.id);

      console.log('[Topup] Step 3: Creating payment transaction');
      const { data: paymentTx, error: paymentError } = await supabase
        .from('payment_transactions')
        .insert({
          order_id: orderNumber,
          user_id: user.id,
          amount: selectedPackage.amount,
          payment_method: selectedPayment,
          wallet_transaction_id: walletTx.id,
          status: 'pending',
          metadata: {
            shop_order_id: shopOrder.id,
            order_number: orderNumber,
            package_id: selectedPackage.id,
            base_stars: selectedPackage.base_stars,
            extra_stars: selectedPackage.extra_stars,
            bonus_amount: selectedPackage.bonus_amount
          }
        })
        .select()
        .single();

      if (paymentError) {
        console.error('[Topup] Payment transaction creation failed:', paymentError);
        throw new Error(`Failed to create payment transaction: ${paymentError.message}`);
      }

      console.log('[Topup] Payment transaction created successfully:', paymentTx.id);

      console.log('[Topup] Step 4a: Updating shop order with payment transaction');
      const { error: updateOrderError } = await supabase
        .from('shop_orders')
        .update({ payment_transaction_id: paymentTx.id })
        .eq('id', shopOrder.id);

      if (updateOrderError) {
        console.error('[Topup] Failed to update shop order:', updateOrderError);
      } else {
        console.log('[Topup] Shop order updated with payment transaction ID');
      }

      console.log('[Topup] Step 4b: Updating wallet transaction with payment transaction');
      const { error: updateWalletError } = await supabase
        .from('wallet_transactions')
        .update({ payment_transaction_id: paymentTx.id })
        .eq('id', walletTx.id);

      if (updateWalletError) {
        console.error('[Topup] Failed to update wallet transaction:', updateWalletError);
      } else {
        console.log('[Topup] Wallet transaction updated with payment transaction ID');
      }

      console.log('[Topup] Step 5: Initiating payment with Fiuu');
      const paymentMethod = fiuuService.mapPaymentMethodToFiuu(selectedPayment);
      console.log('[Topup] Mapped payment method:', paymentMethod);

      let paymentResponse;
      try {
        const initiatePaymentPromise = fiuuService.initiatePayment({
          customer_id: user.id,
          user_id: user.id,
          product_id: `TOPUP-${selectedPackage.amount}`,
          order_id: orderNumber, // ✅ FIXED: Use generated orderNumber instead of relying on database return
          shop_order_id: shopOrder.id, // ✅ CRITICAL: Pass shop_order_id so Laravel can update it
          wallet_transaction_id: walletTx.id,
          amount: selectedPackage.amount,
          payment_method: paymentMethod,
          customer_name: user.name,
          customer_email: user.email,
          customer_phone: user.phone || '',
          product_name: `W Balance Top-up RM${selectedPackage.amount} (${selectedPackage.base_stars + selectedPackage.extra_stars} stars)`,
          customer_country: user.country || 'MY'
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout - payment gateway is not responding')), 30000)
        );

        paymentResponse = await Promise.race([initiatePaymentPromise, timeoutPromise]);
        console.log('[Topup] Payment initiated successfully');
      } catch (initiateError) {
        console.error('[Topup] Failed to initiate payment:', initiateError);
        const errorMsg = initiateError instanceof Error ? initiateError.message : 'Failed to initialize payment';
        throw new Error(errorMsg);
      }

      if (!paymentResponse?.data?.payment_url || !paymentResponse?.data?.payment_data) {
        console.error('[Topup] Invalid payment response:', paymentResponse);
        throw new Error('Invalid payment response from provider. Please try again.');
      }

      console.log('[Topup] Updating transaction with payment URL');
      await supabase
        .from('payment_transactions')
        .update({
          fiuu_payment_url: paymentResponse.data.payment_url,
          fiuu_payment_data: paymentResponse.data.payment_data,
          status: 'processing'
        })
        .eq('id', paymentTx.id);

      console.log('[Topup] Redirecting to payment gateway');
      await new Promise(resolve => setTimeout(resolve, 1000));

      await fiuuService.submitPaymentForm(
        paymentResponse.data.payment_url,
        paymentResponse.data.payment_data
      );

    } catch (err) {
      console.error('[Topup] Fatal error in top-up process:', err);
      console.error('[Topup] Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        type: err instanceof Error ? err.constructor.name : typeof err
      });

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white pb-28">
      <PageHeader
        title="Top Up W Balance"
        leftIcon={<ArrowLeft />}
        onLeftClick={() => navigate('/wallet')}
      />

      <div className="max-w-md mx-auto p-4 space-y-6 mt-16">
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
