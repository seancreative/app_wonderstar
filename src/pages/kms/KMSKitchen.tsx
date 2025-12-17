import React, { useState, useEffect, useCallback } from 'react';
import { useKitchenAuth } from '../../contexts/KitchenAuthContext';
import { supabase } from '../../lib/supabase';
import KMSLayout from '../../components/kms/KMSLayout';
import { Clock, Check, Square, CheckSquare, Package, AlertCircle, X, ChefHat, Wifi, WifiOff, AlertTriangle, RefreshCw, Database, Radio, Volume2, Bell } from 'lucide-react';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import { notificationSound } from '../../utils/notificationSound';

interface Outlet {
  id: string;
  name: string;
  location: string;
}

interface KitchenOrder {
  id: string;
  order_number: string;
  items: any[];
  created_at: string;
  outlet_id: string;
  outlet_name: string;
  outlet_location: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  total_amount: number;
  fnbstatus?: 'preparing' | 'ready' | 'collected' | 'cancelled';
  fnbstatus_updated_at?: string;
  payment_status: string;
  status: string;
}

interface ItemTrackingStatus {
  [key: string]: {
    [itemIndex: number]: boolean;
  };
}

interface DiagnosticInfo {
  timestamp: string;
  database_status: string;
  orders: {
    total: number;
    paid: number;
    pending: number;
    with_fnbstatus: number;
    null_fnbstatus_paid: number;
  };
  outlets: {
    total: number;
  };
  users: {
    total: number;
  };
  recent_paid_orders_sample: any[];
  fnbstatus_breakdown: any;
}

const CARD_COLORS = [
  { header: 'bg-orange-500', text: 'text-orange-900', border: 'border-orange-200' },
  { header: 'bg-yellow-500', text: 'text-yellow-900', border: 'border-yellow-200' },
  { header: 'bg-blue-500', text: 'text-blue-900', border: 'border-blue-200' },
  { header: 'bg-green-500', text: 'text-green-900', border: 'border-green-200' }
];

