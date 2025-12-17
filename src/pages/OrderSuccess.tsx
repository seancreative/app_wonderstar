import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { CheckCircle, Star, QrCode, Calendar, Package } from 'lucide-react';
import { useStars } from '../hooks/useStars';
import { useAuth } from '../contexts/AuthContext';
import BonusSummary from '../components/BonusSummary';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import QRCodeDisplay from '../components/QRCodeDisplay';
import { supabase } from '../lib/supabase';
import { wpayService } from '../services/wpayService';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  stars_earned: number;
  qr_code: string;
  payment_method: string;
  items: any[];
  created_at: string;
  tier_discount_amount?: number;
  tier_discount_pct?: number;
  stamps_earned?: number;
}

const OrderSuccess: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams<{ orderId: string }>();
  const { currentTier } = useStars();
  const { user, reloadUser } = useAuth();

  const [order, setOrder] = useState<Order | null>(location.state?.order || null);
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(!location.state?.order);
  const [tierInfo, setTierInfo] = useState<{ type: string; multiplier: number } | null>(null);

  useEffect(() => {
    // If order is not in location state, fetch it from database
    if (!order && orderId) {
      fetchOrder();
    }
  }, [orderId, order]);

  // Fetch accurate stars and tier info from WPay backend
  useEffect(() => {
    const fetchWPayData = async () => {
      if (!order?.order_number || !user?.email) return;

      try {
        // Fetch transaction details if stars_earned is 0 or missing
        if (!order.stars_earned || order.stars_earned === 0) {
          console.log('[OrderSuccess] Fetching accurate stars from WPay API');
          const transactionResponse = await wpayService.getTransaction(order.order_number);

          if (transactionResponse.success && transactionResponse.data) {
            console.log('[OrderSuccess] WPay transaction data:', transactionResponse.data);
            setOrder(prev => prev ? {
              ...prev,
              stars_earned: transactionResponse.data.stars_awarded
            } : null);
          }
        }

        // Fetch latest tier info from WPay
        console.log('[OrderSuccess] Fetching tier info from WPay API');
        const profileResponse = await wpayService.getProfile(user.email);

        if (profileResponse.success && profileResponse.data) {
          console.log('[OrderSuccess] WPay profile data:', profileResponse.data);
          setTierInfo({
            type: profileResponse.data.tier_type,
            multiplier: profileResponse.data.tier_multiplier
          });

          // Reload user to update cached tier info
          await reloadUser();
        }
      } catch (error) {
        console.error('[OrderSuccess] Error fetching WPay data:', error);
        // Continue with existing data if WPay fails
      }
    };

    fetchWPayData();
  }, [order?.order_number, user?.email]);

  const fetchOrder = async () => {
    if (!orderId) return;

    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      if (data) {
        setOrder(data as Order);
      } else {
        navigate('/home');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      navigate('/home');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const getPaymentMethodName = (method: string) => {
    const methods: Record<string, string> = {
      wonderstars: 'W Balance',
      card: 'Credit/Debit Card',
      fpx: 'FPX Online Banking',
      grabpay: 'GrabPay',
      tng: 'Touch \'n Go eWallet',
      boost: 'Boost'
    };
    return methods[method] || method;
  };

  return (
    <div className="min-h-screen pb-28 bg-gradient-to-b from-green-50 via-primary-50 to-white">
      <PageHeader />

      <div className="max-w-md mx-auto px-4 pt-8 space-y-6">
        <div className="text-center animate-pop-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-4 animate-bounce-soft">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-sm text-gray-600">Your order has been confirmed</p>
        </div>

        <div className="glass p-5 rounded-2xl space-y-4 animate-slide-up">
          <div className="text-center space-y-1">
            <p className="text-xs text-gray-600">Order Number</p>
            <p className="text-xl font-black text-primary-600">{order.order_number}</p>
          </div>

          <div className="flex items-center justify-center gap-6 py-4 border-y border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-0.5">Total Paid</p>
              <p className="text-lg font-black text-gray-900">
                RM {order.total_amount.toFixed(2)}
              </p>
            </div>
            <div className="w-px h-10 bg-gray-200"></div>
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-0.5">Stars Earned</p>
              <div className="flex items-center justify-center gap-1">
                <Star className="w-4 h-4 text-primary-600" fill="currentColor" />
                <p className="text-lg font-black text-primary-600">
                  +{order.stars_earned}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Order Date</p>
                <p className="text-sm font-semibold text-gray-900">
                  {new Date(order.created_at).toLocaleDateString('en-MY', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Payment Method</p>
                <p className="text-sm font-semibold text-gray-900">
                  {getPaymentMethodName(order.payment_method)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <BonusSummary
          tierName={tierInfo?.type || currentTier?.name || 'Silver'}
          tierDiscountPct={order.tier_discount_pct || 0}
          tierDiscountAmount={order.tier_discount_amount || 0}
          tierMultiplier={tierInfo?.multiplier || currentTier?.earn_multiplier || 1}
          starsEarned={order.stars_earned}
          stampsEarned={order.stamps_earned || 0}
          hasVouchers={true}
        />

        <div className="glass p-5 rounded-2xl space-y-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="text-center space-y-1.5">
            <QrCode className="w-10 h-10 text-primary-600 mx-auto mb-1" />
            <h2 className="text-lg font-bold text-gray-900">Your QR Pass is Ready!</h2>
            <p className="text-sm text-gray-600">Show this at the counter for collection</p>
          </div>

          {showQR ? (
            <div className="space-y-3">
              <div className="bg-white p-5 rounded-xl border-3 border-primary-500">
                <QRCodeDisplay
                  value={order.qr_code}
                  size={240}
                  level="H"
                  showValue={true}
                  allowEnlarge={true}
                  className="w-full"
                />
              </div>

              <div className="p-3 bg-primary-50 rounded-xl">
                <p className="text-xs text-gray-700 text-center">
                  Valid for collection at selected Wonderpark outlet
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowQR(true)}
              className="w-full py-3 gradient-primary text-white rounded-xl font-bold text-base hover:scale-105 active:scale-95 transition-transform"
            >
              View QR Code
            </button>
          )}
        </div>

        <div className="glass p-4 rounded-2xl space-y-3 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h3 className="font-bold text-gray-900 text-base">Order Items</h3>
          <div className="space-y-2">
            {(order.items || []).map((item: any, index: number) => (
              <div key={index} className="flex justify-between items-start p-3 bg-white rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.product_name}</p>
                  <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  RM {(item.total_price || item.total || (item.unit_price * item.quantity)).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-2xl animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <h4 className="font-bold text-gray-900 text-sm mb-2">Important Notes</h4>
          <ul className="space-y-1.5 text-xs text-gray-600">
            <li className="flex items-start gap-1.5">
              <span className="text-primary-600 font-bold">•</span>
              <span>Please arrive 15 minutes before your scheduled time</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary-600 font-bold">•</span>
              <span>Present QR code at the counter for verification</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary-600 font-bold">•</span>
              <span>For workshop bookings, please arrive on time</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary-600 font-bold">•</span>
              <span>Your stars have been credited to your account</span>
            </li>
          </ul>
        </div>

      </div>

      <BottomNav />
    </div>
  );
};

export default OrderSuccess;
