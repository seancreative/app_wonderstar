import React, { useState, useEffect } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import { DollarSign, TrendingUp, Calendar, Download, CreditCard, Wallet, ShoppingBag, RefreshCw, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateTimeCMS } from '../../utils/dateFormatter';

interface FinancialStats {
  totalRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  todayRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  walletTopups: number;
  pendingPayments: number;
  paymentMethodBreakdown: Array<{ method: string; count: number; amount: number }>;
  successRate: number;
}

const CMSFinancial: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FinancialStats>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    todayRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    walletTopups: 0,
    pendingPayments: 0,
    paymentMethodBreakdown: [],
    successRate: 0
  });
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  useEffect(() => {
    loadFinancialData();
  }, [dateRange, quickFilter]);

  const applyQuickFilter = (filter: 'all' | 'today' | 'week' | 'month') => {
    setQuickFilter(filter);
    const now = new Date();

    if (filter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setDateRange({ start: today.toISOString().split('T')[0], end: '' });
    } else if (filter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateRange({ start: weekAgo.toISOString().split('T')[0], end: '' });
    } else if (filter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateRange({ start: monthStart.toISOString().split('T')[0], end: '' });
    } else {
      setDateRange({ start: '', end: '' });
    }
  };

  const loadFinancialData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [ordersResult, walletsResult, paymentsResult] = await Promise.all([
        supabase
          .from('shop_orders')
          .select('total_amount, created_at, status'),
        supabase
          .from('wallet_transactions')
          .select('amount, transaction_type, created_at')
          .eq('transaction_type', 'topup'),
        supabase
          .from('payment_transactions')
          .select('amount, status, created_at, payment_method')
      ]);

      const orders = ordersResult.data || [];
      const wallets = walletsResult.data || [];
      const payments = paymentsResult.data || [];

      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0);
      const monthlyRevenue = orders
        .filter(order => new Date(order.created_at) >= monthStart)
        .reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0);
      const weeklyRevenue = orders
        .filter(order => new Date(order.created_at) >= weekStart)
        .reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0);
      const todayRevenue = orders
        .filter(order => new Date(order.created_at) >= today)
        .reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0);

      const walletTopups = wallets.reduce((sum, w) => sum + parseFloat(w.amount?.toString() || '0'), 0);
      const pendingPayments = payments
        .filter(p => p.status === 'pending' || p.status === 'processing')
        .reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0);

      const methodBreakdown: Record<string, { count: number; amount: number }> = {};
      payments.forEach(p => {
        const method = p.payment_method || 'unknown';
        if (!methodBreakdown[method]) {
          methodBreakdown[method] = { count: 0, amount: 0 };
        }
        methodBreakdown[method].count++;
        methodBreakdown[method].amount += parseFloat(p.amount?.toString() || '0');
      });

      const paymentMethodBreakdown = Object.entries(methodBreakdown).map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount
      })).sort((a, b) => b.amount - a.amount);

      const successCount = payments.filter(p => p.status === 'success').length;
      const successRate = payments.length > 0 ? (successCount / payments.length) * 100 : 0;

      setStats({
        totalRevenue,
        monthlyRevenue,
        weeklyRevenue,
        todayRevenue,
        totalOrders: orders.length,
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        walletTopups,
        pendingPayments,
        paymentMethodBreakdown,
        successRate
      });

      const { data: transactions } = await supabase
        .from('payment_transactions')
        .select('*, users(name, email)')
        .order('created_at', { ascending: false })
        .limit(50);

      setRecentTransactions(transactions || []);
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const headers = ['Date', 'Type', 'Amount', 'Status', 'User'];
    const rows = recentTransactions.map(txn => [
      formatDateTimeCMS(txn.created_at),
      txn.payment_method || 'N/A',
      `RM ${parseFloat(txn.amount).toFixed(2)}`,
      txn.status,
      txn.users?.name || 'Unknown'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
            <h1 className="text-3xl font-black text-gray-900 mb-2">Financial Overview</h1>
            <p className="text-gray-600 font-medium">Track revenue, payments, and transactions</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadFinancialData()}
              className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
            >
              <Download className="w-5 h-5" />
              Export Report
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-gray-700">Quick Filters:</span>
            <button
              onClick={() => applyQuickFilter('all')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                quickFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => applyQuickFilter('today')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                quickFilter === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => applyQuickFilter('week')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                quickFilter === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => applyQuickFilter('month')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                quickFilter === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Month
            </button>
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
            <p className="text-3xl font-black text-green-900">RM {stats.totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-green-700 mt-2">{stats.totalOrders} orders</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-blue-700 mb-1">Monthly Revenue</p>
            <p className="text-3xl font-black text-blue-900">RM {stats.monthlyRevenue.toFixed(2)}</p>
            <p className="text-xs text-blue-700 mt-2">This month</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border-2 border-purple-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-purple-700 mb-1">Weekly Revenue</p>
            <p className="text-3xl font-black text-purple-900">RM {stats.weeklyRevenue.toFixed(2)}</p>
            <p className="text-xs text-purple-700 mt-2">Last 7 days</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border-2 border-orange-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <ShoppingBag className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-orange-700 mb-1">Today Revenue</p>
            <p className="text-3xl font-black text-orange-900">RM {stats.todayRevenue.toFixed(2)}</p>
            <p className="text-xs text-orange-700 mt-2">Today's earnings</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl border-2 border-yellow-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Wallet className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-yellow-700 mb-1">W Balance Topups</p>
            <p className="text-3xl font-black text-yellow-900">RM {stats.walletTopups.toFixed(2)}</p>
            <p className="text-xs text-yellow-700 mt-2">Customer topups</p>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl border-2 border-rose-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <CreditCard className="w-6 h-6 text-rose-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-rose-700 mb-1">Pending Payments</p>
            <p className="text-3xl font-black text-rose-900">RM {stats.pendingPayments.toFixed(2)}</p>
            <p className="text-xs text-rose-700 mt-2">Awaiting completion</p>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl border-2 border-teal-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <ShoppingBag className="w-6 h-6 text-teal-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-teal-700 mb-1">Avg Order Value</p>
            <p className="text-3xl font-black text-teal-900">RM {stats.averageOrderValue.toFixed(2)}</p>
            <p className="text-xs text-teal-700 mt-2">Per transaction</p>
          </div>

          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-2xl border-2 border-cyan-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <TrendingUp className="w-6 h-6 text-cyan-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-cyan-700 mb-1">Success Rate</p>
            <p className="text-3xl font-black text-cyan-900">{stats.successRate.toFixed(1)}%</p>
            <p className="text-xs text-cyan-700 mt-2">Payment success</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-black text-gray-900">Payment Method Breakdown</h2>
          </div>
          <div className="p-6">
            {stats.paymentMethodBreakdown.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No payment data available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.paymentMethodBreakdown.map((method) => (
                  <div key={method.method} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-white rounded-lg">
                        <CreditCard className="w-5 h-5 text-gray-600" />
                      </div>
                      <span className="text-xs font-bold text-gray-600">{method.count} txns</span>
                    </div>
                    <p className="text-xs font-bold text-gray-600 uppercase mb-1">{method.method}</p>
                    <p className="text-2xl font-black text-gray-900">RM {method.amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-gray-900">Recent Transactions</h2>
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </select>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All Methods</option>
                  <option value="fpx">FPX</option>
                  <option value="tng">Touch n Go</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="grabpay">GrabPay</option>
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">User</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Method</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Amount</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions
                  .filter(txn => statusFilter === 'all' || txn.status === statusFilter)
                  .filter(txn => methodFilter === 'all' || txn.payment_method === methodFilter)
                  .length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No transactions match the selected filters</p>
                    </td>
                  </tr>
                ) : (
                  recentTransactions
                    .filter(txn => statusFilter === 'all' || txn.status === statusFilter)
                    .filter(txn => methodFilter === 'all' || txn.payment_method === methodFilter)
                    .map((txn) => (
                    <tr key={txn.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {formatDateTimeCMS(txn.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {txn.users?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {txn.payment_method || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        RM {parseFloat(txn.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          txn.status === 'success' ? 'bg-green-100 text-green-700' :
                          txn.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CMSLayout>
  );
};

export default CMSFinancial;
