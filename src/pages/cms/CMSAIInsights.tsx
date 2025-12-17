import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CMSLayout from '../../components/cms/CMSLayout';
import AIChatAssistant from '../../components/cms/AIChatAssistant';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Calendar,
  Clock,
  Award,
  Zap,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Sparkles
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface OrderAnalytics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueGrowth: number;
  ordersGrowth: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  revenueByPaymentMethod: Array<{ method: string; amount: number; count: number }>;
  revenueByOutlet: Array<{ outlet: string; amount: number; count: number }>;
  ordersByHour: Array<{ hour: number; count: number }>;
  ordersByDay: Array<{ day: string; count: number; revenue: number }>;
  ordersByStatus: Array<{ status: string; count: number; percentage: number }>;
  customerInsights: {
    totalCustomers: number;
    repeatCustomers: number;
    averageOrdersPerCustomer: number;
  };
  peakHours: Array<{ hour: number; orders: number }>;
  voucherUsage: {
    totalUsed: number;
    totalDiscount: number;
    averageDiscount: number;
  };
}

const CMSAIInsights: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startDate = new Date();

      if (timeRange === '7d') {
        startDate.setDate(now.getDate() - 7);
      } else if (timeRange === '30d') {
        startDate.setDate(now.getDate() - 30);
      } else if (timeRange === '90d') {
        startDate.setDate(now.getDate() - 90);
      } else {
        startDate.setFullYear(2000);
      }

      const { data: orders, error } = await supabase
        .from('shop_orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: outlets } = await supabase.from('outlets').select('id, name');
      const outletMap = new Map(outlets?.map(o => [o.id, o.name]) || []);

      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      const { data: prevOrders } = await supabase
        .from('shop_orders')
        .select('*')
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      const prevRevenue = prevOrders?.reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0) || 0;
      const prevOrderCount = prevOrders?.length || 0;

      const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
      const ordersGrowth = prevOrderCount > 0 ? ((totalOrders - prevOrderCount) / prevOrderCount) * 100 : 0;

      const productMap = new Map<string, { quantity: number; revenue: number }>();
      orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const name = item.product_name || 'Unknown';
            const existing = productMap.get(name) || { quantity: 0, revenue: 0 };
            productMap.set(name, {
              quantity: existing.quantity + (item.quantity || 0),
              revenue: existing.revenue + (item.total_price || item.total || 0)
            });
          });
        }
      });

      const topProducts = Array.from(productMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const paymentMethodMap = new Map<string, { amount: number; count: number }>();
      orders.forEach(order => {
        const method = order.payment_method || 'unknown';
        const existing = paymentMethodMap.get(method) || { amount: 0, count: 0 };
        paymentMethodMap.set(method, {
          amount: existing.amount + parseFloat(order.total_amount.toString()),
          count: existing.count + 1
        });
      });

      const revenueByPaymentMethod = Array.from(paymentMethodMap.entries())
        .map(([method, data]) => ({ method, ...data }))
        .sort((a, b) => b.amount - a.amount);

      const outletMap2 = new Map<string, { amount: number; count: number }>();
      orders.forEach(order => {
        const outletName = outletMap.get(order.outlet_id) || 'Unknown';
        const existing = outletMap2.get(outletName) || { amount: 0, count: 0 };
        outletMap2.set(outletName, {
          amount: existing.amount + parseFloat(order.total_amount.toString()),
          count: existing.count + 1
        });
      });

      const revenueByOutlet = Array.from(outletMap2.entries())
        .map(([outlet, data]) => ({ outlet, ...data }))
        .sort((a, b) => b.amount - a.amount);

      const hourMap = new Map<number, number>();
      orders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      });

      const ordersByHour = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourMap.get(i) || 0
      }));

      const dayMap = new Map<string, { count: number; revenue: number }>();
      orders.forEach(order => {
        const day = new Date(order.created_at).toLocaleDateString('en-US', { weekday: 'short' });
        const existing = dayMap.get(day) || { count: 0, revenue: 0 };
        dayMap.set(day, {
          count: existing.count + 1,
          revenue: existing.revenue + parseFloat(order.total_amount.toString())
        });
      });

      const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const ordersByDay = dayOrder.map(day => ({
        day,
        count: dayMap.get(day)?.count || 0,
        revenue: dayMap.get(day)?.revenue || 0
      }));

      const statusMap = new Map<string, number>();
      orders.forEach(order => {
        statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
      });

      const ordersByStatus = Array.from(statusMap.entries())
        .map(([status, count]) => ({
          status,
          count,
          percentage: (count / totalOrders) * 100
        }));

      const customerMap = new Map<string, number>();
      orders.forEach(order => {
        customerMap.set(order.user_id, (customerMap.get(order.user_id) || 0) + 1);
      });

      const totalCustomers = customerMap.size;
      const repeatCustomers = Array.from(customerMap.values()).filter(count => count > 1).length;
      const averageOrdersPerCustomer = totalCustomers > 0 ? totalOrders / totalCustomers : 0;

      const peakHours = ordersByHour
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const voucherOrders = orders.filter(o => o.voucher_code);
      const voucherUsage = {
        totalUsed: voucherOrders.length,
        totalDiscount: voucherOrders.reduce((sum, o) => sum + parseFloat(o.discount_amount?.toString() || '0'), 0),
        averageDiscount: voucherOrders.length > 0
          ? voucherOrders.reduce((sum, o) => sum + parseFloat(o.discount_amount?.toString() || '0'), 0) / voucherOrders.length
          : 0
      };

      setAnalytics({
        totalRevenue,
        totalOrders,
        averageOrderValue,
        revenueGrowth,
        ordersGrowth,
        topProducts,
        revenueByPaymentMethod,
        revenueByOutlet,
        ordersByHour,
        ordersByDay,
        ordersByStatus,
        customerInsights: {
          totalCustomers,
          repeatCustomers,
          averageOrdersPerCustomer
        },
        peakHours,
        voucherUsage
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `RM ${value.toFixed(2)}`;

  const getMaxValue = (data: Array<{ count: number }>) => {
    return Math.max(...data.map(d => d.count), 1);
  };

  if (loading) {
    return (
      <CMSLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mb-4"></div>
          <p className="text-gray-600 font-semibold">Analyzing order data...</p>
        </div>
      </CMSLayout>
    );
  }

  if (!analytics) {
    return (
      <CMSLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">No analytics data available</p>
        </div>
      </CMSLayout>
    );
  }

  return (
    <CMSLayout>
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/cms/orders')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-purple-600" />
                <h1 className="text-3xl font-black text-gray-900">AI Insights</h1>
              </div>
              <p className="text-gray-600 font-medium mt-1">Advanced analytics powered by your order data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  timeRange === range
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
                }`}
              >
                {range === 'all' ? 'All Time' : range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8" />
              <div className={`flex items-center gap-1 text-sm font-bold ${
                analytics.revenueGrowth >= 0 ? 'text-green-200' : 'text-red-200'
              }`}>
                {analytics.revenueGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(analytics.revenueGrowth).toFixed(1)}%
              </div>
            </div>
            <p className="text-sm font-semibold mb-1 text-blue-100">Total Revenue</p>
            <p className="text-3xl font-black">{formatCurrency(analytics.totalRevenue)}</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <ShoppingBag className="w-8 h-8" />
              <div className={`flex items-center gap-1 text-sm font-bold ${
                analytics.ordersGrowth >= 0 ? 'text-green-200' : 'text-red-200'
              }`}>
                {analytics.ordersGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(analytics.ordersGrowth).toFixed(1)}%
              </div>
            </div>
            <p className="text-sm font-semibold mb-1 text-green-100">Total Orders</p>
            <p className="text-3xl font-black">{analytics.totalOrders.toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Target className="w-8 h-8" />
              <Award className="w-6 h-6 text-purple-200" />
            </div>
            <p className="text-sm font-semibold mb-1 text-purple-100">Avg Order Value</p>
            <p className="text-3xl font-black">{formatCurrency(analytics.averageOrderValue)}</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8" />
              <Zap className="w-6 h-6 text-orange-200" />
            </div>
            <p className="text-sm font-semibold mb-1 text-orange-100">Total Customers</p>
            <p className="text-3xl font-black">{analytics.customerInsights.totalCustomers.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-black text-gray-900">Orders by Hour</h2>
            </div>
            <div className="space-y-2">
              {analytics.ordersByHour.filter(h => h.count > 0).map((item) => {
                const max = getMaxValue(analytics.ordersByHour);
                const percentage = (item.count / max) * 100;
                return (
                  <div key={item.hour} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-600 w-12">{item.hour}:00</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden relative">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 flex items-center justify-end px-3"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      >
                        <span className="text-xs font-bold text-white">{item.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-black text-gray-900">Orders by Day</h2>
            </div>
            <div className="space-y-3">
              {analytics.ordersByDay.map((item) => {
                const max = Math.max(...analytics.ordersByDay.map(d => d.count), 1);
                const percentage = (item.count / max) * 100;
                return (
                  <div key={item.day} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">{item.day}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-gray-600">{item.count} orders</span>
                        <span className="text-xs font-bold text-blue-600">{formatCurrency(item.revenue)}</span>
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-black text-gray-900">Top 10 Products</h2>
            </div>
            <div className="space-y-3">
              {analytics.topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                    index === 0 ? 'bg-yellow-400 text-yellow-900' :
                    index === 1 ? 'bg-gray-300 text-gray-700' :
                    index === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-600">{product.quantity} sold</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-green-600">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-black text-gray-900">Revenue by Payment Method</h2>
            </div>
            <div className="space-y-4">
              {analytics.revenueByPaymentMethod.map((method) => {
                const totalRevenue = analytics.revenueByPaymentMethod.reduce((sum, m) => sum + m.amount, 0);
                const percentage = (method.amount / totalRevenue) * 100;
                return (
                  <div key={method.method} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900 capitalize">{method.method}</span>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-900">{formatCurrency(method.amount)}</p>
                        <p className="text-xs text-gray-600">{method.count} orders</p>
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-black text-gray-900">Peak Hours</h2>
            </div>
            <div className="space-y-3">
              {analytics.peakHours.map((peak, index) => (
                <div key={peak.hour} className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-black">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-gray-900">{peak.hour}:00 - {peak.hour + 1}:00</p>
                    <p className="text-xs text-gray-600">{peak.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-black text-gray-900">Customer Insights</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-600 font-bold mb-1">Total Customers</p>
                <p className="text-2xl font-black text-blue-900">{analytics.customerInsights.totalCustomers}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <p className="text-xs text-green-600 font-bold mb-1">Repeat Customers</p>
                <p className="text-2xl font-black text-green-900">{analytics.customerInsights.repeatCustomers}</p>
                <p className="text-xs text-green-700 font-semibold mt-1">
                  {((analytics.customerInsights.repeatCustomers / analytics.customerInsights.totalCustomers) * 100).toFixed(1)}% retention
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <p className="text-xs text-purple-600 font-bold mb-1">Avg Orders/Customer</p>
                <p className="text-2xl font-black text-purple-900">{analytics.customerInsights.averageOrdersPerCustomer.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="w-6 h-6 text-pink-600" />
              <h2 className="text-xl font-black text-gray-900">Order Status</h2>
            </div>
            <div className="space-y-3">
              {analytics.ordersByStatus.map((status) => (
                <div key={status.status} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900 capitalize">{status.status}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-600">{status.count}</span>
                      <span className="text-xs font-black text-pink-600">{status.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-pink-500 to-rose-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${status.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Target className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-black text-gray-900">Revenue by Outlet</h2>
            </div>
            <div className="space-y-3">
              {analytics.revenueByOutlet.map((outlet) => {
                const totalRevenue = analytics.revenueByOutlet.reduce((sum, o) => sum + o.amount, 0);
                const percentage = (outlet.amount / totalRevenue) * 100;
                return (
                  <div key={outlet.outlet} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">{outlet.outlet}</span>
                      <div className="text-right">
                        <p className="text-sm font-black text-indigo-600">{formatCurrency(outlet.amount)}</p>
                        <p className="text-xs text-gray-600">{outlet.count} orders</p>
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-6 h-6" />
              <h2 className="text-xl font-black">Voucher Performance</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <p className="text-sm font-semibold mb-1 text-green-100">Total Vouchers Used</p>
                <p className="text-3xl font-black">{analytics.voucherUsage.totalUsed}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <p className="text-sm font-semibold mb-1 text-green-100">Total Discount Given</p>
                <p className="text-3xl font-black">{formatCurrency(analytics.voucherUsage.totalDiscount)}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <p className="text-sm font-semibold mb-1 text-green-100">Avg Discount per Voucher</p>
                <p className="text-3xl font-black">{formatCurrency(analytics.voucherUsage.averageDiscount)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AIChatAssistant />
    </CMSLayout>
  );
};

export default CMSAIInsights;
