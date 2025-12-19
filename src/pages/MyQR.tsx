import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { QrCode, Calendar, CheckCircle, Gift, ShoppingBag, MapPin, AlertCircle, ChevronDown, Receipt, Wallet, Package } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import StaffRedemptionModal from '../components/StaffRedemptionModal';
import SimpleRedemptionModal from '../components/SimpleRedemptionModal';
import QRCodeDisplay from '../components/QRCodeDisplay';
import ReceiptModal from '../components/ReceiptModal';
import OrderReadyToast from '../components/OrderReadyToast';
import { notificationSound } from '../utils/notificationSound';
import { Notification } from '../types/database';

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  metadata?: any;
}

interface ItemRedemption {
  id: string;
  item_index: number;
  product_name: string;
  quantity: number;
  redeemed_quantity: number;
  status: 'pending' | 'completed';
  redeemed_at: string | null;
}

interface QRCodeItem {
  id: string;
  type: 'stamp_redemption' | 'order' | 'check_in' | 'gift_redemption' | 'wallet_topup';
  qrCode: string;
  title: string;
  description: string;
  status: 'active' | 'partial' | 'completed' | 'expired';
  expiresAt: string | null;
  metadata?: any;
  items?: OrderItem[];
  redemptions?: ItemRedemption[];
  outlet_id?: string;
  outlet_name?: string;
  outlet_location?: string;
  created_at?: string;
  amount?: number;
  payment_method?: string;
}

type TabType = 'latest' | 'pending' | 'completed';

