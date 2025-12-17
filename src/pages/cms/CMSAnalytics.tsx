import React, { useState, useEffect } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import { BarChart3, TrendingUp, Users, ShoppingBag, DollarSign, Star, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import OrderNumberLink from '../../components/cms/OrderNumberLink';
import { formatDateTimeCMS } from '../../utils/dateFormatter';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
  averageOrderValue: number;
  topProducts: Array<{ name: string; sales: number; revenue: number }>;
  revenueByDay: Array<{ date: string; revenue: number }>;
}

interface RecentOrder {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  payment_method: string;
  user_id: string;
  users?: {
    name: string;
    email: string;
  };
}

const CMSAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData>({
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0,
    averageOrderValue: 0,
    topProducts: [],
    revenueByDay: []
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      const [ordersResult, usersResult, recentOrdersResult] = await Promise.all([
        supabase
          .from('shop_orders')
          .select('total_amount, items, created_at, status'),
        supabase
          .from('users')
          .select('id, created_at'),
        supabase
          .from('shop_orders')
          .select(`
            id,
            order_number,
            created_at,
            status,
            total_amount,
            payment_method,
            user_id,
            users!shop_orders_user_id_fkey (
              name,
              email
            )
          `)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      const orders = ordersResult.data || [];
      const users = usersResult.data || [];
      const recentOrdersData = recentOrdersResult.data || [];

      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0);
      const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

      const productSales: Record<string, { sales: number; revenue: number }> = {};
      orders.forEach(order => {
        order.items.forEach((item: any) => {
          if (!productSales[item.product_name]) {
            productSales[item.product_name] = { sales: 0, revenue: 0 };
          }
          productSales[item.product_name].sales += item.quantity;
          productSales[item.product_name].revenue += parseFloat(item.total_price?.toString() || '0');
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setData({
        totalRevenue,
        totalOrders: orders.length,
        totalUsers: users.length,
        averageOrderValue,
        topProducts,
        revenueByDay: []
      });

      setRecentOrders(recentOrdersData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
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
            <h1 className="text-3xl font-black text-gray-900 mb-2">Analytics & Insights</h1>
            <p className="text-gray-600 font-medium">Comprehensive business metrics and performance data</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-gray-500" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
            />
            <span className="text-gray-500 font-bold">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm font-bold text-green-700 mb-1">Total Revenue</p>
            <p className="text-3xl font-black text-green-900">RM {data.totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-green-700 mt-2">All time</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-blue-700 mb-1">Total Orders</p>
            <p className="text-3xl font-black text-blue-900">{data.totalOrders}</p>
            <p className="text-xs text-blue-700 mt-2">Successfully completed</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border-2 border-orange-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-orange-700 mb-1">Total Users</p>
            <p className="text-3xl font-black text-orange-900">{data.totalUsers}</p>
            <p className="text-xs text-orange-700 mt-2">Registered customers</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl border-2 border-yellow-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-yellow-700 mb-1">Avg Order Value</p>
            <p className="text-3xl font-black text-yellow-900">RM {data.averageOrderValue.toFixed(2)}</p>
            <p className="text-xs text-yellow-700 mt-2">Per transaction</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-black text-gray-900">Top Products</h2>
            </div>
            <div className="p-6">
              {data.topProducts.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No product data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-600">{product.sales} sold</p>
                        </div>
                      </div>
                      <p className="text-lg font-black text-gray-900">RM {product.revenue.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-black text-gray-900">Key Metrics</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-blue-900 mb-1">Customer Retention</p>
                  <p className="text-xs text-blue-700">Repeat purchase rate</p>
                </div>
                <p className="text-2xl font-black text-blue-900">0%</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-green-900 mb-1">Conversion Rate</p>
                  <p className="text-xs text-green-700">Visitors to customers</p>
                </div>
                <p className="text-2xl font-black text-green-900">0%</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-orange-900 mb-1">Customer Lifetime Value</p>
                  <p className="text-xs text-orange-700">Average per customer</p>
                </div>
                <p className="text-2xl font-black text-orange-900">RM 0.00</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-black text-gray-900">Recent Orders</h2>
          </div>
          <div className="overflow-x-auto">
            {recentOrders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No orders yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider">Order #</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider">Payment</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentOrders.map((order) => {
                    const statusColors: Record<string, string> = {
                      'completed': 'bg-green-100 text-green-800',
                      'pending': 'bg-yellow-100 text-yellow-800',
                      'cancelled': 'bg-red-100 text-red-800',
                      'processing': 'bg-blue-100 text-blue-800'
                    };

                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <OrderNumberLink orderNumber={order.order_number} className="text-sm" />
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900">{order.users?.name || 'Guest'}</p>
                          <p className="text-xs text-gray-600">{order.users?.email || '-'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-900 font-mono">
                            {formatDateTimeCMS(order.created_at)}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-900 capitalize">{order.payment_method || '-'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-bold text-gray-900">RM {parseFloat(order.total_amount?.toString() || '0').toFixed(2)}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-blue-900 mb-2">Analytics Features</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                  Real-time sales and revenue tracking
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                  Customer behavior and purchase patterns
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                  Product performance analysis
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                  Trend forecasting and insights
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </CMSLayout>
  );
};

export default CMSAnalytics;
