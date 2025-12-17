import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import CMSLayout from '../../components/cms/CMSLayout';
import { supabase } from '../../lib/supabase';
import {
  ShoppingBag,
  Users,
  DollarSign,
  Star,
  TrendingUp,
  Clock,
  Package,
  Award,
  ArrowRight,
  Eye,
  RefreshCw,
  Database,
  CheckCircle,
  XCircle,
  Sparkles,
  ExternalLink,
  Info
} from 'lucide-react';
import { getPaymentMethodConfig, formatDiscountAmount, formatCurrency } from '../../utils/paymentMethodUtils';
import OrderNumberLink from '../../components/cms/OrderNumberLink';
import { formatCMSDateTime } from '../../utils/dateTimeUtils';

interface DashboardStats {
  totalRevenue: number;
  todayRevenue: number;
  totalOrders: number;
  todayOrders: number;
  pendingRedemptions: number;
  totalUsers: number;
  newUsersToday: number;
  totalStarsDistributed: number;
}

const CMSDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { admin, loading: adminLoading } = useAdminAuth();
  const { staff, loading: staffLoading } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    todayRevenue: 0,
    totalOrders: 0,
    todayOrders: 0,
    pendingRedemptions: 0,
    totalUsers: 0,
    newUsersToday: 0,
    totalStarsDistributed: 0
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const authLoading = adminLoading || staffLoading;
  const currentUser = admin || staff;
  const isStaff = !admin && !!staff;

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate('/cms/login');
      return;
    }

    // Check staff permissions
    if (isStaff && staff?.role === 'manager') {
      const permissions = (staff as any).assigned_permissions || {};
      if (!permissions.dashboard) {
        navigate('/cms/unauthorized');
        return;
      }
    }

    if (currentUser) {
      loadDashboardData();
    }
  }, [admin, staff, authLoading, navigate]);

  const loadDashboardData = async (isManualSync = false) => {
    try {
      if (isManualSync) {
        setSyncing(true);
        setSyncSuccess(null);
      }

      console.log('[CMSDashboard] Starting to load dashboard data...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        ordersResult,
        usersResult,
        starsResult,
        redemptionsResult,
        recentOrdersResult
      ] = await Promise.all([
        supabase
          .from('shop_orders')
          .select('total_amount, created_at'),
        supabase
          .from('users')
          .select('id, created_at'),
        supabase
          .from('stars_transactions')
          .select('amount')
          .eq('transaction_type', 'earn'),
        supabase
          .from('order_item_redemptions')
          .select('id')
          .eq('status', 'pending'),
        supabase
          .from('shop_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      console.log('[CMSDashboard] Orders count:', ordersResult.data?.length || 0);
      console.log('[CMSDashboard] Orders error:', ordersResult.error);
      console.log('[CMSDashboard] Recent orders count:', recentOrdersResult.data?.length || 0);
      console.log('[CMSDashboard] Recent orders error:', recentOrdersResult.error);
      console.log('[CMSDashboard] Sample recent order:', recentOrdersResult.data?.[0]);

      const orders = ordersResult.data || [];
      const users = usersResult.data || [];
      const stars = starsResult.data || [];
      const redemptions = redemptionsResult.data || [];

      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
      const todayRevenue = orders
        .filter(order => new Date(order.created_at) >= today)
        .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

      const todayOrders = orders.filter(order => new Date(order.created_at) >= today).length;
      const newUsersToday = users.filter(user => new Date(user.created_at) >= today).length;
      const totalStarsDistributed = stars.reduce((sum, s) => sum + s.amount, 0);

      setStats({
        totalRevenue,
        todayRevenue,
        totalOrders: orders.length,
        todayOrders,
        pendingRedemptions: redemptions.length,
        totalUsers: users.length,
        newUsersToday,
        totalStarsDistributed
      });

      // Enrich recent orders with user and outlet data
      const recentOrders = recentOrdersResult.data || [];
      if (recentOrders.length > 0) {
        const userIds = [...new Set(recentOrders.map(o => o.user_id).filter(Boolean))];
        const outletIds = [...new Set(recentOrders.map(o => o.outlet_id).filter(Boolean))];

        const [usersData, outletsData, redemptionsData] = await Promise.all([
          supabase.from('users').select('id, name, email').in('id', userIds),
          supabase.from('outlets').select('id, name').in('id', outletIds),
          supabase.from('order_item_redemptions').select('*').in('order_id', recentOrders.map(o => o.id))
        ]);

        const usersMap = new Map((usersData.data || []).map(u => [u.id, u]));
        const outletsMap = new Map((outletsData.data || []).map(o => [o.id, o]));
        const redemptionsMap = new Map<string, any[]>();
        (redemptionsData.data || []).forEach(r => {
          if (!redemptionsMap.has(r.order_id)) {
            redemptionsMap.set(r.order_id, []);
          }
          redemptionsMap.get(r.order_id)!.push(r);
        });

        const enrichedOrders = recentOrders.map(order => ({
          ...order,
          users: usersMap.get(order.user_id),
          outlets: outletsMap.get(order.outlet_id),
          order_item_redemptions: redemptionsMap.get(order.id) || []
        }));

        setRecentOrders(enrichedOrders);
      } else {
        setRecentOrders([]);
      }

      if (isManualSync) {
        setLastSyncTime(new Date());
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(null), 3000);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (isManualSync) {
        setSyncSuccess(false);
        setTimeout(() => setSyncSuccess(null), 3000);
      }
    } finally {
      setLoading(false);
      if (isManualSync) {
        setSyncing(false);
      }
    }
  };

  const handleSync = async () => {
    await loadDashboardData(true);
  };

  const getTimeSinceLastSync = () => {
    if (!lastSyncTime) return null;

    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours}h ago`;
    }
  };

  if (authLoading || loading) {
    return (
      <CMSLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </CMSLayout>
    );
  }

  const statCards = [
    {
      label: 'Total Revenue',
      value: `RM ${stats.totalRevenue.toFixed(2)}`,
      subValue: `Today: RM ${stats.todayRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders.toString(),
      subValue: `Today: ${stats.todayOrders}`,
      icon: ShoppingBag,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    {
      label: 'Pending Redemptions',
      value: stats.pendingRedemptions.toString(),
      subValue: 'Items awaiting pickup',
      icon: Package,
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700'
    },
    {
      label: 'Total Users',
      value: stats.totalUsers.toString(),
      subValue: `New today: ${stats.newUsersToday}`,
      icon: Users,
      color: 'from-purple-500 to-pink-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    {
      label: 'Stars Distributed',
      value: stats.totalStarsDistributed.toLocaleString(),
      subValue: 'Lifetime total',
      icon: Star,
      color: 'from-yellow-500 to-orange-600',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700'
    }
  ];

  const getStatusConfig = (status: string) => {
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
      payment: { bg: 'bg-[#28C76F]', text: 'text-[#0d4a2a]', icon: DollarSign, label: 'Payment' },
      deduction: { bg: 'bg-[#FF9F43]', text: 'text-[#7a4a1b]', icon: DollarSign, label: 'Deduction' },
      redemption: { bg: 'bg-[#7367F0]', text: 'text-[#2e2a5e]', icon: Award, label: 'Redemption' },
      topup: { bg: 'bg-[#20C997]', text: 'text-[#0d5442]', icon: DollarSign, label: 'Topup' }
    };
    return configs[paymentType] || configs.deduction;
  };

  const getItemsRedemptionRatio = (order: any) => {
    const totalItems = order.items?.length || 0;

    if (!order.order_item_redemptions || order.order_item_redemptions.length === 0) {
      return { redeemed: 0, total: totalItems, text: `0/${totalItems}`, color: 'text-black', bgColor: 'bg-[#EA5455]' };
    }

    const redeemedCount = order.order_item_redemptions.filter((r: any) => r.status === 'completed').length;
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

  return (
    <CMSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600 font-medium">Welcome back, {admin?.name}!</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-600 rounded-lg font-bold hover:border-gray-400 hover:text-gray-700 transition-all"
            >
              <ExternalLink className="w-5 h-5" />
              <span>View Site</span>
            </button>

            <button
              onClick={() => navigate('/cms/ai-insights')}
              className="relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white rounded-lg font-bold hover:scale-105 transition-all shadow-md overflow-hidden group"
              style={{
                animation: 'glow 2s ease-in-out infinite'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Sparkles className="w-5 h-5 relative z-10 animate-pulse" />
              <span className="relative z-10">AI Insights</span>
            </button>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-white transition-all shadow-md hover:shadow-lg ${
                  syncing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : syncSuccess === true
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    : syncSuccess === false
                    ? 'bg-gradient-to-r from-red-500 to-rose-600'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                }`}
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : syncSuccess === true ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Synced!</span>
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    <span>Sync with Database</span>
                  </>
                )}
              </button>
              {lastSyncTime && (
                <p className="text-xs text-gray-500 font-medium">
                  Last synced: {getTimeSinceLastSync()}
                </p>
              )}
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.textColor}`} />
                  </div>
                </div>
                <p className="text-sm text-gray-600 font-semibold mb-1">{stat.label}</p>
                <p className="text-2xl font-black text-gray-900 mb-1">{stat.value}</p>
                <p className="text-xs text-gray-500 font-medium">{stat.subValue}</p>
              </div>
            );
          })}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900">Recent Orders</h2>
            <button
              onClick={() => navigate('/cms/orders')}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors"
            >
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No orders yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Outlet
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Gross Sales
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-red-600 uppercase tracking-wider">
                      DV
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-orange-600 uppercase tracking-wider">
                      DB
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-blue-600 uppercase tracking-wider">
                      DO
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-green-700 uppercase tracking-wider group relative">
                      <div className="flex items-center justify-end gap-1">
                        Total Paid
                        <Info className="w-3 h-3 cursor-help" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentOrders.map((order) => {
                    const statusConfig = getStatusConfig(order.status);
                    const StatusIcon = statusConfig.icon;
                    const ratio = getItemsRedemptionRatio(order);
                    const paymentMethodConfig = getPaymentMethodConfig(order.payment_method);
                    const PaymentMethodIcon = paymentMethodConfig.icon;

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <OrderNumberLink orderNumber={order.order_number || order.id.slice(0, 8)} />
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
                          <p className="text-xs font-bold text-gray-900">
                            {formatCMSDateTime(order.created_at)}
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
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-sm font-bold ${ratio.bgColor} ${ratio.color} w-fit`}>
                              {ratio.text}
                            </span>
                          </div>
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
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => navigate('/cms/orders')}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/cms/orders')}
            className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl hover:scale-105 transition-transform text-left group"
          >
            <ShoppingBag className="w-8 h-8 mb-3 opacity-80 group-hover:opacity-100" />
            <h3 className="font-bold text-lg mb-1">Manage Orders</h3>
            <p className="text-sm opacity-80">View and process orders</p>
          </button>

          <button
            onClick={() => navigate('/cms/products')}
            className="p-6 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl hover:scale-105 transition-transform text-left group"
          >
            <Package className="w-8 h-8 mb-3 opacity-80 group-hover:opacity-100" />
            <h3 className="font-bold text-lg mb-1">Products</h3>
            <p className="text-sm opacity-80">Add and edit products</p>
          </button>

          <button
            onClick={() => navigate('/cms/customers')}
            className="p-6 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-2xl hover:scale-105 transition-transform text-left group"
          >
            <Users className="w-8 h-8 mb-3 opacity-80 group-hover:opacity-100" />
            <h3 className="font-bold text-lg mb-1">Customers</h3>
            <p className="text-sm opacity-80">Manage user accounts</p>
          </button>

          <button
            onClick={() => navigate('/cms/analytics')}
            className="p-6 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-2xl hover:scale-105 transition-transform text-left group"
          >
            <TrendingUp className="w-8 h-8 mb-3 opacity-80 group-hover:opacity-100" />
            <h3 className="font-bold text-lg mb-1">Analytics</h3>
            <p className="text-sm opacity-80">View reports and insights</p>
          </button>
        </div>
      </div>
    </CMSLayout>
  );
};

export default CMSDashboard;