const KMSKitchen: React.FC = () => {
  const { kitchenUser } = useKitchenAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [itemTracking, setItemTracking] = useState<ItemTrackingStatus>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<'all' | 'preparing' | 'ready' | 'collected' | 'cancelled'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [newOrderNotification, setNewOrderNotification] = useState<string | null>(null);
  const [showAllOutlets, setShowAllOutlets] = useState(true);
  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected');
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastOrderReceived, setLastOrderReceived] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [notifiedOrders, setNotifiedOrders] = useState<Set<string>>(new Set());
  const [notifyingOrder, setNotifyingOrder] = useState<string | null>(null);

  useEffect(() => {
    if (kitchenUser) {
      loadOutlets();
      loadDiagnosticInfo();
    }
  }, [kitchenUser]);

  useEffect(() => {
    loadOrders();
    loadTrackingStatus();
  }, [selectedOutletId, showAllOutlets]);

  useEffect(() => {
    console.log('[KMS Realtime] Setting up subscriptions...');
    setIsListening(true);

    const ordersChangeConfig = showAllOutlets
      ? {
          event: '*',
          schema: 'public',
          table: 'shop_orders'
        }
      : {
          event: '*',
          schema: 'public',
          table: 'shop_orders',
          filter: `outlet_id=eq.${selectedOutletId}`
        };

    const channel = supabase
      .channel('kitchen-orders-realtime-v2')
      .on(
        'postgres_changes',
        ordersChangeConfig as any,
        (payload: any) => {
          console.log('[KMS Realtime] Order change detected:', payload.eventType, payload);
          setLastOrderReceived(new Date());

          // Show notification for new orders
          if (payload.eventType === 'INSERT' && payload.new) {
            const collectionNum = getCollectionNumber(payload.new.order_number);
            console.log('[KMS Realtime] New order received:', collectionNum);

            setNewOrderNotification(collectionNum);

            // Play notification sound
            if (soundEnabled) {
              notificationSound.playNotification();
            }

            // Clear notification after 5 seconds
            setTimeout(() => setNewOrderNotification(null), 5000);
          }

          // Reload orders on any change
          loadOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kitchen_item_tracking'
        },
        () => {
          console.log('[KMS Realtime] Tracking change detected, reloading...');
          loadTrackingStatus();
        }
      )
      .subscribe((status) => {
        console.log('[KMS Realtime] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('[KMS Realtime] Successfully subscribed to real-time updates');
          setConnectionStatus('connected');
          setIsListening(true);
          setRetryCount(0);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[KMS Realtime] Subscription error:', status);
          setConnectionStatus('error');
          setIsListening(false);

          // Auto-retry up to 3 times with exponential backoff
          if (retryCount < 3) {
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log(`[KMS Realtime] Retrying in ${retryDelay}ms (attempt ${retryCount + 1}/3)`);
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, retryDelay);
          }
        } else if (status === 'CLOSED') {
          console.log('[KMS Realtime] Subscription closed');
          setIsListening(false);
        }
      });

    return () => {
      console.log('[KMS Realtime] Cleaning up subscriptions');
      setIsListening(false);
      supabase.removeChannel(channel);
    };
  }, [selectedOutletId, showAllOutlets, soundEnabled, retryCount]);

  const testConnection = async () => {
    try {
      const { data, error } = await supabase.rpc('kms_test_connection');
      if (error) throw error;
      console.log('[KMS] Connection test:', data);
      setConnectionStatus('connected');
      return true;
    } catch (err) {
      console.error('[KMS] Connection test failed:', err);
      setConnectionStatus('error');
      setError('Database connection failed. Please check your connection.');
      return false;
    }
  };

  const loadDiagnosticInfo = async () => {
    try {
      const { data, error } = await supabase.rpc('kms_diagnostic_info');
      if (error) throw error;

      console.log('[KMS] Diagnostic Info:', data);
      setDiagnosticInfo(data);
    } catch (err) {
      console.error('[KMS] Error loading diagnostic info:', err);
    }
  };

  const loadOutlets = async () => {
    try {
      console.log('[KMS] Loading outlets...');
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, location')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      console.log('[KMS] Loaded', data?.length || 0, 'outlets');
      setOutlets(data || []);

      if (kitchenUser?.isAdmin && data && data.length > 0) {
        setSelectedOutletId(data[0].id);
      } else if (kitchenUser?.outlet_id) {
        setSelectedOutletId(kitchenUser.outlet_id);
      }
    } catch (error: any) {
      console.error('[KMS] Error loading outlets:', error);
      setError(`Failed to load outlets: ${error.message}`);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[KMS] ========================================');
      console.log('[KMS] Loading orders...');
      console.log('[KMS] Selected Outlet:', selectedOutletId || 'ALL');
      console.log('[KMS] Show All Outlets:', showAllOutlets);
      console.log('[KMS] ========================================');

      await testConnection();

      const outletFilter = showAllOutlets ? null : selectedOutletId || null;

      console.log('[KMS] Calling kms_get_orders with outlet_id:', outletFilter);

      const { data, error } = await supabase.rpc('kms_get_orders', {
        p_outlet_id: outletFilter,
        p_limit: 500
      });

      if (error) {
        console.error('[KMS] RPC Error:', error);
        throw error;
      }

      console.log('[KMS] ========================================');
      console.log('[KMS] Query Results:');
      console.log('[KMS]   Total orders returned:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('[KMS]   Sample order:', {
          order_number: data[0].order_number,
          outlet: data[0].outlet_name,
          payment_status: data[0].payment_status,
          fnbstatus: data[0].fnbstatus,
          items: data[0].item_count
        });
      }
      console.log('[KMS] ========================================');

      const ordersData = data || [];

      setOrders(ordersData);
      setLastRefresh(new Date());
      setConnectionStatus('connected');

      const statusBreakdown = {
        preparing: ordersData.filter(o => o.fnbstatus === 'preparing' || o.fnbstatus === null).length,
        ready: ordersData.filter(o => o.fnbstatus === 'ready').length,
        collected: ordersData.filter(o => o.fnbstatus === 'collected').length,
        cancelled: ordersData.filter(o => o.fnbstatus === 'cancelled').length
      };

      console.log('[KMS] Status Breakdown:', statusBreakdown);

    } catch (error: any) {
      console.error('[KMS] ========================================');
      console.error('[KMS] ERROR LOADING ORDERS:', error);
      console.error('[KMS] Error message:', error.message);
      console.error('[KMS] Error details:', error);
      console.error('[KMS] ========================================');

      setError(`Failed to load orders: ${error.message}`);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const loadTrackingStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('kitchen_item_tracking')
        .select('order_id, item_index, is_prepared');

      if (error) throw error;

      const trackingMap: ItemTrackingStatus = {};
      (data || []).forEach(item => {
        if (!trackingMap[item.order_id]) {
          trackingMap[item.order_id] = {};
        }
        trackingMap[item.order_id][item.item_index] = item.is_prepared;
      });

      setItemTracking(trackingMap);
    } catch (error) {
      console.error('[KMS] Error loading tracking status:', error);
    }
  };

  const toggleItemPrepared = async (orderId: string, itemIndex: number) => {
    if (!kitchenUser) return;

    try {
      const { data, error } = await supabase.rpc('toggle_kitchen_item_preparation', {
        p_order_id: orderId,
        p_item_index: itemIndex,
        p_staff_id: kitchenUser.id
      });

      if (error) throw error;

      setItemTracking(prev => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          [itemIndex]: data.is_prepared
        }
      }));
    } catch (error) {
      console.error('[KMS] Error toggling item:', error);
    }
  };

  const markAllItemsPrepared = async (orderId: string, itemCount: number) => {
    if (!kitchenUser) return;

    try {
      const { error } = await supabase.rpc('mark_all_order_items_prepared', {
        p_order_id: orderId,
        p_staff_id: kitchenUser.id,
        p_item_count: itemCount
      });

      if (error) throw error;

      const newTracking: { [key: number]: boolean } = {};
      for (let i = 0; i < itemCount; i++) {
        newTracking[i] = true;
      }

      setItemTracking(prev => ({
        ...prev,
        [orderId]: newTracking
      }));

      await updateFnbStatus(orderId, 'ready');
    } catch (error) {
      console.error('[KMS] Error marking all items:', error);
    }
  };

  const updateFnbStatus = async (orderId: string, newStatus: 'preparing' | 'ready' | 'collected' | 'cancelled') => {
    if (!kitchenUser) return;

    // Show confirmation for cancellation
    if (newStatus === 'cancelled') {
      setShowCancelConfirm(orderId);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('update_fnb_status', {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_staff_id: kitchenUser.id
      });

      if (error) throw error;

      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? { ...order, fnbstatus: newStatus, fnbstatus_updated_at: new Date().toISOString() }
          : order
      ));

      console.log('[KMS] Status updated to:', newStatus);
    } catch (error) {
      console.error('[KMS] Error updating status:', error);
    }
  };

  const confirmCancelOrder = async (orderId: string) => {
    if (!kitchenUser) return;

    try {
      const { error } = await supabase.rpc('update_fnb_status', {
        p_order_id: orderId,
        p_new_status: 'cancelled',
        p_staff_id: kitchenUser.id
      });

      if (error) throw error;

      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? { ...order, fnbstatus: 'cancelled', fnbstatus_updated_at: new Date().toISOString() }
          : order
      ));

      setShowCancelConfirm(null);
      console.log('[KMS] Order cancelled:', orderId);
    } catch (error) {
      console.error('[KMS] Error cancelling order:', error);
    }
  };

  const sendReadyNotification = async (orderId: string) => {
    if (!kitchenUser) return;

    setNotifyingOrder(orderId);

    try {
      const { data, error } = await supabase.rpc('send_order_ready_notification', {
        p_order_id: orderId,
        p_staff_id: kitchenUser.id
      });

      if (error) throw error;

      if (data?.success) {
        setNotifiedOrders(prev => new Set(prev).add(orderId));

        if (soundEnabled) {
          notificationSound.playSuccess();
        }

        console.log('[KMS] Customer notified for order:', orderId);
      } else {
        console.error('[KMS] Notification failed:', data?.error);
        alert(data?.error || 'Failed to send notification');
      }
    } catch (error) {
      console.error('[KMS] Error sending notification:', error);
      alert('Failed to send notification. Please try again.');
    } finally {
      setNotifyingOrder(null);
    }
  };

  const getColorForOrder = (index: number) => {
    return CARD_COLORS[index % CARD_COLORS.length];
  };

  const getCollectionNumber = (orderNumber: string): string => {
    // Extract last 4 digits from order number
    const digits = orderNumber.replace(/\D/g, ''); // Remove non-digits
    return digits.slice(-4) || '0000'; // Get last 4 digits or default to 0000
  };

  const isItemPrepared = (orderId: string, itemIndex: number): boolean => {
    return itemTracking[orderId]?.[itemIndex] || false;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'preparing':
        return {
          label: 'Preparing',
          icon: ChefHat,
          activeClass: 'bg-orange-600 text-white border-orange-700 shadow-lg',
          inactiveClass: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
          badgeClass: 'bg-orange-100 text-orange-800 border-orange-300'
        };
      case 'ready':
        return {
          label: 'Ready',
          icon: Check,
          activeClass: 'bg-green-600 text-white border-green-700 shadow-lg',
          inactiveClass: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
          badgeClass: 'bg-green-100 text-green-800 border-green-300'
        };
      case 'collected':
        return {
          label: 'Collected',
          icon: Package,
          activeClass: 'bg-blue-600 text-white border-blue-700 shadow-lg',
          inactiveClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300'
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          icon: X,
          activeClass: 'bg-red-600 text-white border-red-700 shadow-lg',
          inactiveClass: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
          badgeClass: 'bg-red-100 text-red-800 border-red-300'
        };
      default:
        return {
          label: 'Preparing',
          icon: ChefHat,
          activeClass: 'bg-gray-600 text-white border-gray-700 shadow-lg',
          inactiveClass: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
          badgeClass: 'bg-gray-100 text-gray-800 border-gray-300'
        };
    }
  };

  const getOrderTime = (createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const WaitingTimer: React.FC<{ createdAt: string; status: string }> = ({ createdAt, status }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
      if (status === 'ready' || status === 'collected' || status === 'cancelled') {
        return;
      }

      const updateElapsed = () => {
        const created = new Date(createdAt).getTime();
        const now = Date.now();
        const diff = Math.floor((now - created) / 1000);
        setElapsed(diff);
      };

      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);

      return () => clearInterval(interval);
    }, [createdAt, status]);

    if (status === 'ready' || status === 'collected' || status === 'cancelled') {
      return null;
    }

    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    const getColorClass = () => {
      if (minutes < 5) return 'text-green-600 bg-green-100';
      if (minutes < 10) return 'text-yellow-600 bg-yellow-100';
      if (minutes < 15) return 'text-orange-600 bg-orange-100';
      return 'text-red-600 bg-red-100 animate-pulse';
    };

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-xs border-2 ${getColorClass()}`}>
        <Clock className="w-3 h-3" />
        <span className="tabular-nums">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    );
  };

  const formatModifiers = (item: any) => {
    // The correct location is item.metadata.selected_modifiers (snake_case)
    let selectedModifiers = item?.metadata?.selected_modifiers
      || item?.metadata?.selectedModifiers  // fallback to camelCase
      || item?.selectedModifiers
      || item?.selected_modifiers
      || item?.modifiers
      || item?.metadata?.modifiers;

    // If no modifiers or empty array, return early
    if (!selectedModifiers || (Array.isArray(selectedModifiers) && selectedModifiers.length === 0)) {
      return [];
    }

    // Handle array format (the correct format from database)
    if (Array.isArray(selectedModifiers)) {
      return selectedModifiers
        .map(modifier => {
          // Extract group name (snake_case is correct)
          const groupName = modifier.group_name || modifier.groupName || modifier.name || 'Options';

          // Extract selected options (snake_case is correct)
          const options = modifier.selected_options || modifier.selectedOptions || modifier.options || [];

          // If no options, skip this modifier
          if (!Array.isArray(options) || options.length === 0) {
            return null;
          }

          // Build comma-separated list of option names
          const optionNames = options
            .map((opt: any) => {
              const name = opt.option_name || opt.optionName || opt.name || String(opt);
              const qty = opt.quantity || 1;

              // Show quantity if more than 1
              if (qty > 1) {
                return `${name} (x${qty})`;
              }
              return name;
            })
            .filter(Boolean)
            .join(', ');

          if (!optionNames) {
            return null;
          }

          return {
            groupName: groupName.trim(),
            value: optionNames
          };
        })
        .filter(mod => mod !== null); // Remove null entries
    }

    // Handle legacy object format (if any old data exists)
    if (typeof selectedModifiers === 'object') {
      return Object.entries(selectedModifiers)
        .map(([groupName, value]) => ({
          groupName,
          value: Array.isArray(value) ? value.join(', ') : String(value)
        }))
        .filter(mod => mod.value);
    }

    return [];
  };

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const getFilteredOrders = () => {
    let filtered = orders;

    // Apply date filter
    if (dateFilter === 'today') {
      filtered = filtered.filter(order => isToday(order.created_at));
    }

    // Apply status filter
    if (statusFilter === 'all') {
      filtered = filtered.filter(order => order.fnbstatus !== 'cancelled');
    } else if (statusFilter === 'preparing') {
      filtered = filtered.filter(order => order.fnbstatus === 'preparing' || order.fnbstatus === null);
    } else if (statusFilter === 'cancelled') {
      filtered = filtered.filter(order => order.fnbstatus === 'cancelled');
    } else {
      filtered = filtered.filter(order => order.fnbstatus === statusFilter);
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const getStatusCount = (status: 'preparing' | 'ready' | 'collected' | 'cancelled') => {
    let filtered = orders;

    // Apply date filter for counts
    if (dateFilter === 'today') {
      filtered = filtered.filter(order => isToday(order.created_at));
    }

    if (status === 'preparing') {
      return filtered.filter(order => order.fnbstatus === 'preparing' || order.fnbstatus === null).length;
    }
    if (status === 'cancelled') {
      return filtered.filter(order => order.fnbstatus === 'cancelled').length;
    }
    return filtered.filter(order => order.fnbstatus === status).length;
  };

  if (!kitchenUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center bg-white p-12 rounded-2xl shadow-xl max-w-md">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-gray-900 mb-3">Not Authorized</h2>
          <p className="text-gray-600 text-lg">Please login to access the Kitchen Management System.</p>
        </div>
      </div>
    );
  }

  return (
    <KMSLayout onRefresh={loadOrders}>
      <div className="p-4 space-y-4">
        {newOrderNotification && (
          <div className="fixed top-20 right-4 z-50 animate-bounce">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-10 py-6 rounded-2xl shadow-2xl border-4 border-green-300">
              <div className="flex items-center gap-4">
                <div className="bg-white rounded-full p-3 animate-pulse">
                  <Package className="w-10 h-10 text-green-600" />
                </div>
                <div>
                  <div className="font-black text-2xl mb-1">NEW ORDER!</div>
                  <div className="text-lg font-bold">Collection #{newOrderNotification}</div>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-green-400 rounded-2xl animate-ping opacity-75 -z-10"></div>
          </div>
        )}

        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
              <div className="text-center">
                <X className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <h3 className="text-2xl font-black text-gray-900 mb-3">Cancel Order?</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to cancel this order? This action can be reverted later.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelConfirm(null)}
                    className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition-all"
                  >
                    No, Keep It
                  </button>
                  <button
                    onClick={() => confirmCancelOrder(showCancelConfirm)}
                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all"
                  >
                    Yes, Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-4 border-red-300 rounded-xl p-6 shadow-lg animate-pulse">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-xl font-black text-red-900 mb-2">Error Loading Orders</h3>
                <p className="text-red-800 font-medium mb-4">{error}</p>
                <div className="flex gap-3">
                  <button
                    onClick={loadOrders}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Retry
                  </button>
                  <button
                    onClick={loadDiagnosticInfo}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                  >
                    <Database className="w-5 h-5" />
                    Run Diagnostics
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' ? (
                  <Wifi className="w-6 h-6 text-green-300" />
                ) : (
                  <WifiOff className="w-6 h-6 text-red-300" />
                )}
                <div>
                  <h2 className="text-2xl font-black">Kitchen Orders</h2>
                  <p className="text-sm text-blue-200 font-medium">
                    {showAllOutlets
                      ? `All Outlets (${outlets.length} locations)`
                      : `${outlets.find(o => o.id === selectedOutletId)?.name || 'Select Outlet'} - ${outlets.find(o => o.id === selectedOutletId)?.location || ''}`}
                  </p>
                </div>
              </div>
              <div className="px-4 py-2 bg-white bg-opacity-20 rounded-lg">
                <div className="text-3xl font-black">{orders.length}</div>
                <div className="text-xs text-blue-200 font-medium">Total</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 flex items-center gap-2 ${
                  soundEnabled
                    ? 'bg-white text-blue-600 border-white'
                    : 'bg-transparent text-white border-white hover:bg-white hover:bg-opacity-20'
                }`}
                title={soundEnabled ? 'Sound ON' : 'Sound OFF'}
              >
                <Volume2 className={`w-4 h-4 ${!soundEnabled && 'opacity-50'}`} />
                {soundEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg font-bold text-sm transition-all"
              >
                {showDebugPanel ? 'Hide' : 'Show'} Debug
              </button>
              <div className="text-sm flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 rounded-lg">
                <Clock className="w-4 h-4" />
                {lastRefresh.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 pt-4 border-t border-white border-opacity-20">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              isListening ? 'bg-green-500 bg-opacity-30' : 'bg-red-500 bg-opacity-30'
            }`}>
              <Radio className={`w-4 h-4 ${isListening && 'animate-pulse'}`} />
              <span className="text-sm font-bold">
                {isListening ? 'Listening for orders...' : 'Not listening'}
              </span>
            </div>

            {lastOrderReceived && (
              <div className="text-sm flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 rounded-lg">
                <Package className="w-4 h-4" />
                Last update: {lastOrderReceived.toLocaleTimeString()}
              </div>
            )}

            {connectionStatus === 'connected' && isListening && (
              <div className="text-xs text-green-300 font-medium">
                Real-time updates active
              </div>
            )}

            {connectionStatus === 'error' && (
              <div className="text-xs text-red-300 font-bold flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Connection error - using manual refresh
              </div>
            )}
          </div>
        </div>

        {showDebugPanel && (
          <div className="bg-gray-900 text-white rounded-xl p-6 shadow-xl font-mono text-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-yellow-400">System Diagnostics</h3>
              <button
                onClick={loadDiagnosticInfo}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>

            {diagnosticInfo && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Database</div>
                    <div className="text-green-400 font-bold text-lg">{diagnosticInfo.database_status}</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Total Orders</div>
                    <div className="text-blue-400 font-bold text-lg">{diagnosticInfo.orders.total}</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Paid Orders</div>
                    <div className="text-green-400 font-bold text-lg">{diagnosticInfo.orders.paid}</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Pending Payment</div>
                    <div className="text-yellow-400 font-bold text-lg">{diagnosticInfo.orders.pending}</div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-xs mb-2">F&B Status Breakdown</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {diagnosticInfo.fnbstatus_breakdown && Object.entries(diagnosticInfo.fnbstatus_breakdown).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span className="text-gray-300">{status}:</span>
                        <span className="text-white font-bold">{String(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {diagnosticInfo.recent_paid_orders_sample.length > 0 && (
                  <details className="bg-gray-800 rounded-lg p-4">
                    <summary className="cursor-pointer text-blue-400 hover:text-blue-300 font-bold">
                      Recent Orders Sample ({diagnosticInfo.recent_paid_orders_sample.length})
                    </summary>
                    <div className="mt-3 space-y-2 text-xs">
                      {diagnosticInfo.recent_paid_orders_sample.map((order: any, idx: number) => (
                        <div key={idx} className="bg-gray-700 rounded p-2">
                          <div className="text-white font-bold">{order.order_number}</div>
                          <div className="text-gray-400">
                            Payment: {order.payment_status} | F&B: {order.fnbstatus || 'null'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400">Current Filter:</span>{' '}
                  <span className="text-yellow-400 font-bold">{statusFilter.toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-gray-400">Displayed Orders:</span>{' '}
                  <span className="text-green-400 font-bold">{getFilteredOrders().length}</span>
                </div>
                <div>
                  <span className="text-gray-400">Outlet Mode:</span>{' '}
                  <span className={showAllOutlets ? 'text-green-400' : 'text-orange-400'}>{showAllOutlets ? 'ALL' : 'SINGLE'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Connection:</span>{' '}
                  <span className={connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}>
                    {connectionStatus.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Realtime:</span>{' '}
                  <span className={isListening ? 'text-green-400' : 'text-red-400'}>
                    {isListening ? 'LISTENING' : 'NOT LISTENING'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Sound:</span>{' '}
                  <span className={soundEnabled ? 'text-green-400' : 'text-orange-400'}>
                    {soundEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => notificationSound.playNotification()}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                >
                  <Volume2 className="w-4 h-4" />
                  Test Sound
                </button>
                <button
                  onClick={() => {
                    setNewOrderNotification('1234');
                    setTimeout(() => setNewOrderNotification(null), 5000);
                  }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold transition-all"
                >
                  Test Notification
                </button>
              </div>
            </div>
          </div>
        )}

        {outlets.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-lg border-2 border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black text-gray-900">Filter by Outlet</h3>
              <div className="text-sm text-gray-600 font-medium">
                {showAllOutlets ? `Showing all ${orders.length} orders` : `${orders.length} orders from selected outlet`}
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              <button
                onClick={() => setShowAllOutlets(true)}
                className={`flex-shrink-0 min-w-[180px] py-4 px-6 rounded-xl font-bold text-base transition-all border-4 ${
                  showAllOutlets
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-800 shadow-lg scale-105'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                <div className="text-center">
                  <div className="font-black text-xl">All Outlets</div>
                  <div className="text-sm opacity-90 font-medium mt-1">
                    {orders.length} total orders
                  </div>
                </div>
              </button>
              {outlets.map(outlet => {
                const outletOrderCount = orders.filter(o => o.outlet_id === outlet.id).length;
                return (
                  <button
                    key={outlet.id}
                    onClick={() => {
                      setSelectedOutletId(outlet.id);
                      setShowAllOutlets(false);
                    }}
                    className={`flex-shrink-0 min-w-[180px] py-4 px-6 rounded-xl font-bold text-base transition-all border-4 ${
                      selectedOutletId === outlet.id && !showAllOutlets
                        ? 'bg-gradient-to-r from-green-600 to-green-700 text-white border-green-800 shadow-lg scale-105'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-black text-xl">{outlet.name}</div>
                      <div className="text-sm opacity-90 font-medium mt-1">
                        {outlet.location} • {outletOrderCount} orders
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl p-4 shadow-lg border-2 border-gray-200 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black text-gray-900">Filter by Date</h3>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setDateFilter('today')}
              className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all border-2 ${
                dateFilter === 'today'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-800 shadow-lg'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              Today Only
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-black ${
                dateFilter === 'today' ? 'bg-white bg-opacity-20' : 'bg-blue-100 text-blue-700'
              }`}>
                {orders.filter(o => isToday(o.created_at) && o.fnbstatus !== 'cancelled').length}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all border-2 ${
                dateFilter === 'all'
                  ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white border-gray-800 shadow-lg'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              All Dates
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-black ${
                dateFilter === 'all' ? 'bg-white bg-opacity-20' : 'bg-gray-100 text-gray-700'
              }`}>
                {orders.filter(o => o.fnbstatus !== 'cancelled').length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white border-gray-900 shadow-lg'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            }`}
          >
            All Orders
            <span className="ml-2 px-2 py-0.5 bg-white bg-opacity-20 rounded-full text-xs font-black">
              {dateFilter === 'today'
                ? orders.filter(o => isToday(o.created_at) && o.fnbstatus !== 'cancelled').length
                : orders.filter(o => o.fnbstatus !== 'cancelled').length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('preparing')}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 whitespace-nowrap flex items-center gap-2 ${
              statusFilter === 'preparing'
                ? 'bg-orange-600 text-white border-orange-700 shadow-lg'
                : 'bg-white text-orange-700 border-orange-200 hover:border-orange-400'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            Preparing
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
              statusFilter === 'preparing' ? 'bg-white bg-opacity-20' : 'bg-orange-100'
            }`}>
              {getStatusCount('preparing')}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('ready')}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 whitespace-nowrap flex items-center gap-2 ${
              statusFilter === 'ready'
                ? 'bg-green-600 text-white border-green-700 shadow-lg'
                : 'bg-white text-green-700 border-green-200 hover:border-green-400'
            }`}
          >
            <Check className="w-4 h-4" />
            Ready
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
              statusFilter === 'ready' ? 'bg-white bg-opacity-20' : 'bg-green-100'
            }`}>
              {getStatusCount('ready')}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('collected')}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 whitespace-nowrap flex items-center gap-2 ${
              statusFilter === 'collected'
                ? 'bg-blue-600 text-white border-blue-700 shadow-lg'
                : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'
            }`}
          >
            <Package className="w-4 h-4" />
            Collected
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
              statusFilter === 'collected' ? 'bg-white bg-opacity-20' : 'bg-blue-100'
            }`}>
              {getStatusCount('collected')}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('cancelled')}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 whitespace-nowrap flex items-center gap-2 ${
              statusFilter === 'cancelled'
                ? 'bg-red-600 text-white border-red-700 shadow-lg'
                : 'bg-white text-red-700 border-red-200 hover:border-red-400'
            }`}
          >
            <X className="w-4 h-4" />
            Cancelled
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
              statusFilter === 'cancelled' ? 'bg-white bg-opacity-20' : 'bg-red-100'
            }`}>
              {getStatusCount('cancelled')}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-lg">
            <div className="inline-block w-16 h-16 border-8 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-6 text-gray-900 font-bold text-xl">Loading orders...</p>
            <p className="mt-2 text-gray-600">This should only take a moment</p>
          </div>
        ) : getFilteredOrders().length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-lg">
            <Package className="w-24 h-24 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-black text-gray-900 mb-3">No Orders</h3>
            <p className="text-gray-600 text-lg mb-6">
              {statusFilter === 'all'
                ? 'All caught up! New orders will appear here automatically.'
                : `No orders with status "${statusFilter}"`}
            </p>
            {diagnosticInfo && diagnosticInfo.orders.paid > 0 && getFilteredOrders().length === 0 && (
              <div className="max-w-md mx-auto bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-yellow-900">
                  Database shows {diagnosticInfo.orders.paid} paid orders, but none are displaying.
                  Check outlet filter or run diagnostics.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {getFilteredOrders().map((order, orderIndex) => {
              const colors = getColorForOrder(orderIndex);
              const items = order.items as any[];

              const currentStatus = order.fnbstatus || 'preparing';
              const statusConfig = getStatusConfig(currentStatus);
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-xl border-4 ${colors.border} shadow-lg overflow-hidden hover:shadow-xl transition-all`}
                >
                  <div className={`${colors.header} text-white px-3 py-2`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <div className="font-black text-2xl">#{getCollectionNumber(order.order_number)}</div>
                          {showAllOutlets && (
                            <div className="text-xs opacity-75 font-semibold bg-white bg-opacity-20 px-2 py-0.5 rounded whitespace-nowrap">
                              {order.outlet_name}
                            </div>
                          )}
                        </div>
                        <div className="text-xs opacity-75">Order: {order.order_number} by {order.user_name}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-base">{getOrderTime(order.created_at)}</div>
                        <div className="text-xs opacity-75">{new Date(order.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border-2 ${statusConfig.badgeClass} font-bold text-xs`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </div>
                      <div className="flex items-center gap-2">
                        <WaitingTimer createdAt={order.created_at} status={currentStatus} />
                        {currentStatus === 'ready' && (
                          <button
                            onClick={() => sendReadyNotification(order.id)}
                            disabled={notifiedOrders.has(order.id) || notifyingOrder === order.id}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-xs transition-all border-2 ${
                              notifiedOrders.has(order.id)
                                ? 'bg-green-600 text-white border-green-700 cursor-not-allowed'
                                : notifyingOrder === order.id
                                ? 'bg-yellow-500 text-white border-yellow-600 cursor-wait'
                                : 'bg-yellow-400 text-yellow-900 border-yellow-600 hover:bg-yellow-500 hover:text-white animate-pulse'
                            }`}
                          >
                            <Bell className={`w-3 h-3 ${notifyingOrder === order.id ? 'animate-bounce' : ''}`} />
                            {notifiedOrders.has(order.id) ? 'Notified' : notifyingOrder === order.id ? 'Notifying' : 'Notify'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-gray-50 border-b-2 border-gray-200">
                    <div className="grid grid-cols-4 gap-1.5">
                      {['preparing', 'ready', 'collected', 'cancelled'].map((status) => {
                        const config = getStatusConfig(status);
                        const Icon = config.icon;
                        const isActive = currentStatus === status;

                        return (
                          <button
                            key={status}
                            onClick={() => updateFnbStatus(order.id, status as any)}
                            className={`py-1.5 px-1 rounded-lg font-bold text-xs transition-all border-2 flex flex-col items-center gap-0.5 ${
                              isActive ? config.activeClass : config.inactiveClass
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="leading-tight text-[10px]">{config.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
                    {items.map((item, itemIndex) => {
                      const isPrepared = isItemPrepared(order.id, itemIndex);
                      const modifiers = formatModifiers(item);

                      return (
                        <div
                          key={itemIndex}
                          className={`p-2 rounded-lg border-2 transition-all ${
                            isPrepared
                              ? 'bg-green-50 border-green-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => toggleItemPrepared(order.id, itemIndex)}
                              className="flex-shrink-0"
                            >
                              {isPrepared ? (
                                <CheckSquare className="w-5 h-5 text-green-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div>
                                <span className="font-bold text-gray-900">{item.quantity}x</span>{' '}
                                <span className={`font-bold text-sm ${isPrepared ? 'text-green-800 line-through' : 'text-gray-900'}`}>
                                  {item.product_name}
                                </span>
                              </div>

                              {modifiers.length > 0 && (
                                <div className="mt-1.5 space-y-1">
                                  {modifiers.map((mod, modIndex) => (
                                    <div key={modIndex} className="bg-blue-50 border-l-2 border-blue-400 px-2 py-1 rounded">
                                      <div className="flex items-start gap-1.5">
                                        <span className="text-blue-700 font-bold text-xs uppercase tracking-wide">{mod.groupName}:</span>
                                        <span className="text-blue-900 font-semibold text-xs flex-1">{mod.value}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {item.notes && (
                                <div className="mt-1.5 p-1.5 bg-yellow-50 border border-yellow-200 rounded">
                                  <p className="text-xs font-medium text-yellow-900">Note: {item.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2 bg-gray-50 border-t-2 border-gray-200">
                    <button
                      onClick={() => markAllItemsPrepared(order.id, items.length)}
                      className="w-full py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      Mark All Complete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </KMSLayout>
  );
};

export default KMSKitchen;