const MyQR: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQR, setSelectedQR] = useState<QRCodeItem | null>(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showSimpleStaffModal, setShowSimpleStaffModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('latest');
  const [latestExpanded, setLatestExpanded] = useState(3);
  const [pendingExpanded, setPendingExpanded] = useState(3);
  const [completedExpanded, setCompletedExpanded] = useState(3);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [readyNotification, setReadyNotification] = useState<{
    collectionNumber: string;
    orderNumber: string;
    outletName?: string;
    orderId: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      loadQRCodes();
    }
  }, [user]);

  // Auto-refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        console.log('[MyQR] Page visible, refreshing QR codes');
        loadQRCodes();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Subscribe to order ready notifications
  useEffect(() => {
    if (!user) return;

    console.log('[MyQR] Setting up notification subscription for user:', user.id);

    const channel = supabase
      .channel('order_ready_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new as Notification;

          if (notification.notification_type === 'order_ready') {
            console.log('[MyQR] Received order ready notification:', notification);

            const message = notification.message || '';
            const collectionNumberMatch = message.match(/#(\d{4})/);
            const outletMatch = message.match(/at (.+)$/);

            const collectionNumber = collectionNumberMatch ? collectionNumberMatch[1] : '0000';
            const outletName = outletMatch ? outletMatch[1] : 'WonderStars';

            setReadyNotification({
              collectionNumber,
              orderNumber: collectionNumber,
              outletName,
              orderId: ''
            });

            notificationSound.playSuccess();

            setTimeout(() => {
              loadQRCodes();
            }, 500);

            setTimeout(() => {
              setReadyNotification(null);
            }, 15000);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[MyQR] Cleaning up notification subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadQRCodes = async () => {
    if (!user) return;

    try {
      const [stampRedemptionsResult, giftRedemptionsResult, ordersResult, walletTopupsResult] = await Promise.all([
        supabase
          .from('stamps_redemptions')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['pending', 'used'])
          .order('redeemed_at', { ascending: false })
          .limit(50),
        supabase
          .from('redemptions')
          .select('*, rewards(name, category, description)')
          .eq('user_id', user.id)
          .order('redeemed_at', { ascending: false })
          .limit(50),
        supabase
          .from('shop_orders')
          .select('*, outlets(name, location), payment_method')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('transaction_type', 'topup')
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const codes: QRCodeItem[] = [];

      if (giftRedemptionsResult.data) {
        giftRedemptionsResult.data.forEach((redemption: any) => {
          const reward = redemption.rewards;
          const categoryEmoji = {
            entry: '🎟️',
            toys: '🎁',
            merch: '👕',
            vip: '👑'
          }[reward?.category || 'toys'] || '🎁';

          codes.push({
            id: redemption.id,
            type: 'gift_redemption',
            qrCode: redemption.qr_code,
            title: `${categoryEmoji} ${reward?.name || 'Gift Reward'}`,
            description: reward?.description || 'Free gift',
            status: redemption.used_at ? 'completed' : 'active',
            expiresAt: null,
            metadata: {
              stars_cost: redemption.stars_cost,
              reward_name: reward?.name,
              category: reward?.category,
              is_gift: true,
              used_at: redemption.used_at
            },
            items: [{
              product_id: redemption.reward_id,
              product_name: reward?.name || 'Gift Reward',
              quantity: 1,
              unit_price: 0,
              total: 0,
              metadata: { stars_cost: redemption.stars_cost }
            }],
            redemptions: [{
              id: redemption.id,
              item_index: 0,
              product_name: reward?.name || 'Gift Reward',
              quantity: 1,
              redeemed_quantity: redemption.used_at ? 1 : 0,
              status: redemption.used_at ? 'completed' : 'pending',
              redeemed_at: redemption.used_at
            }],
            outlet_id: undefined,
            outlet_name: 'Gift Reward',
            outlet_location: '',
            created_at: redemption.redeemed_at
          });
        });
      }

      if (stampRedemptionsResult.data) {
        stampRedemptionsResult.data.forEach((redemption) => {
          const isExpired = redemption.expires_at && new Date(redemption.expires_at) < new Date();
          const rewardName = redemption.redemption_type === 'ice_cream' ? 'Ice Cream' : 'Ramen';
          codes.push({
            id: redemption.id,
            type: 'stamp_redemption',
            qrCode: redemption.qr_code,
            title: redemption.redemption_type === 'ice_cream' ? '🍦 Ice Cream Reward' : '🍜 Ramen Reward',
            description: redemption.flavor_selection || 'Free reward',
            status: isExpired ? 'expired' : redemption.status === 'used' ? 'completed' : 'active',
            expiresAt: redemption.expires_at,
            metadata: {
              stamps_spent: redemption.stamps_spent,
              redemption_type: redemption.redemption_type,
              used_at: redemption.status === 'used' ? redemption.used_at : null
            },
            items: [{
              product_id: redemption.id,
              product_name: `Free ${rewardName} - ${redemption.flavor_selection || 'Delicious'}`,
              quantity: 1,
              unit_price: 0,
              total: 0,
              metadata: { flavor: redemption.flavor_selection, stamps_spent: redemption.stamps_spent }
            }],
            redemptions: [{
              id: redemption.id,
              item_index: 0,
              product_name: `Free ${rewardName} - ${redemption.flavor_selection || 'Delicious'}`,
              quantity: 1,
              redeemed_quantity: redemption.status === 'used' ? 1 : 0,
              status: redemption.status === 'used' ? 'completed' : 'pending',
              redeemed_at: redemption.status === 'used' ? redemption.used_at : null
            }],
            outlet_id: undefined,
            outlet_name: 'Stamp Reward',
            outlet_location: '',
            created_at: redemption.redeemed_at
          });
        });
      }

      if (walletTopupsResult.data) {
        walletTopupsResult.data.forEach((topup: any) => {
          codes.push({
            id: topup.id,
            type: 'wallet_topup',
            qrCode: '',
            title: `💰 Wallet Top-up`,
            description: `RM${topup.amount.toFixed(2)} added to wallet`,
            status: 'completed',
            expiresAt: null,
            metadata: {
              ...topup.metadata,
              transaction_id: topup.id,
              bonus_amount: topup.bonus_amount || 0
            },
            items: [],
            redemptions: [],
            outlet_id: undefined,
            outlet_name: 'W Balance',
            outlet_location: '',
            created_at: topup.created_at,
            amount: topup.amount,
            payment_method: topup.metadata?.payment_method || 'card'
          });
        });
      }

      if (ordersResult.data) {
        for (const order of ordersResult.data) {
          // Skip orders without QR codes (payment not completed)
          if (!order.qr_code) {
            console.log('[MyQR] Skipping order without QR code:', order.order_number, 'Status:', order.status);
            continue;
          }

          const outletName = order.outlets?.name || 'WonderStars';
          const outletLocation = order.outlets?.location || '';

          const { data: redemptions } = await supabase
            .from('order_item_redemptions')
            .select('*')
            .eq('order_id', order.id)
            .order('item_index');

          const totalItems = order.items?.length || 0;
          const redeemedItems = redemptions?.filter((r: any) => r.status === 'completed').length || 0;

          let orderStatus: 'active' | 'partial' | 'completed' = 'active';
          if (redeemedItems === totalItems && totalItems > 0) {
            orderStatus = 'completed';
          } else if (redeemedItems > 0) {
            orderStatus = 'partial';
          }

          codes.push({
            id: order.id,
            type: 'order',
            qrCode: order.qr_code,
            title: `Order #${order.order_number || order.id.slice(0, 8)}`,
            description: `RM${order.total_amount.toFixed(2)} • ${totalItems} item${totalItems !== 1 ? 's' : ''}`,
            status: orderStatus,
            expiresAt: null,
            metadata: {
              outlet_name: outletName,
              total: order.total_amount,
              order_number: order.order_number,
              fnbstatus: (order as any).fnbstatus
            },
            items: order.items || [],
            redemptions: redemptions || [],
            outlet_id: order.outlet_id,
            outlet_name: outletName,
            outlet_location: outletLocation,
            created_at: order.created_at,
            payment_method: order.payment_method
          });
        }
      }

      // Sort all items by created_at timestamp (newest first)
      const sortedCodes = codes.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setQrCodes(sortedCodes);
    } catch (error) {
      console.error('Error loading QR codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQRClick = (qr: QRCodeItem) => {
    setSelectedQR(qr);
  };

  const handleStaffScanClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedQR?.type === 'gift_redemption' || selectedQR?.type === 'stamp_redemption') {
      setShowSimpleStaffModal(true);
    } else {
      setShowStaffModal(true);
    }
  };

  const handleRedemptionSuccess = async () => {
    setShowStaffModal(false);
    setShowSimpleStaffModal(false);
    await loadQRCodes();
    setSelectedQR(null);
  };

  const getStatusBadge = (status: string, redeemedCount?: number, totalCount?: number) => {
    switch (status) {
      case 'active':
        return (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700">
            {redeemedCount || 0}/{totalCount || 0} redeemed
          </span>
        );
      case 'partial':
        return (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700">
            {redeemedCount}/{totalCount} redeemed
          </span>
        );
      case 'completed':
        return (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">
            Fully redeemed
          </span>
        );
      case 'expired':
        return (
          <span className="text-xs font-semibold text-gray-500">
            Expired
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'border-l-4 border-l-red-500 bg-white';
      case 'partial':
        return 'border-l-4 border-l-blue-500 bg-white';
      case 'completed':
        return 'border-l-4 border-l-green-500 bg-white';
      case 'expired':
        return 'border-l-4 border-l-gray-400 bg-white';
      default:
        return 'border-l-4 border-l-gray-300 bg-white';
    }
  };

  const getDisplayId = (qr: QRCodeItem): string => {
    if (qr.type === 'order') {
      return `Order: #${qr.metadata?.order_number || qr.id.slice(0, 8)}`;
    } else if (qr.type === 'wallet_topup') {
      return `TXN-${qr.id.slice(0, 8).toUpperCase()}`;
    } else if (qr.type === 'gift_redemption') {
      return `RDM-${qr.id.slice(-8).toUpperCase()}`;
    } else if (qr.type === 'stamp_redemption') {
      return `RDM-${qr.id.slice(-8).toUpperCase()}`;
    }
    return qr.id.slice(0, 8).toUpperCase();
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getPaymentMethodLabel = (method: string): string => {
    const methods: Record<string, string> = {
      wonderstars: 'W Balance',
      card: 'Card',
      fpx: 'FPX Banking',
      grabpay: 'GrabPay',
      tng: 'Touch \'n Go',
      boost: 'Boost'
    };
    return methods[method] || method;
  };

  const shouldShowReceipt = (qr: QRCodeItem): boolean => {
    return qr.type === 'order' || qr.type === 'wallet_topup';
  };

  const latestOrders = qrCodes.slice(0, latestExpanded);
  const pendingOrders = qrCodes.filter(qr => qr.status === 'active' || qr.status === 'partial').slice(0, pendingExpanded);
  const completedOrders = qrCodes.filter(qr => qr.status === 'completed' || qr.status === 'expired').slice(0, completedExpanded);

  const renderQRCard = (qr: QRCodeItem) => {
    const redeemedCount = qr.redemptions?.filter(r => r.status === 'completed').length || 0;
    const totalCount = qr.items?.length || 0;

    const getCategoryLabel = () => {
      if (qr.type === 'stamp_redemption') return 'Stamp Reward';
      if (qr.type === 'gift_redemption') return 'Gift Reward';
      if (qr.type === 'wallet_topup') return 'Wallet Top-up';
      return 'Purchased';
    };

    const getStoreLabel = () => {
      if (qr.type === 'stamp_redemption' || qr.type === 'gift_redemption') {
        return 'Any Store';
      }
      if (qr.type === 'wallet_topup') {
        return 'W Balance';
      }
      return qr.outlet_name || 'Any Store';
    };

    return (
      <div
        key={qr.id}
        className={`w-full rounded-xl border-r border-t border-b ${getStatusColor(qr.status)}`}
      >
        <button
          onClick={() => handleQRClick(qr)}
          className="w-full p-3 hover:bg-gray-50 transition-all"
        >
          <div className="flex items-start gap-2.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              qr.type === 'gift_redemption'
                ? 'bg-pink-50'
                : qr.type === 'stamp_redemption'
                ? 'bg-amber-50'
                : qr.type === 'wallet_topup'
                ? 'bg-green-50'
                : 'bg-blue-50'
            }`}>
              {qr.type === 'gift_redemption' ? (
                <Gift className="w-5 h-5 text-pink-600" />
              ) : qr.type === 'stamp_redemption' ? (
                <Gift className="w-5 h-5 text-amber-600" />
              ) : qr.type === 'wallet_topup' ? (
                <Wallet className="w-5 h-5 text-green-600" />
              ) : (
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              )}
            </div>

            <div className="flex-1 min-w-0 text-left space-y-1.5">
              <div>
                <h3 className="font-bold text-gray-900 text-sm leading-tight">{qr.title}</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{getDisplayId(qr)}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">{getCategoryLabel()}</span>
                <span className="text-gray-300">•</span>
                {getStatusBadge(qr.status, redeemedCount, totalCount)}
                {qr.type === 'order' && qr.metadata?.fnbstatus === 'ready' && (
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-500 text-white animate-bounce flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    Ready to Collect!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Calendar className="w-3 h-3 text-gray-400" />
                <span>{formatDateTime(qr.created_at!)}</span>
                <span className="text-gray-300">•</span>
                <MapPin className="w-3 h-3 text-gray-400" />
                <span>{getStoreLabel()}</span>
              </div>

              {qr.payment_method && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                    Paid via {getPaymentMethodLabel(qr.payment_method)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </button>

        {shouldShowReceipt(qr) && (
          <div className="px-3 pb-3 pt-2 border-t border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (qr.type === 'wallet_topup') {
                  const orderNumber = qr.metadata?.order_number;
                  if (orderNumber) {
                    console.log('[MyQR] Finding shop_order for topup:', orderNumber);
                    supabase
                      .from('shop_orders')
                      .select('id')
                      .eq('order_number', orderNumber)
                      .single()
                      .then(({ data }) => {
                        if (data) {
                          setReceiptOrderId(data.id);
                          setShowReceiptModal(true);
                        }
                      });
                  }
                } else {
                  console.log('[MyQR] Opening receipt for order:', {
                    id: qr.id,
                    title: qr.title,
                    type: qr.type,
                    metadata: qr.metadata
                  });
                  setReceiptOrderId(qr.id);
                  setShowReceiptModal(true);
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-xs"
            >
              <Receipt className="w-3.5 h-3.5" />
              View Receipt
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-28 flex items-center justify-center bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600">
        <div className="text-center space-y-6">
          <div className="relative w-32 h-32 mx-auto">
            <div className="absolute inset-0 bg-white rounded-3xl animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <QrCode className="w-16 h-16 text-purple-600 animate-bounce" strokeWidth={2.5} />
            </div>
            <div className="absolute -inset-4 border-4 border-white/30 rounded-3xl animate-ping"></div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white animate-pulse">Fetching MyQR</h2>
            <div className="flex items-center justify-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pb-28 flex items-center justify-center">
        <div className="text-center space-y-4 p-6">
          <AlertCircle className="w-16 h-16 text-orange-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Not Logged In</h2>
          <p className="text-gray-600">Please log in to view your orders.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 pt-20">
      <PageHeader />

      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-3">
            <QrCode className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black theme-text-primary">My QR Codes</h1>
          <p className="theme-text-secondary font-medium text-sm mt-1">Show at WonderStars to redeem</p>
        </div>

        <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-2xl">
          <button
            onClick={() => setActiveTab('latest')}
            className={`py-2.5 px-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'latest'
                ? 'bg-white text-purple-600 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Latest
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-2.5 px-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'pending'
                ? 'bg-white text-orange-600 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`py-2.5 px-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'completed'
                ? 'bg-white text-green-600 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Completed
          </button>
        </div>

        {activeTab === 'latest' && (
          <div className="space-y-3">
            {latestOrders.length === 0 ? (
              <div className="glass p-6 rounded-2xl text-center">
                <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No orders yet</p>
              </div>
            ) : (
              <>
                {latestOrders.map(renderQRCard)}
                {qrCodes.length > latestExpanded && (
                  <button
                    onClick={() => setLatestExpanded(prev => prev + 3)}
                    className="w-full py-3 glass rounded-xl font-bold text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Show More</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-3">
            {pendingOrders.length === 0 ? (
              <div className="glass p-6 rounded-2xl text-center">
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No pending orders</p>
              </div>
            ) : (
              <>
                {pendingOrders.map(renderQRCard)}
                {qrCodes.filter(qr => qr.status === 'active' || qr.status === 'partial').length > pendingExpanded && (
                  <button
                    onClick={() => setPendingExpanded(prev => prev + 3)}
                    className="w-full py-3 glass rounded-xl font-bold text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Show More</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="space-y-3">
            {completedOrders.length === 0 ? (
              <div className="glass p-6 rounded-2xl text-center">
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No completed orders</p>
              </div>
            ) : (
              <>
                {completedOrders.map(renderQRCard)}
                {qrCodes.filter(qr => qr.status === 'completed' || qr.status === 'expired').length > completedExpanded && (
                  <button
                    onClick={() => setCompletedExpanded(prev => prev + 3)}
                    className="w-full py-3 glass rounded-xl font-bold text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Show More</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {selectedQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
          onClick={() => setSelectedQR(null)}
        >
          <div
            className="glass p-6 rounded-3xl max-w-md w-full shadow-2xl animate-scale-in my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black theme-text-primary">{selectedQR.title}</h2>
                {getStatusBadge(
                  selectedQR.status,
                  selectedQR.redemptions?.filter(r => r.status === 'completed').length,
                  selectedQR.items?.length
                )}
              </div>

              {selectedQR.type === 'order' && selectedQR.metadata?.fnbstatus === 'ready' && (
                <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 rounded-2xl shadow-lg animate-pulse">
                  <div className="flex items-center justify-center gap-2 text-white">
                    <Package className="w-6 h-6 animate-bounce" />
                    <div className="text-center">
                      <p className="text-lg font-black">Ready to Collect!</p>
                      <p className="text-xs opacity-90">Show your QR code at the counter</p>
                    </div>
                    <Package className="w-6 h-6 animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              )}

              {selectedQR.type === 'wallet_topup' ? (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border-2 border-green-200">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
                      <Wallet className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="text-center space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-green-700 mb-1">Amount Topped Up</p>
                      <p className="text-3xl font-black text-green-900">RM {selectedQR.amount?.toFixed(2)}</p>
                    </div>
                    {selectedQR.metadata?.bonus_amount > 0 && (
                      <div className="bg-white/70 rounded-xl p-3">
                        <p className="text-xs font-semibold text-green-700 mb-1">Bonus Received</p>
                        <p className="text-xl font-black text-green-900">+RM {selectedQR.metadata.bonus_amount.toFixed(2)}</p>
                      </div>
                    )}
                    {(selectedQR.metadata?.base_stars || selectedQR.metadata?.extra_stars) && (
                      <div className="bg-white/70 rounded-xl p-3">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Stars Earned</p>
                        <p className="text-xl font-black text-amber-900">
                          ⭐ {(selectedQR.metadata.base_stars || 0) + (selectedQR.metadata.extra_stars || 0)} Stars
                        </p>
                        {selectedQR.metadata.extra_stars > 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            ({selectedQR.metadata.base_stars} base + {selectedQR.metadata.extra_stars} bonus)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-5 rounded-2xl shadow-inner">
                  <QRCodeDisplay
                    value={selectedQR.qrCode}
                    size={256}
                    level="H"
                    showValue={true}
                    allowEnlarge={true}
                    className="w-full"
                  />
                  <p className="text-sm font-bold text-gray-700 text-center mt-3">{selectedQR.description}</p>
                </div>
              )}

              {selectedQR.items && selectedQR.items.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black theme-text-primary">
                      {selectedQR.type === 'gift_redemption' ? 'Gift Details' : selectedQR.type === 'stamp_redemption' ? 'Reward Details' : 'Order Items'}
                    </h3>
                    {/* {(selectedQR.status === 'active' || selectedQR.status === 'partial') && (
                      <button
                        onClick={handleStaffScanClick}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl text-xs font-bold hover:scale-105 transition-transform shadow-lg"
                      >
                        <QrCode className="w-4 h-4" />
                        Staff Scan
                      </button>
                    )} */}
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(selectedQR.items || []).map((item: OrderItem, itemIndex: number) => {
                      const redemption = selectedQR.redemptions?.find((r: ItemRedemption) => r.item_index === itemIndex);
                      const isRedeemed = redemption?.status === 'completed';

                      // Extract last 4 digits of order number for F&B items
                      const collectionNumber = selectedQR.type === 'order' && selectedQR.metadata?.order_number
                        ? selectedQR.metadata.order_number.slice(-4)
                        : null;

                      return (
                        <div
                          key={itemIndex}
                          className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                            isRedeemed ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-50 border-2 border-gray-200'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isRedeemed ? 'bg-green-500' : 'bg-gray-300'
                          }`}>
                            {isRedeemed && <CheckCircle className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold ${
                              isRedeemed ? 'text-green-900' : 'theme-text-primary'
                            }`}>
                              {item.product_name}
                            </p>
                            <p className="text-xs theme-text-secondary font-medium">
                              Qty: {item.quantity} • RM{(item.total_price || item.total || (item.unit_price * item.quantity)).toFixed(2)}
                            </p>
                            {isRedeemed && redemption?.redeemed_at && (
                              <p className="text-xs text-green-600 font-semibold mt-1">
                                Redeemed {new Date(redemption.redeemed_at).toLocaleString('en-MY', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                          {collectionNumber && (
                            <div className="flex flex-col items-center justify-center flex-shrink-0">
                              <p className="text-[10px] font-bold text-gray-500 leading-tight">Collection#</p>
                              <p className="text-lg font-black text-gray-900 leading-tight">{collectionNumber}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">Created</p>
                      <p className="text-xs text-gray-600 font-medium">
                        {new Date(selectedQR.created_at!).toLocaleString('en-MY', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-600" />
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-900">{selectedQR.outlet_name}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {shouldShowReceipt(selectedQR) && (
                  <button
                    onClick={() => {
                      if (selectedQR.type === 'wallet_topup') {
                        const orderNumber = selectedQR.metadata?.order_number;
                        if (orderNumber) {
                          supabase
                            .from('shop_orders')
                            .select('id')
                            .eq('order_number', orderNumber)
                            .single()
                            .then(({ data }) => {
                              if (data) {
                                setReceiptOrderId(data.id);
                                setShowReceiptModal(true);
                                setSelectedQR(null);
                              }
                            });
                        }
                      } else {
                        setReceiptOrderId(selectedQR.id);
                        setShowReceiptModal(true);
                        setSelectedQR(null);
                      }
                    }}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Receipt className="w-5 h-5" />
                    View Receipt
                  </button>
                )}
                <button
                  onClick={() => setSelectedQR(null)}
                  className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-black shadow-glow hover:scale-105 transition-transform"
                >
                  Close
                </button>
              </div>
            </div>

            {showStaffModal && selectedQR.type === 'order' && (
              <StaffRedemptionModal
                order={selectedQR}
                onClose={() => setShowStaffModal(false)}
                onSuccess={handleRedemptionSuccess}
              />
            )}
          </div>
        </div>
      )}

      {showSimpleStaffModal && selectedQR && (selectedQR.type === 'gift_redemption' || selectedQR.type === 'stamp_redemption') && (
        <SimpleRedemptionModal
          redemption={{
            id: selectedQR.id,
            type: selectedQR.type,
            qrCode: selectedQR.qrCode,
            title: selectedQR.title,
            outlet_id: selectedQR.outlet_id
          }}
          onClose={() => setShowSimpleStaffModal(false)}
          onSuccess={handleRedemptionSuccess}
        />
      )}

      {showReceiptModal && receiptOrderId && (
        <ReceiptModal
          orderId={receiptOrderId}
          onClose={() => {
            setShowReceiptModal(false);
            setReceiptOrderId(null);
          }}
        />
      )}

      {readyNotification && (
        <OrderReadyToast
          collectionNumber={readyNotification.collectionNumber}
          orderNumber={readyNotification.orderNumber}
          outletName={readyNotification.outletName}
          onClose={() => setReadyNotification(null)}
          onTap={() => {
            setReadyNotification(null);
            setActiveTab('pending');
          }}
        />
      )}
    </div>
  );
};

export default MyQR;
