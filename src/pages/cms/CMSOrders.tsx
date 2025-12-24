import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CMSLayout from '../../components/cms/CMSLayout';
import {
  ShoppingBag,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  Clock,
  Package,
  XCircle,
  Calendar,
  DollarSign,
  User,
  MapPin,
  FileText,
  QrCode,
  CreditCard,
  Wallet,
  Gift,
  Sparkles,
  Info,
  Star,
  Receipt,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import QRCodeDisplay from '../../components/QRCodeDisplay';
import ReceiptModal from '../../components/ReceiptModal';
import OrderNumberLink from '../../components/cms/OrderNumberLink';
import OrderTimeline from '../../components/OrderTimeline';
import { supabase } from '../../lib/supabase';
import { ShopOrder, Outlet, User as UserType, OrderItemRedemption } from '../../types/database';
import { getPaymentMethodConfig, formatDiscountAmount, formatCurrency } from '../../utils/paymentMethodUtils';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import {
  getItemOriginalSubtotal,
  getItemFinalPrice,
  getItemVoucherDiscount,
  getItemTierDiscount,
  getItemTotalDiscount,
  hasItemDiscount,
  getFormattedModifiers,
  type OrderItem
} from '../../utils/orderItemUtils';
import {
  getPaymentStatusConfig,
  getFulfillmentStatusConfig,
  cancellationReasons,
  refundReasons,
  type PaymentStatus,
  type FulfillmentStatus
} from '../../utils/orderStatusUtils';
import { useToast } from '../../contexts/ToastContext';

interface OrderWithDetails extends ShopOrder {
  users?: UserType;
  outlets?: Outlet;
  order_item_redemptions?: OrderItemRedemption[];
}

const CMSOrders: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [outlets, setOutlets] = useState<{ id: string; name: string; location?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [outletFilter, setOutletFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Bulk selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadOutlets();
    loadOrders();

    // Subscribe to real-time changes on order_item_redemptions
    const redemptionChannel = supabase
      .channel('order-redemptions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_item_redemptions'
        },
        () => {
          // Reload orders when redemptions change
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(redemptionChannel);
    };
  }, [statusFilter, paymentStatusFilter, paymentTypeFilter, outletFilter]);

  const loadOutlets = async () => {
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, location')
        .order('name');
      if (!error && data) {
        setOutlets(data);
      }
    } catch (error) {
      console.error('Error loading outlets:', error);
    }
  };

  const loadOrders = async () => {
    try {
      console.log('[CMSOrders] Starting to load orders...');
      console.log('[CMSOrders] Status filter:', statusFilter);

      // First, try a simple count query to see if there are any orders at all
      const { count: totalCount, error: countError } = await supabase
        .from('shop_orders')
        .select('*', { count: 'exact', head: true });

      console.log('[CMSOrders] Total orders in database:', totalCount);
      if (countError) {
        console.error('[CMSOrders] Error counting orders:', countError);
      }

      // Load orders first without joins
      let query = supabase
        .from('shop_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (paymentStatusFilter !== 'all') {
        query = query.eq('payment_status', paymentStatusFilter);
      }

      if (paymentTypeFilter !== 'all') {
        query = query.eq('payment_type', paymentTypeFilter);
      }

      if (outletFilter !== 'all') {
        query = query.eq('outlet_id', outletFilter);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        console.error('[CMSOrders] Error loading orders:', ordersError);
        console.error('[CMSOrders] Error details:', {
          message: ordersError.message,
          details: ordersError.details,
          hint: ordersError.hint,
          code: ordersError.code
        });
        throw ordersError;
      }

      console.log('[CMSOrders] Successfully loaded orders:', ordersData?.length || 0);

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // Now load related data separately
      const userIds = [...new Set(ordersData.map(o => o.user_id).filter(Boolean))];
      const outletIds = [...new Set(ordersData.map(o => o.outlet_id).filter(Boolean))];

      const [usersResult, outletsResult, redemptionsResult] = await Promise.all([
        supabase.from('users').select('id, name, email, phone').in('id', userIds),
        supabase.from('outlets').select('id, name, location, address').in('id', outletIds),
        supabase.from('order_item_redemptions').select('*').in('order_id', ordersData.map(o => o.id))
      ]);

      // Create lookup maps
      const usersMap = new Map((usersResult.data || []).map(u => [u.id, u]));
      const outletsMap = new Map((outletsResult.data || []).map(o => [o.id, o]));
      const redemptionsMap = new Map<string, any[]>();
      (redemptionsResult.data || []).forEach(r => {
        if (!redemptionsMap.has(r.order_id)) {
          redemptionsMap.set(r.order_id, []);
        }
        redemptionsMap.get(r.order_id)!.push(r);
      });

      // Merge the data
      const enrichedOrders = ordersData.map(order => ({
        ...order,
        users: usersMap.get(order.user_id),
        outlets: outletsMap.get(order.outlet_id),
        order_item_redemptions: redemptionsMap.get(order.id) || []
      }));

      console.log('[CMSOrders] Sample enriched order:', enrichedOrders[0]);
      setOrders(enrichedOrders);
    } catch (err) {
      console.error('[CMSOrders] Catch block error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchTerm === '' ||
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.users?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.users?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase());

    const orderDate = new Date(order.created_at);
    const matchesDateStart = !dateFilter.start || orderDate >= new Date(dateFilter.start);
    const matchesDateEnd = !dateFilter.end || orderDate <= new Date(dateFilter.end);

    return matchesSearch && matchesDateStart && matchesDateEnd;
  });

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      console.log('[CMSOrders] Attempting to update order status:', {
        orderId,
        newStatus,
        timestamp: new Date().toISOString()
      });

      // First verify the order exists
      const { data: existingOrder, error: fetchError } = await supabase
        .from('shop_orders')
        .select('id, status')
        .eq('id', orderId)
        .single();

      if (fetchError) {
        console.error('[CMSOrders] Error fetching order:', fetchError);
        throw new Error(`Cannot find order: ${fetchError.message}`);
      }

      console.log('[CMSOrders] Current order status:', existingOrder.status);

      // Prepare update data - let the trigger handle updated_at
      const updateData: any = {
        status: newStatus
      };

      // Only add completed_at when changing to completed status
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      console.log('[CMSOrders] Update data:', updateData);

      // Perform the update
      const { data: updatedData, error: updateError } = await supabase
        .from('shop_orders')
        .update(updateData)
        .eq('id', orderId)
        .select();

      if (updateError) {
        console.error('[CMSOrders] Update error details:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
        throw updateError;
      }

      console.log('[CMSOrders] Order updated successfully:', updatedData);

      // Reload orders to reflect changes
      await loadOrders();

      // Update the selected order in the modal
      if (selectedOrder?.id === orderId) {
        const updatedOrder = orders.find(o => o.id === orderId);
        if (updatedOrder) {
          setSelectedOrder({ ...updatedOrder, status: newStatus as any });
        }
      }

      console.log('[CMSOrders] Status update completed successfully');
    } catch (err: any) {
      console.error('[CMSOrders] Fatal error updating order status:', err);

      // Show detailed error message to help with debugging
      const errorMessage = err?.message || 'Unknown error occurred';
      const errorDetails = err?.details ? `\nDetails: ${err.details}` : '';
      const errorHint = err?.hint ? `\nHint: ${err.hint}` : '';

      toast.error(`Failed to update order status: ${errorMessage}${errorDetails}${errorHint}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone and will also delete all related redemptions.')) {
      return;
    }

    setDeleting(true);
    try {
      // First delete related order_item_redemptions
      await supabase
        .from('order_item_redemptions')
        .delete()
        .eq('order_id', orderId);

      // Then delete the order
      const { error } = await supabase
        .from('shop_orders')
        .delete()
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      toast.success('Order deleted successfully');
      await loadOrders();

      // Close modal if the deleted order was selected
      if (selectedOrder?.id === orderId) {
        setShowDetailModal(false);
        setSelectedOrder(null);
      }
    } catch (err: any) {
      console.error('Error deleting order:', err);
      toast.error(`Failed to delete order: ${err?.message || 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  // Bulk selection functions
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      // Deselect all
      setSelectedOrderIds(new Set());
    } else {
      // Select all filtered orders
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const bulkDeleteOrders = async () => {
    if (selectedOrderIds.size === 0) {
      toast.error('No orders selected');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedOrderIds.size} order(s)? This action cannot be undone and will delete all related redemptions.`)) {
      return;
    }

    setDeleting(true);
    try {
      const orderIdsArray = Array.from(selectedOrderIds);

      // First delete related order_item_redemptions
      await supabase
        .from('order_item_redemptions')
        .delete()
        .in('order_id', orderIdsArray);

      // Then delete the orders
      const { error } = await supabase
        .from('shop_orders')
        .delete()
        .in('id', orderIdsArray);

      if (error) {
        throw error;
      }

      toast.success(`${selectedOrderIds.size} order(s) deleted successfully`);
      setSelectedOrderIds(new Set());
      await loadOrders();

      // Close modal if the deleted order was selected
      if (selectedOrder && selectedOrderIds.has(selectedOrder.id)) {
        setShowDetailModal(false);
        setSelectedOrder(null);
      }
    } catch (err: any) {
      console.error('Error deleting orders:', err);
      toast.error(`Failed to delete orders: ${err?.message || 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Order #',
      'Payment Type',
      'Date',
      'Customer',
      'Email',
      'Outlet',
      'Items (Redeemed/Total)',
      'Gross Sales',
      'Disc. Voucher',
      'Disc. Bonus',
      'Disc. Others',
      'Total Paid',
      'Payment Method',
      'Voucher Code',
      'Payment Status',
      'Fulfillment Status',
      'Payment Error Code',
      'Cancellation Reason',
      'Refund Reason'
    ];
    const rows = filteredOrders.map(order => {
      const ratio = getItemsRedemptionRatio(order);
      const paymentConfig = getPaymentTypeConfig(order.payment_type || 'deduction');
      const paymentMethodConfig = getPaymentMethodConfig(order.payment_method);
      const paymentStatusConfig = getPaymentStatusConfig(order.payment_status as PaymentStatus);
      const fulfillmentStatusConfig = getFulfillmentStatusConfig(order.status as FulfillmentStatus);
      return [
        order.order_number || order.id.slice(0, 8),
        paymentConfig.label,
        formatDateTimeCMS(order.created_at),
        order.users?.name || 'Guest',
        order.users?.email || '-',
        order.outlets?.name || '-',
        ratio.text,
        `RM ${(order.gross_sales || order.subtotal || 0).toFixed(2)}`,
        `-RM ${(order.discount_amount || 0).toFixed(2)}`,
        `-RM ${(order.bonus_discount_amount || 0).toFixed(2)}`,
        `-RM ${(order.permanent_discount_amount || 0).toFixed(2)}`,
        `RM ${parseFloat(order.total_amount.toString()).toFixed(2)}`,
        paymentMethodConfig.label,
        order.voucher_code || '-',
        paymentStatusConfig.label,
        fulfillmentStatusConfig.label,
        order.payment_error_code || '-',
        order.cancellation_reason || '-',
        order.refund_reason || '-'
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filterSuffix = paymentTypeFilter !== 'all' ? `-${paymentTypeFilter}` : '';
    a.download = `orders${filterSuffix}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportDetailedCSV = () => {
    const headers = [
      'Order #',
      'Date',
      'Customer',
      'Outlet',
      'Item Name',
      'Quantity',
      'Unit Price',
      'Item Subtotal',
      'Item Voucher Disc.',
      'Item Tier Disc.',
      'Item Total',
      'Modifiers',
      'Order Gross Sales',
      'Order Disc. Voucher',
      'Order Disc. Bonus',
      'Order Disc. Others',
      'Order Total Paid',
      'Payment Method',
      'Voucher Code',
      'Payment Status',
      'Fulfillment Status'
    ];

    const rows: string[][] = [];

    filteredOrders.forEach(order => {
      const paymentMethodConfig = getPaymentMethodConfig(order.payment_method);
      const paymentStatusConfig = getPaymentStatusConfig(order.payment_status as PaymentStatus);
      const fulfillmentStatusConfig = getFulfillmentStatusConfig(order.status as FulfillmentStatus);

      order.items.forEach((item: OrderItem, itemIndex: number) => {
        const modifiers = getFormattedModifiers(item);
        const originalSubtotal = getItemOriginalSubtotal(item);
        const finalPrice = getItemFinalPrice(item);
        const voucherDiscount = getItemVoucherDiscount(item);
        const tierDiscount = getItemTierDiscount(item);

        rows.push([
          order.order_number || order.id.slice(0, 8),
          formatDateTimeCMS(order.created_at),
          order.users?.name || 'Guest',
          order.outlets?.name || '-',
          item.product_name,
          item.quantity.toString(),
          `RM ${(item.unit_price || 0).toFixed(2)}`,
          `RM ${originalSubtotal.toFixed(2)}`,
          `-RM ${voucherDiscount.toFixed(2)}`,
          `-RM ${tierDiscount.toFixed(2)}`,
          `RM ${finalPrice.toFixed(2)}`,
          modifiers.join('; ') || 'None',
          itemIndex === 0 ? `RM ${(order.gross_sales || order.subtotal || 0).toFixed(2)}` : '',
          itemIndex === 0 ? `-RM ${(order.discount_amount || 0).toFixed(2)}` : '',
          itemIndex === 0 ? `-RM ${(order.bonus_discount_amount || 0).toFixed(2)}` : '',
          itemIndex === 0 ? `-RM ${(order.permanent_discount_amount || 0).toFixed(2)}` : '',
          itemIndex === 0 ? `RM ${parseFloat(order.total_amount.toString()).toFixed(2)}` : '',
          itemIndex === 0 ? paymentMethodConfig.label : '',
          itemIndex === 0 ? (order.voucher_code || '-') : '',
          itemIndex === 0 ? paymentStatusConfig.label : '',
          itemIndex === 0 ? fulfillmentStatusConfig.label : ''
        ]);
      });
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filterSuffix = paymentTypeFilter !== 'all' ? `-${paymentTypeFilter}` : '';
    a.download = `orders-detailed${filterSuffix}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getFulfillmentStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: any }> = {
      waiting_payment: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
      ready: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Package },
      completed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
      refunded: { bg: 'bg-orange-100', text: 'text-orange-700', icon: DollarSign }
    };
    return configs[status] || configs.waiting_payment;
  };

  const getPaymentTypeConfig = (paymentType: string) => {
    const configs: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      payment: { bg: 'bg-[#28C76F]', text: 'text-[#0d4a2a]', icon: CreditCard, label: 'Payment' },
      deduction: { bg: 'bg-[#FF9F43]', text: 'text-[#7a4a1b]', icon: Wallet, label: 'Deduction' },
      redemption: { bg: 'bg-[#7367F0]', text: 'text-[#2e2a5e]', icon: Gift, label: 'Redemption' },
      topup: { bg: 'bg-[#20C997]', text: 'text-[#0d5442]', icon: Wallet, label: 'Topup' }
    };
    return configs[paymentType] || configs.deduction;
  };

  const getItemsRedemptionRatio = (order: OrderWithDetails) => {
    const totalItems = order.items.length;

    if (!order.order_item_redemptions || order.order_item_redemptions.length === 0) {
      return { redeemed: 0, total: totalItems, text: `0/${totalItems}`, color: 'text-black', bgColor: 'bg-[#EA5455]' };
    }

    const redeemedCount = order.order_item_redemptions.filter(r => r.status === 'completed').length;
    const isFullyRedeemed = redeemedCount === totalItems;
    const isPartial = redeemedCount > 0 && redeemedCount < totalItems;

    return {
      redeemed: redeemedCount,
      total: totalItems,
      text: `${redeemedCount}/${totalItems}`,
      color: isFullyRedeemed ? 'text-black' : isPartial ? 'text-black' : 'text-black',
      bgColor: isFullyRedeemed ? 'bg-[#32CC7E]' : isPartial ? 'bg-[#39C0ED]' : 'bg-[#EA5455]'
    };
  };

  const stats = {
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => o.status === 'pending').length,
    ready: filteredOrders.filter(o => o.status === 'ready').length,
    completed: filteredOrders.filter(o => o.status === 'completed').length,
    revenue: filteredOrders.filter(o => o.payment_type === 'payment').reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0),
    deductions: filteredOrders.filter(o => o.payment_type === 'deduction').reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0),
    redemptions: filteredOrders.filter(o => o.payment_type === 'redemption').length
  };

  const getPendingRedemptionsCount = (order: OrderWithDetails) => {
    return order.order_item_redemptions?.filter(r => r.status === 'pending').length || 0;
  };

  if (loading) {
    return (
      <CMSLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </CMSLayout>
    );
  }

  return (
    <CMSLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Orders Management</h1>
            <p className="text-gray-600 font-medium">View and manage all customer orders</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/cms/ai-insights')}
              className="relative flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg overflow-hidden group"
              style={{
                animation: 'glow 2s ease-in-out infinite'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Sparkles className="w-5 h-5 relative z-10 animate-pulse" />
              <span className="relative z-10">AI Insights</span>
            </button>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
              >
                <Download className="w-5 h-5" />
                Export Summary
              </button>
              <button
                onClick={exportDetailedCSV}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
                title="Export with item-level breakdown"
              >
                <FileText className="w-5 h-5" />
                Detailed Export
              </button>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes glow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(168, 85, 247, 0.4), 0 0 30px rgba(236, 72, 153, 0.3), 0 0 40px rgba(59, 130, 246, 0.2);
            }
            50% {
              box-shadow: 0 0 30px rgba(168, 85, 247, 0.6), 0 0 45px rgba(236, 72, 153, 0.5), 0 0 60px rgba(59, 130, 246, 0.4);
            }
          }
        `}</style>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-600 mb-1">Total Orders</p>
                <p className="text-3xl font-black text-gray-900">{stats.total}</p>
              </div>
              <ShoppingBag className="w-12 h-12 text-gray-300" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-green-700 mb-1">Real Revenue</p>
                <p className="text-2xl font-black text-green-900">RM {stats.revenue.toFixed(2)}</p>
              </div>
              <CreditCard className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-blue-700 mb-1">W Balance Deductions</p>
                <p className="text-2xl font-black text-blue-900">RM {stats.deductions.toFixed(2)}</p>
              </div>
              <Wallet className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-purple-700 mb-1">Stamp Redemptions</p>
                <p className="text-3xl font-black text-purple-900">{stats.redemptions}</p>
              </div>
              <Gift className="w-12 h-12 text-purple-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border-2 border-yellow-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-yellow-700 mb-1">Pending</p>
                <p className="text-3xl font-black text-yellow-900">{stats.pending}</p>
              </div>
              <Clock className="w-12 h-12 text-yellow-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-700 mb-1">Completed</p>
                <p className="text-3xl font-black text-gray-900">{stats.completed}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-gray-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-700">Payment Type:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentTypeFilter('all')}
                className={`px-4 py-2 rounded-xl font-bold transition-all ${paymentTypeFilter === 'all'
                  ? 'bg-gray-900 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                All Orders
              </button>
              <button
                onClick={() => setPaymentTypeFilter('payment')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${paymentTypeFilter === 'payment'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
              >
                <CreditCard className="w-4 h-4" />
                Payments
              </button>
              <button
                onClick={() => setPaymentTypeFilter('deduction')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${paymentTypeFilter === 'deduction'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
              >
                <Wallet className="w-4 h-4" />
                Deductions
              </button>
              <button
                onClick={() => setPaymentTypeFilter('redemption')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${paymentTypeFilter === 'redemption'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
              >
                <Gift className="w-4 h-4" />
                Redemptions
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by order #, customer name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
              >
                <option value="all">All Payment Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
              >
                <option value="all">All Fulfillment</option>
                <option value="waiting_payment">Waiting Payment</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-500" />
              <select
                value={outletFilter}
                onChange={(e) => setOutletFilter(e.target.value)}
                className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-bold"
              >
                <option value="all">All Outlets</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
              />
              <span className="text-gray-500 font-bold">to</span>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
              />
            </div>
          </div>
        </div>

        {/* Bulk Delete Bar */}
        {selectedOrderIds.size > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-red-700">
                {selectedOrderIds.size} order(s) selected
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedOrderIds(new Set())}
                className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={bulkDeleteOrders}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : `Delete ${selectedOrderIds.size} Order(s)`}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-12 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-bold text-gray-900 uppercase">Order</th>
                  <th className="text-left px-4 py-4 text-xs font-bold text-gray-900 uppercase">Date</th>
                  <th className="text-left px-4 py-4 text-xs font-bold text-gray-900 uppercase">Customer</th>
                  <th className="text-left px-4 py-4 text-xs font-bold text-gray-900 uppercase">Outlet</th>
                  <th className="text-left px-4 py-4 text-xs font-bold text-gray-900 uppercase">Items</th>
                  <th className="text-right px-4 py-4 text-xs font-bold text-gray-900 uppercase">Gross Sales</th>
                  <th className="text-right px-4 py-4 text-xs font-bold text-red-600 uppercase">
                    <div className="flex items-center justify-end gap-1">
                      Disc. Voucher
                    </div>
                  </th>
                  <th className="text-right px-4 py-4 text-xs font-bold text-orange-600 uppercase">
                    <div className="flex items-center justify-end gap-1">
                      Disc. Bonus
                    </div>
                  </th>
                  <th className="text-right px-4 py-4 text-xs font-bold text-blue-600 uppercase">
                    <div className="flex items-center justify-end gap-1">
                      Disc. Others
                    </div>
                  </th>
                  <th className="text-right px-4 py-4 text-xs font-bold text-green-700 uppercase">
                    <div className="flex items-center justify-end gap-1">
                      Total Paid
                    </div>
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-bold text-gray-900 uppercase">Payment Status</th>
                  <th className="text-left px-4 py-4 text-xs font-bold text-gray-900 uppercase">Fulfillment Status</th>
                  <th className="text-center px-4 py-4 text-xs font-bold text-gray-900 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-12 text-center">
                      <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No orders found</p>
                      <p className="text-sm text-gray-500 mt-1">Orders will appear here when customers place them</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const paymentStatusConfig = getPaymentStatusConfig(order.payment_status as PaymentStatus);
                    const PaymentStatusIcon = paymentStatusConfig.icon;
                    const fulfillmentStatusConfig = getFulfillmentStatusConfig(order.status as FulfillmentStatus);
                    const FulfillmentStatusIcon = fulfillmentStatusConfig.icon;
                    const pendingRedemptions = getPendingRedemptionsCount(order);
                    const paymentMethodConfig = getPaymentMethodConfig(order.payment_method);
                    const PaymentMethodIcon = paymentMethodConfig.icon;

                    return (
                      <tr
                        key={order.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedOrderIds.has(order.id) ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowDetailModal(true);
                        }}
                      >
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.has(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <OrderNumberLink
                              orderNumber={order.order_number || order.id.slice(0, 8)}
                              className="text-sm"
                            />
                            {order.payment_type && (() => {
                              const paymentConfig = getPaymentTypeConfig(order.payment_type);
                              const PaymentIcon = paymentConfig.icon;
                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${paymentConfig.bg} ${paymentConfig.text} w-fit`}>
                                  <PaymentIcon className="w-3 h-3" />
                                  {paymentConfig.label}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs font-bold text-gray-900 font-mono">
                            {formatDateTimeCMS(order.created_at)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {order.users?.name || 'Guest'}
                            </p>
                            <p className="text-xs text-gray-600">{order.users?.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-bold text-gray-900">
                            {order.outlets?.name || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {(() => {
                            const ratio = getItemsRedemptionRatio(order);
                            return (
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-sm font-bold ${ratio.bgColor} ${ratio.color} w-fit`}>
                                  {ratio.text}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-bold text-gray-900">
                            {formatCurrency(order.gross_sales || order.subtotal)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-bold text-red-600">
                            {formatDiscountAmount(order.discount_amount || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-bold text-orange-600">
                            {formatDiscountAmount(order.bonus_discount_amount || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-bold text-blue-600">
                            {formatDiscountAmount(order.permanent_discount_amount || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-bold text-green-700">
                              {formatCurrency(order.total_amount)}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${paymentMethodConfig.bgColor} ${paymentMethodConfig.color}`}>
                              <PaymentMethodIcon className="w-3 h-3" />
                              {paymentMethodConfig.shortLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${paymentStatusConfig.bgColor} ${paymentStatusConfig.color} w-fit`}>
                              <PaymentStatusIcon className="w-3 h-3" />
                              {paymentStatusConfig.label}
                            </span>
                            {order.payment_error_code && (
                              <span className="text-xs text-red-600" title={order.payment_error_code}>
                                Error: {order.payment_error_code.slice(0, 20)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${fulfillmentStatusConfig.bgColor} ${fulfillmentStatusConfig.color} w-fit`}>
                            <FulfillmentStatusIcon className="w-3 h-3" />
                            {fulfillmentStatusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(order);
                                setShowDetailModal(true);
                              }}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteOrder(order.id);
                              }}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Order"
                              disabled={deleting}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showDetailModal && selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm overflow-y-auto"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-4xl w-full shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">Order Details</h2>
              <div className="flex items-center gap-2">
                {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'ready' || selectedOrder.status === 'completed') && (
                  <button
                    onClick={() => {
                      setReceiptOrderId(selectedOrder.id);
                      setShowReceiptModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                  >
                    <Receipt className="w-4 h-4" />
                    View Receipt
                  </button>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-6 h-6 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {selectedOrder.payment_type && (() => {
                const paymentConfig = getPaymentTypeConfig(selectedOrder.payment_type);
                const PaymentIcon = paymentConfig.icon;
                return (
                  <div className={`rounded-xl p-4 ${paymentConfig.bg} border-2 ${paymentConfig.bg.replace('bg-', 'border-')}`}>
                    <div className="flex items-center gap-3">
                      <PaymentIcon className={`w-6 h-6 ${paymentConfig.text}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-600">Payment Type</p>
                        <p className={`text-xl font-black ${paymentConfig.text}`}>{paymentConfig.label}</p>
                      </div>
                      <div className="ml-auto text-right">
                        {selectedOrder.payment_type === 'payment' && (
                          <div>
                            <p className="text-xs text-gray-600">Real Money Received</p>
                            <p className={`text-lg font-black ${paymentConfig.text}`}>RM {parseFloat(selectedOrder.total_amount.toString()).toFixed(2)}</p>
                          </div>
                        )}
                        {selectedOrder.payment_type === 'deduction' && (
                          <div>
                            <p className="text-xs text-gray-600">W Balance Deducted</p>
                            <p className={`text-lg font-black ${paymentConfig.text}`}>RM {parseFloat(selectedOrder.total_amount.toString()).toFixed(2)}</p>
                          </div>
                        )}
                        {selectedOrder.payment_type === 'redemption' && (
                          <div>
                            <p className="text-xs text-gray-600">Stamps/Rewards Used</p>
                            <p className={`text-lg font-black ${paymentConfig.text}`}>Free</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <FileText className="w-3 h-3 text-gray-600" />
                    <p className="text-xs font-bold text-gray-600">Order Number</p>
                  </div>
                  <OrderNumberLink
                    orderNumber={selectedOrder.order_number || selectedOrder.id.slice(0, 8)}
                    className="text-sm"
                  />
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3 text-gray-600" />
                    <p className="text-xs font-bold text-gray-600">Order Date & Time</p>
                  </div>
                  <p className="text-xs font-black text-gray-900 font-mono">
                    {formatDateTimeCMS(selectedOrder.created_at)}
                  </p>
                </div>

                {selectedOrder.qr_code && (
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <QrCode className="w-3 h-3 text-gray-600" />
                        <p className="text-xs font-bold text-gray-600">QR Code</p>
                      </div>
                      <div className="bg-white p-1 rounded inline-block">
                        <QRCodeDisplay value={selectedOrder.qr_code} size={60} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-3">
                <h3 className="text-sm font-black text-gray-900 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-gray-600 font-medium">Name</p>
                    <p className="font-bold text-gray-900">{selectedOrder.users?.name || 'Guest'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Email</p>
                    <p className="font-bold text-gray-900">{selectedOrder.users?.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Phone</p>
                    <p className="font-bold text-gray-900">{selectedOrder.users?.phone || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <h3 className="text-sm font-black text-gray-900 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Outlet Information
                </h3>
                <div className="text-xs">
                  <p className="font-bold text-gray-900">{selectedOrder.outlets?.name || '-'}</p>
                  <p className="text-gray-600 font-medium">{selectedOrder.outlets?.location || '-'}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <h3 className="text-sm font-black text-gray-900 mb-2 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Order Items & Detailed Pricing
                </h3>
                <div className="space-y-2">
                  {(selectedOrder.items || []).map((item: OrderItem, index) => {
                    const redemption = selectedOrder.order_item_redemptions?.find(r => r.item_index === index);
                    const modifiers = getFormattedModifiers(item);
                    const originalSubtotal = getItemOriginalSubtotal(item);
                    const finalPrice = getItemFinalPrice(item);
                    const voucherDiscount = getItemVoucherDiscount(item);
                    const tierDiscount = getItemTierDiscount(item);
                    const totalDiscount = getItemTotalDiscount(item);
                    const hasDiscount = hasItemDiscount(item);

                    return (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        {/* Product Name and Quantity - Compact Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">{item.product_name}</p>
                            {modifiers.length > 0 && (
                              <p className="text-xs text-gray-600 mt-0.5">
                                <span className="font-semibold">Options:</span> {modifiers.join(', ')}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-600 font-semibold ml-2">Qty: {item.quantity}</span>
                        </div>

                        {/* Compact Price Breakdown */}
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Subtotal ({item.quantity} × RM {(item.unit_price || 0).toFixed(2)})</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(originalSubtotal)}</span>
                          </div>

                          {voucherDiscount > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-red-600 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Voucher Discount
                              </span>
                              <span className="font-semibold text-red-600">{formatDiscountAmount(voucherDiscount)}</span>
                            </div>
                          )}

                          {tierDiscount > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-orange-600 flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                Tier Discount
                              </span>
                              <span className="font-semibold text-orange-600">{formatDiscountAmount(tierDiscount)}</span>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-1 border-t border-gray-300">
                            <span className="text-gray-900 font-bold">Item Total</span>
                            <span className="font-bold text-green-700">{formatCurrency(finalPrice)}</span>
                          </div>

                          {hasDiscount && (
                            <div className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded text-center">
                              Savings: {formatCurrency(totalDiscount)} 🎉
                            </div>
                          )}
                        </div>

                        {/* Compact Redemption Status */}
                        <div className="mt-2 pt-2 border-t border-gray-300 flex items-center justify-between">
                          {redemption ? (
                            <>
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Package className="w-3 h-3" />
                                <span className="font-semibold">{redemption.redeemed_quantity}/{redemption.quantity}</span>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${redemption.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                {redemption.status === 'completed' ? (
                                  <>
                                    <CheckCircle className="w-3 h-3" />
                                    Redeemed
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3" />
                                    Pending Pickup
                                  </>
                                )}
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                              <Clock className="w-3 h-3" />
                              Pending Pickup
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-black text-gray-900 mb-4">Financial Breakdown</h3>
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                  {(() => {
                    const grossSales = parseFloat((selectedOrder.gross_sales || selectedOrder.subtotal || 0).toString());
                    const totalPaid = parseFloat(selectedOrder.total_amount.toString());
                    const voucherDiscount = parseFloat((selectedOrder.discount_amount || 0).toString());
                    const bonusDiscount = parseFloat((selectedOrder.bonus_discount_amount || 0).toString());
                    const otherDiscount = parseFloat((selectedOrder.permanent_discount_amount || 0).toString());

                    const totalRecordedDiscounts = voucherDiscount + bonusDiscount + otherDiscount;
                    const actualTotalDiscount = grossSales - totalPaid;
                    const unaccountedDiscount = actualTotalDiscount - totalRecordedDiscounts;

                    const hasUnaccountedDiscount = Math.abs(unaccountedDiscount) > 0.01;

                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-base font-bold text-gray-700">Gross Sales (Before Discounts)</span>
                          <span className="text-base font-black text-gray-900">
                            {formatCurrency(grossSales)}
                          </span>
                        </div>

                        <div className="flex justify-between items-start border-t border-gray-200 pt-2">
                          <div className="flex-1">
                            <span className="text-base font-bold text-red-700">Disc. Voucher</span>
                            {selectedOrder.voucher_code && (
                              <p className="text-xs text-red-600 font-semibold mt-0.5">Code: {selectedOrder.voucher_code}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-0.5">Voucher/promo code discount</p>
                          </div>
                          <span className={`text-base font-black ${voucherDiscount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {formatDiscountAmount(voucherDiscount)}
                          </span>
                        </div>

                        <div className="flex justify-between items-start border-t border-gray-200 pt-2">
                          <div>
                            <span className="text-base font-bold text-orange-700">Disc. Bonus</span>
                            <p className="text-xs text-gray-500 mt-0.5">Bonus balance redeemed</p>
                          </div>
                          <span className={`text-base font-black ${bonusDiscount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {formatDiscountAmount(bonusDiscount)}
                          </span>
                        </div>

                        <div className="flex justify-between items-start border-t border-gray-200 pt-2">
                          <div>
                            <span className="text-base font-bold text-blue-700">Disc. Others</span>
                            <p className="text-xs text-gray-500 mt-0.5">Tier/permanent discounts</p>
                          </div>
                          <span className={`text-base font-black ${otherDiscount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                            {formatDiscountAmount(otherDiscount)}
                          </span>
                        </div>

                        {hasUnaccountedDiscount && (
                          <div className="flex justify-between items-start border-t border-gray-200 pt-2 bg-yellow-50 -mx-4 px-4 py-2">
                            <div>
                              <span className="text-base font-bold text-yellow-700">Unaccounted Discount</span>
                              <p className="text-xs text-yellow-600 mt-0.5">
                                Applied discount not recorded in breakdown (legacy order)
                              </p>
                            </div>
                            <span className="text-base font-black text-yellow-700">
                              {formatDiscountAmount(unaccountedDiscount)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between pt-3 border-t-2 border-gray-300">
                          <div>
                            <span className="text-xl font-black text-green-700">Total Paid</span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              via {getPaymentMethodConfig(selectedOrder.payment_method).label}
                            </p>
                          </div>
                          <span className="text-xl font-black text-green-700">
                            {formatCurrency(totalPaid)}
                          </span>
                        </div>

                        {hasUnaccountedDiscount && (
                          <div className="text-xs text-yellow-600 italic pt-2 border-t border-yellow-200">
                            Note: This order was created before the detailed discount tracking system was implemented.
                            The total discount of {formatCurrency(actualTotalDiscount)} has been applied correctly to the order.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {(selectedOrder.w_balance_after !== undefined || selectedOrder.bonus_balance_after !== undefined) && (
                <div className="border-t border-gray-200 pt-3">
                  <h3 className="text-sm font-black text-gray-900 mb-2 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Customer Wallet Balance After This Order
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                      <p className="text-xs text-blue-700 font-semibold mb-1">W Balance</p>
                      <p className="text-lg font-black text-blue-900">
                        RM {(selectedOrder.w_balance_after || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
                      <p className="text-xs text-amber-700 font-semibold mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Bonus Balance
                      </p>
                      <p className="text-lg font-black text-amber-900">
                        RM {(selectedOrder.bonus_balance_after || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      <span className="font-semibold">Total Available at That Time:</span>
                      <span className="font-black text-green-700">
                        RM {((selectedOrder.w_balance_after || 0) + (selectedOrder.bonus_balance_after || 0)).toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 italic mt-2">
                    * Balance snapshot captured when order was completed on <span className="font-mono">{selectedOrder.completed_at ? formatDateTimeCMS(selectedOrder.completed_at) : 'order completion'}</span>
                  </p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-black text-gray-900 mb-4">Fulfillment Status</h3>
                <div className="flex items-center gap-2">
                  {['waiting_payment', 'ready', 'completed', 'cancelled', 'refunded'].map((status) => {
                    const isCurrentStatus = selectedOrder.status === status;
                    const statusConfig = getFulfillmentStatusConfig(status);
                    const displayLabel = status === 'waiting_payment' ? 'Waiting' : status.charAt(0).toUpperCase() + status.slice(1);
                    return (
                      <button
                        key={status}
                        onClick={() => updateOrderStatus(selectedOrder.id, status)}
                        disabled={updatingStatus || isCurrentStatus}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all text-sm ${isCurrentStatus
                          ? `${statusConfig.bg} ${statusConfig.text} border-2 ${statusConfig.bg.replace('bg-', 'border-')}`
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-lg font-black text-gray-900 mb-2">Notes</h3>
                  <p className="text-base text-gray-700 bg-yellow-50 p-4 rounded-xl">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-black text-gray-900 mb-4">Activity Timeline</h3>
                <OrderTimeline order={selectedOrder} />
              </div>
            </div>
          </div>
        </div>
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
    </CMSLayout>
  );
};

export default CMSOrders;
