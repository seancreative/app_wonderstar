import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { fiuuService } from '../services/fiuuService';
import { Copy, ChevronDown, ChevronUp, Bug, Minimize2, Maximize2 } from 'lucide-react';

interface PaymentDebugInfo {
  fiuuStatus: string | null;
  fulfillmentStatus: string | null;
  paymentStatus: string | null;
  lastOrderId: string | null;
  orderNumber: string | null;
  paymentTransactionId: string | null;
  walletTransactionId: string | null;
  userId: string | null;
  tranId: string | null;
  amount: string | null;
  paymentMethod: string | null;
  submitUrl: string | null;
  callbackParams: Record<string, string> | null;
  lastUpdated: string | null;
  smsUrl: string | null;
  smsPhone: string | null;
  smsStatus: string | null;
  smsMessage: string | null;
  smsTimestamp: string | null;
  emailResetEmail: string | null;
  emailResetRedirectTo: string | null;
  emailResetStatus: string | null;
  emailResetMessage: string | null;
  emailResetTimestamp: string | null;
  emailResetSupabaseUrl: string | null;
  emailAuthEvent: string | null;
}

const DebugBox: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [debugEnabled, setDebugEnabled] = useState(() => {
    return localStorage.getItem('debug_mode') === 'true';
  });
  const [paymentDebug, setPaymentDebug] = useState<PaymentDebugInfo>({
    fiuuStatus: null,
    fulfillmentStatus: null,
    paymentStatus: null,
    lastOrderId: null,
    orderNumber: null,
    paymentTransactionId: null,
    walletTransactionId: null,
    userId: null,
    tranId: null,
    amount: null,
    paymentMethod: null,
    submitUrl: null,
    callbackParams: null,
    lastUpdated: null,
    smsUrl: null,
    smsPhone: null,
    smsStatus: null,
    smsMessage: null,
    smsTimestamp: null,
    emailResetEmail: null,
    emailResetRedirectTo: null,
    emailResetStatus: null,
    emailResetMessage: null,
    emailResetTimestamp: null,
    emailResetSupabaseUrl: null,
    emailAuthEvent: null
  });
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Log on mount
  useEffect(() => {
    console.log('[DebugBox] Component mounted, current path:', location.pathname);
    console.log('[DebugBox] Current paymentDebug state:', paymentDebug);
  }, []);

  // Listen for debug mode changes
  useEffect(() => {
    const handleDebugModeChange = () => {
      setDebugEnabled(localStorage.getItem('debug_mode') === 'true');
    };

    window.addEventListener('debug-mode-changed', handleDebugModeChange);
    return () => {
      window.removeEventListener('debug-mode-changed', handleDebugModeChange);
    };
  }, []);

  // Track payment callback data
  useEffect(() => {
    if (location.pathname === '/payment/callback') {
      const status = searchParams.get('status');
      const orderId = searchParams.get('order_id');
      const shopOrderId = searchParams.get('shop_order_id');
      const walletTxId = searchParams.get('wallet_transaction_id');
      const userId = searchParams.get('user_id');
      const tranId = searchParams.get('tran_id');
      const amount = searchParams.get('amount');

      // Capture all URL parameters
      const allParams: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        allParams[key] = value;
      });

      console.log('[DebugBox] Captured callback data:', {
        status,
        orderId,
        shopOrderId,
        walletTxId,
        userId,
        tranId,
        amount,
        allParams
      });

      const callbackData = {
        status,
        order_id: orderId,
        shop_order_id: shopOrderId,
        wallet_transaction_id: walletTxId,
        user_id: userId,
        tran_id: tranId,
        amount,
        callback_params: allParams,
        timestamp: new Date().toISOString()
      };

      // Store in sessionStorage for persistence
      sessionStorage.setItem('payment_debug_data', JSON.stringify(callbackData));
      console.log('[DebugBox] Stored in sessionStorage:', callbackData);

      setPaymentDebug(prev => ({
        ...prev,
        fiuuStatus: status,
        lastOrderId: shopOrderId,
        paymentTransactionId: orderId,
        walletTransactionId: walletTxId,
        userId: userId,
        tranId: tranId,
        amount: amount,
        callbackParams: allParams,
        lastUpdated: new Date().toISOString()
      }));

      // Fetch detailed data
      if (shopOrderId) {
        fetchOrderDetails(shopOrderId);
      }
      if (orderId) {
        fetchPaymentTransactionDetails(orderId);
      }
    } else {
      // Try to restore from sessionStorage
      const stored = sessionStorage.getItem('payment_debug_data');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          console.log('[DebugBox] Restored from sessionStorage:', data);
          setPaymentDebug(prev => ({
            ...prev,
            fiuuStatus: data.status,
            lastOrderId: data.shop_order_id,
            paymentTransactionId: data.order_id,
            walletTransactionId: data.wallet_transaction_id,
            userId: data.user_id,
            tranId: data.tran_id,
            amount: data.amount,
            paymentMethod: data.payment_method,
            submitUrl: data.submit_url,
            callbackParams: data.callback_params,
            lastUpdated: data.timestamp
          }));

          if (data.shop_order_id) {
            fetchOrderDetails(data.shop_order_id);
          }
        } catch (e) {
          console.error('[DebugBox] Failed to parse payment debug data:', e);
        }
      } else {
        console.log('[DebugBox] No stored data found in sessionStorage');
      }
    }
  }, [location.pathname, searchParams]);

  // Poll for latest order status if we have order ID
  useEffect(() => {
    if (!paymentDebug.lastOrderId) return;

    const interval = setInterval(() => {
      fetchOrderDetails(paymentDebug.lastOrderId!);
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [paymentDebug.lastOrderId]);

  // Check for SMS debug data from sessionStorage
  useEffect(() => {
    const checkSMSDebugData = () => {
      const smsData = sessionStorage.getItem('sms_debug_data');
      if (smsData) {
        try {
          const data = JSON.parse(smsData);
          console.log('[DebugBox] SMS debug data found:', data);
          setPaymentDebug(prev => ({
            ...prev,
            smsUrl: data.url || null,
            smsPhone: data.phone || null,
            smsStatus: data.status || null,
            smsMessage: data.message || null,
            smsTimestamp: data.timestamp || null
          }));
        } catch (e) {
          console.error('[DebugBox] Failed to parse SMS debug data:', e);
        }
      }
    };

    checkSMSDebugData();
    const interval = setInterval(checkSMSDebugData, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check for Email debug data from sessionStorage
  useEffect(() => {
    const checkEmailDebugData = () => {
      const emailData = sessionStorage.getItem('email_debug_data');
      if (emailData) {
        try {
          const data = JSON.parse(emailData);
          console.log('[DebugBox] Email debug data found:', data);
          setPaymentDebug(prev => ({
            ...prev,
            emailResetEmail: data.email || null,
            emailResetRedirectTo: data.redirectTo || null,
            emailResetStatus: data.status || null,
            emailResetMessage: data.message || null,
            emailResetTimestamp: data.timestamp || null,
            emailResetSupabaseUrl: data.supabaseUrl || null,
            emailAuthEvent: data.authEvent || null
          }));
        } catch (e) {
          console.error('[DebugBox] Failed to parse email debug data:', e);
        }
      }
    };

    checkEmailDebugData();
    const interval = setInterval(checkEmailDebugData, 1000);
    return () => clearInterval(interval);
  }, []);

  // Monitor Supabase Auth events
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DebugBox] Auth event:', event);

      // Update email debug data with auth event
      if (event === 'PASSWORD_RECOVERY') {
        const emailData = sessionStorage.getItem('email_debug_data');
        if (emailData) {
          try {
            const data = JSON.parse(emailData);
            data.authEvent = event;
            sessionStorage.setItem('email_debug_data', JSON.stringify(data));

            setPaymentDebug(prev => ({
              ...prev,
              emailAuthEvent: event
            }));
          } catch (e) {
            console.error('[DebugBox] Failed to update auth event:', e);
          }
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('id, status, payment_status, order_number, wallet_transaction_id')
        .eq('id', orderId)
        .maybeSingle();

      if (data && !error) {
        setPaymentDebug(prev => ({
          ...prev,
          fulfillmentStatus: data.status,
          paymentStatus: data.payment_status,
          orderNumber: data.order_number,
          walletTransactionId: prev.walletTransactionId || data.wallet_transaction_id,
          lastUpdated: new Date().toISOString()
        }));

        // Update sessionStorage
        const stored = sessionStorage.getItem('payment_debug_data');
        if (stored) {
          const storedData = JSON.parse(stored);
          storedData.order_number = data.order_number;
          storedData.payment_status = data.payment_status;
          storedData.fulfillment_status = data.status;
          sessionStorage.setItem('payment_debug_data', JSON.stringify(storedData));
        }
      }
    } catch (err) {
      console.error('Failed to fetch order details:', err);
    }
  };

  const fetchPaymentTransactionDetails = async (orderId: string) => {
    try {
      const transaction = await fiuuService.getPaymentTransaction(orderId);
      if (transaction) {
        setPaymentDebug(prev => ({
          ...prev,
          paymentTransactionId: transaction.order_id || orderId,
          lastUpdated: new Date().toISOString()
        }));
      }
    } catch (err) {
      console.error('Failed to fetch payment transaction:', err);
    }
  };

  const clearDebugData = () => {
    sessionStorage.removeItem('payment_debug_data');
    sessionStorage.removeItem('sms_debug_data');
    sessionStorage.removeItem('email_debug_data');
    setPaymentDebug({
      fiuuStatus: null,
      fulfillmentStatus: null,
      paymentStatus: null,
      lastOrderId: null,
      orderNumber: null,
      paymentTransactionId: null,
      walletTransactionId: null,
      userId: null,
      tranId: null,
      amount: null,
      paymentMethod: null,
      submitUrl: null,
      callbackParams: null,
      lastUpdated: null,
      smsUrl: null,
      smsPhone: null,
      smsStatus: null,
      smsMessage: null,
      smsTimestamp: null,
      emailResetEmail: null,
      emailResetRedirectTo: null,
      emailResetStatus: null,
      emailResetMessage: null,
      emailResetTimestamp: null,
      emailResetSupabaseUrl: null,
      emailAuthEvent: null
    });
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getPageInfo = () => {
    const path = location.pathname;

    const routeMap: Record<string, string> = {
      '/': 'Welcome.tsx',
      '/welcome': 'Welcome.tsx',
      '/signup': 'Signup.tsx',
      '/login': 'Login.tsx',
      '/forgot-password': 'ForgotPassword.tsx',
      '/add-child': 'AddChild.tsx',
      '/home': 'Home.tsx',
      '/stars': 'Stars.tsx',
      '/missions': 'Missions.tsx',
      '/my-qr': 'MyQR.tsx',
      '/profile': 'Profile.tsx',
      '/wallet': 'Wallet.tsx',
      '/wallet/topup': 'WalletTopup.tsx',
      '/rewards': 'Rewards.tsx',
      '/check-in': 'CheckIn.tsx',
      '/workshops': 'Workshops.tsx',
      '/settings': 'Settings.tsx',
      '/shop': 'OutletSelection.tsx',
      '/shop/menu': 'ShopMenu.tsx',
      '/shop/cart': 'ShopCart.tsx',
      '/shop/checkout': 'ShopCheckout.tsx',
      '/order-success': 'OrderSuccess.tsx',
      '/payment/callback': 'PaymentCallback.tsx',
      '/cms/login': 'CMSLogin.tsx',
      '/cms/dashboard': 'CMSDashboard.tsx',
      '/cms/orders': 'CMSOrders.tsx',
      '/cms/products': 'CMSProducts.tsx',
      '/cms/categories': 'CMSCategories.tsx',
      '/cms/modifiers': 'CMSModifiers.tsx',
      '/cms/customers': 'CMSCustomers.tsx',
      '/cms/outlets': 'CMSOutlets.tsx',
      '/cms/staff': 'CMSStaff.tsx',
      '/cms/redemption-logs': 'CMSRedemptionLogs.tsx',
      '/cms/star-scanner': 'CMSStarScanner.tsx',
      '/cms/staff-scanner': 'StaffScanner.tsx',
      '/cms/financial': 'CMSFinancial.tsx',
      '/cms/rewards': 'CMSRewards.tsx',
      '/cms/workshops': 'CMSWorkshops.tsx',
      '/cms/marketing': 'CMSMarketing.tsx',
      '/cms/promo-sliders': 'CMSPromoSliders.tsx',
      '/cms/analytics': 'CMSAnalytics.tsx',
      '/cms/settings': 'CMSSettings.tsx',
      '/cms/ai-insights': 'CMSAIInsights.tsx',
      '/maintenance': 'Maintenance.tsx',
    };

    if (path.startsWith('/shop/product/')) {
      return 'ProductDetail.tsx';
    }

    return routeMap[path] || 'App.tsx';
  };

  const getStatusColor = (status: string | null, type: 'fiuu' | 'payment' | 'fulfillment') => {
    if (!status) return 'text-gray-500';

    const statusLower = status.toLowerCase();

    if (type === 'fiuu') {
      if (statusLower === 'success') return 'text-green-400';
      if (statusLower === 'failed') return 'text-red-400';
      if (statusLower === 'cancelled') return 'text-orange-400';
      return 'text-yellow-400';
    }

    if (type === 'payment') {
      if (statusLower === 'paid') return 'text-green-400';
      if (statusLower === 'failed') return 'text-red-400';
      if (statusLower === 'pending') return 'text-yellow-400';
      return 'text-gray-400';
    }

    if (type === 'fulfillment') {
      if (statusLower === 'completed') return 'text-green-400';
      if (statusLower === 'ready') return 'text-blue-400';
      if (statusLower === 'pending') return 'text-yellow-400';
      if (statusLower === 'cancelled') return 'text-red-400';
      return 'text-gray-400';
    }

    return 'text-gray-400';
  };

  // Hide debug box if debug mode is disabled
  if (!debugEnabled) {
    return null;
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 left-4 z-[9999] bg-gradient-to-br from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white rounded-full p-3 shadow-2xl pointer-events-auto transition-all duration-300 hover:scale-110 border-2 border-yellow-300 animate-pulse"
        title="Open Debug Panel"
      >
        <Bug className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col items-start gap-2 max-w-2xl">
      <div className="flex items-start gap-2">
        <div className="bg-black border-2 border-green-500 rounded-lg px-3 py-2 shadow-lg pointer-events-none">
          <p className="text-green-400 text-xs font-mono font-bold">
            {getPageInfo()}
          </p>
          <p className="text-green-600 text-[10px] font-mono mt-0.5">
            {location.pathname}
          </p>
        </div>
        <button
          onClick={() => navigate('/cms/login')}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 shadow-lg pointer-events-auto transition-colors"
          title="Go to Admin CMS"
        >
          <p className="text-xs font-mono font-bold">CMS</p>
        </button>
      </div>

      <div className="bg-black border-2 border-yellow-500 rounded-lg px-3 py-2 shadow-lg pointer-events-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <p className="text-yellow-400 text-xs font-mono font-bold">PAYMENT TRACKING</p>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-yellow-400 hover:text-yellow-300 transition-colors p-1 hover:bg-yellow-900/30 rounded"
            title="Minimize Debug Panel"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Fiuu Status:</span>
            <span className={`text-[10px] font-mono font-bold ${getStatusColor(paymentDebug.fiuuStatus, 'fiuu')}`}>
              {paymentDebug.fiuuStatus || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Payment:</span>
            <span className={`text-[10px] font-mono font-bold ${getStatusColor(paymentDebug.paymentStatus, 'payment')}`}>
              {paymentDebug.paymentStatus || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Fulfillment:</span>
            <span className={`text-[10px] font-mono font-bold ${getStatusColor(paymentDebug.fulfillmentStatus, 'fulfillment')}`}>
              {paymentDebug.fulfillmentStatus || 'N/A'}
            </span>
          </div>

          <div className="h-px bg-yellow-900 my-1"></div>

          <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Order ID:</span>
            <span className="text-[10px] font-mono text-gray-400 break-all" title={paymentDebug.lastOrderId || 'None'}>
              {paymentDebug.lastOrderId || 'N/A'}
            </span>
            {paymentDebug.lastOrderId && (
              <button
                onClick={() => copyToClipboard(paymentDebug.lastOrderId!, 'orderId')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy full ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Order #:</span>
            <span className="text-[10px] font-mono text-gray-400">
              {paymentDebug.orderNumber || 'N/A'}
            </span>
            {paymentDebug.orderNumber && (
              <button
                onClick={() => copyToClipboard(paymentDebug.orderNumber!, 'orderNumber')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy order number"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">User ID:</span>
            <span className="text-[10px] font-mono text-gray-400 break-all" title={paymentDebug.userId || 'None'}>
              {paymentDebug.userId || 'N/A'}
            </span>
            {paymentDebug.userId && (
              <button
                onClick={() => copyToClipboard(paymentDebug.userId!, 'userId')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy full ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Payment Txn:</span>
            <span className="text-[10px] font-mono text-gray-400 break-all" title={paymentDebug.paymentTransactionId || 'None'}>
              {paymentDebug.paymentTransactionId || 'N/A'}
            </span>
            {paymentDebug.paymentTransactionId && (
              <button
                onClick={() => copyToClipboard(paymentDebug.paymentTransactionId!, 'paymentTxn')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy full ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Fiuu Txn:</span>
            <span className="text-[10px] font-mono text-gray-400 break-all" title={paymentDebug.tranId || 'None'}>
              {paymentDebug.tranId || 'N/A'}
            </span>
            {paymentDebug.tranId && (
              <button
                onClick={() => copyToClipboard(paymentDebug.tranId!, 'tranId')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy full ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Wallet Txn:</span>
            <span className="text-[10px] font-mono text-gray-400 break-all" title={paymentDebug.walletTransactionId || 'None'}>
              {paymentDebug.walletTransactionId || 'N/A'}
            </span>
            {paymentDebug.walletTransactionId && (
              <button
                onClick={() => copyToClipboard(paymentDebug.walletTransactionId!, 'walletTxn')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy full ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Amount:</span>
            <span className="text-[10px] font-mono text-gray-400">
              {paymentDebug.amount ? `RM ${parseFloat(paymentDebug.amount).toFixed(2)}` : 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-yellow-600 text-[10px] font-mono">Method:</span>
            <span className="text-[10px] font-mono text-gray-400">
              {paymentDebug.paymentMethod || 'N/A'}
            </span>
          </div>

          <div className="h-px bg-yellow-900 my-1"></div>

          <div className="space-y-1">
            <span className="text-yellow-600 text-[10px] font-mono font-bold">Submit URL:</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-gray-400 break-all flex-1">
                {paymentDebug.submitUrl || 'N/A'}
              </span>
              {paymentDebug.submitUrl && (
                <button
                  onClick={() => copyToClipboard(paymentDebug.submitUrl!, 'submitUrl')}
                  className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                  title="Copy URL"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-yellow-900 my-1"></div>

          <div className="space-y-1">
            <span className="text-yellow-600 text-[10px] font-mono font-bold">Callback Params:</span>
            {paymentDebug.callbackParams && Object.keys(paymentDebug.callbackParams).length > 0 ? (
              <div className="space-y-0.5">
                {Object.entries(paymentDebug.callbackParams).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[90px_1fr] gap-2 items-start">
                    <span className="text-yellow-700 text-[9px] font-mono">• {key}:</span>
                    <span className="text-[9px] font-mono text-gray-400 break-all">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[9px] font-mono text-gray-400">N/A</span>
            )}
          </div>

          <div className="h-px bg-yellow-900 my-1"></div>

          <div className="text-center">
            <p className="text-yellow-700 text-[8px] font-mono">
              Updated: {paymentDebug.lastUpdated ? new Date(paymentDebug.lastUpdated).toLocaleTimeString() : 'Never'}
            </p>
          </div>
        </div>

        <button
          onClick={clearDebugData}
          className="mt-2 w-full bg-red-900 hover:bg-red-800 text-red-300 text-[9px] font-mono px-2 py-1 rounded transition-colors"
        >
          CLEAR DATA
        </button>

        {copiedField && (
          <div className="mt-2 text-center">
            <p className="text-green-400 text-[8px] font-mono">Copied!</p>
          </div>
        )}
      </div>

      <div className="bg-black border-2 border-purple-500 rounded-lg px-3 py-2 shadow-lg pointer-events-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <p className="text-purple-400 text-xs font-mono font-bold">SMS TRACKING</p>
        </div>

        <div className="space-y-1.5">
          <div className="space-y-1">
            <span className="text-purple-600 text-[10px] font-mono font-bold">iSMS Submit URL:</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-gray-400 break-all flex-1">
                {paymentDebug.smsUrl || 'https://ww3.isms.com.my/isms_send_all_id.php'}
              </span>
              {paymentDebug.smsUrl && (
                <button
                  onClick={() => copyToClipboard(paymentDebug.smsUrl!, 'smsUrl')}
                  className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                  title="Copy URL"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-purple-900 my-1"></div>

          <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
            <span className="text-purple-600 text-[10px] font-mono">Phone:</span>
            <span className="text-[10px] font-mono text-gray-400 break-all">
              {paymentDebug.smsPhone || 'N/A'}
            </span>
            {paymentDebug.smsPhone && (
              <button
                onClick={() => copyToClipboard(paymentDebug.smsPhone!, 'smsPhone')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy phone"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-purple-600 text-[10px] font-mono">Status:</span>
            <span className={`text-[10px] font-mono font-bold ${
              paymentDebug.smsStatus?.toLowerCase() === 'success' ? 'text-green-400' :
              paymentDebug.smsStatus?.toLowerCase() === 'error' ? 'text-red-400' :
              'text-gray-400'
            }`}>
              {paymentDebug.smsStatus || 'N/A'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-purple-600 text-[10px] font-mono font-bold">Response:</span>
            <span className="text-[9px] font-mono text-gray-400 break-all block">
              {paymentDebug.smsMessage || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-purple-600 text-[10px] font-mono">Sent At:</span>
            <span className="text-[10px] font-mono text-gray-400">
              {paymentDebug.smsTimestamp ? new Date(paymentDebug.smsTimestamp).toLocaleString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-black border-2 border-cyan-500 rounded-lg px-3 py-2 shadow-lg pointer-events-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <p className="text-cyan-400 text-xs font-mono font-bold">EMAIL TRACKING</p>
        </div>

        <div className="space-y-1.5">
          <div className="space-y-1">
            <span className="text-cyan-600 text-[10px] font-mono font-bold">Supabase Auth Service:</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-gray-400 break-all flex-1">
                {paymentDebug.emailResetSupabaseUrl || import.meta.env.VITE_SUPABASE_URL || 'N/A'}
              </span>
              {paymentDebug.emailResetSupabaseUrl && (
                <button
                  onClick={() => copyToClipboard(paymentDebug.emailResetSupabaseUrl!, 'emailSupabaseUrl')}
                  className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                  title="Copy URL"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-cyan-900 my-1"></div>

          <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
            <span className="text-cyan-600 text-[10px] font-mono">Email:</span>
            <span className="text-[10px] font-mono text-gray-400 break-all">
              {paymentDebug.emailResetEmail || 'N/A'}
            </span>
            {paymentDebug.emailResetEmail && (
              <button
                onClick={() => copyToClipboard(paymentDebug.emailResetEmail!, 'emailAddress')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy email"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-cyan-600 text-[10px] font-mono font-bold">Redirect URL:</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-gray-400 break-all flex-1">
                {paymentDebug.emailResetRedirectTo || 'N/A'}
              </span>
              {paymentDebug.emailResetRedirectTo && (
                <button
                  onClick={() => copyToClipboard(paymentDebug.emailResetRedirectTo!, 'emailRedirectTo')}
                  className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                  title="Copy URL"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-cyan-900 my-1"></div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-cyan-600 text-[10px] font-mono">Status:</span>
            <span className={`text-[10px] font-mono font-bold ${
              paymentDebug.emailResetStatus?.toLowerCase() === 'success' ? 'text-green-400' :
              paymentDebug.emailResetStatus?.toLowerCase() === 'error' ? 'text-red-400' :
              paymentDebug.emailResetStatus?.toLowerCase() === 'pending' ? 'text-yellow-400' :
              'text-gray-400'
            }`}>
              {paymentDebug.emailResetStatus?.toUpperCase() || 'N/A'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-cyan-600 text-[10px] font-mono font-bold">Message:</span>
            <span className="text-[9px] font-mono text-gray-400 break-all block">
              {paymentDebug.emailResetMessage || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-cyan-600 text-[10px] font-mono">Auth Event:</span>
            <span className="text-[10px] font-mono text-gray-400">
              {paymentDebug.emailAuthEvent || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
            <span className="text-cyan-600 text-[10px] font-mono">Timestamp:</span>
            <span className="text-[10px] font-mono text-gray-400">
              {paymentDebug.emailResetTimestamp ? new Date(paymentDebug.emailResetTimestamp).toLocaleString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugBox;
