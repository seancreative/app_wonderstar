import React, { useState, useEffect } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import { DollarSign, TrendingUp, Calendar, Download, CreditCard, Wallet, ShoppingBag, RefreshCw, FileSpreadsheet, Gift, ChevronLeft, ChevronRight, PiggyBank, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import { getAllUsers, type WPayUser } from '../../lib/wpayApi';

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
  wBalanceDeductions: number;
  stampRedemptions: number;
  allOrdersCount: number;
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
    successRate: 0,
    wBalanceDeductions: 0,
    stampRedemptions: 0,
    allOrdersCount: 0
  });
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // New state for Laravel API data
  const [wpayUsers, setWpayUsers] = useState<WPayUser[]>([]);
  const [totalWalletBalance, setTotalWalletBalance] = useState(0);
  const [totalLifetimeTopups, setTotalLifetimeTopups] = useState(0);
  const [totalWallets, setTotalWallets] = useState(0);

  // State for WPay Topup Transactions from Laravel API
  const [wpayTopups, setWpayTopups] = useState<any[]>([]);
  const [topupsLoading, setTopupsLoading] = useState(false);
  const [topupDateRange, setTopupDateRange] = useState({ start: '', end: '' });
  const [topupCurrentPage, setTopupCurrentPage] = useState(1);
  const TOPUP_PAGE_SIZE = 20;

  useEffect(() => {
    loadFinancialStats();
    loadWPayUsers();
    loadWPayTopups();
  }, [dateRange, quickFilter]);

  useEffect(() => {
    loadWPayTopups();
  }, [topupDateRange]);

  useEffect(() => {
    loadTransactions();
  }, [dateRange]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, methodFilter, paymentTypeFilter]);

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

  // Fetch users from Laravel API
  const loadWPayUsers = async () => {
    try {
      const { users } = await getAllUsers();
      setWpayUsers(users);
      setTotalWallets(users.length);

      // Calculate total balance and lifetime topups
      let totalBalance = 0;
      let totalTopups = 0;
      users.forEach(user => {
        totalBalance += parseFloat(String(user.wbalance || 0)) + parseFloat(String(user.bonus || 0));
        totalTopups += parseFloat(String(user.lifetime_topups || 0));
      });
      setTotalWalletBalance(totalBalance);
      setTotalLifetimeTopups(totalTopups);
    } catch (error) {
      console.error('Error loading WPay users:', error);
    }
  };

  // Fetch topup transactions from Laravel API
  const loadWPayTopups = async () => {
    try {
      setTopupsLoading(true);
      const response = await fetch('https://app.aigenius.com.my/wpay/admin/transactions?payment_category=topup&status=success');
      const data = await response.json();

      let filtered = data.transactions || [];

      // Apply date filtering
      if (topupDateRange.start) {
        filtered = filtered.filter((t: any) => {
          const txnDate = new Date(t.created_at);
          return txnDate >= new Date(topupDateRange.start);
        });
      }
      if (topupDateRange.end) {
        filtered = filtered.filter((t: any) => {
          const txnDate = new Date(t.created_at);
          const endDate = new Date(topupDateRange.end);
          endDate.setHours(23, 59, 59, 999);
          return txnDate <= endDate;
        });
      }

      setWpayTopups(filtered);
      setTopupCurrentPage(1); // Reset to first page
    } catch (error) {
      console.error('Error loading WPay topups:', error);
    } finally {
      setTopupsLoading(false);
    }
  };

  const loadFinancialStats = async () => {
    try {
      setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Build queries with date filters
      let ordersQuery = supabase
        .from('shop_orders')
        .select('total_amount, created_at, status, payment_status, payment_method, payment_type');

      let walletsQuery = supabase
        .from('wallet_transactions')
        .select('amount, transaction_type, status, created_at')
        .eq('transaction_type', 'topup')
        .eq('status', 'completed');

      // Apply date filters
      if (dateRange.start) {
        ordersQuery = ordersQuery.gte('created_at', dateRange.start);
        walletsQuery = walletsQuery.gte('created_at', dateRange.start);
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        ordersQuery = ordersQuery.lte('created_at', endDate.toISOString());
        walletsQuery = walletsQuery.lte('created_at', endDate.toISOString());
      }

      const [ordersResult, walletsResult] = await Promise.all([
        ordersQuery,
        walletsQuery
      ]);

      const allOrders = ordersResult.data || [];
      // Match CMSOrders logic: revenue = orders where payment_type = 'payment' (ALL such orders, not just paid)
      const paymentOrders = allOrders.filter(o => o.payment_type === 'payment');
      // Deductions = orders where payment_type = 'deduction' (W-Balance)
      const deductionOrders = allOrders.filter(o => o.payment_type === 'deduction');
      const wallets = walletsResult.data || [];

      // Total revenue from all payment type orders
      const totalRevenue = paymentOrders.reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0);
      const monthlyRevenue = paymentOrders
        .filter(order => new Date(order.created_at) >= monthStart)
        .reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0);
      const weeklyRevenue = paymentOrders
        .filter(order => new Date(order.created_at) >= weekStart)
        .reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0);
      const todayRevenue = paymentOrders
        .filter(order => new Date(order.created_at) >= today)
        .reduce((sum, order) => sum + parseFloat(order.total_amount?.toString() || '0'), 0);

      const walletTopups = wallets.reduce((sum, w) => sum + parseFloat(w.amount?.toString() || '0'), 0);

      // Pending payments from orders that are waiting payment
      const pendingPayments = allOrders
        .filter(o => o.payment_status === 'pending')
        .reduce((sum, o) => sum + parseFloat(o.total_amount?.toString() || '0'), 0);

      // Payment method breakdown from shop_orders (for payment type orders)
      const methodBreakdown: Record<string, { count: number; amount: number }> = {};
      paymentOrders.forEach((order: any) => {
        const method = order.payment_method || 'unknown';
        if (!methodBreakdown[method]) {
          methodBreakdown[method] = { count: 0, amount: 0 };
        }
        methodBreakdown[method].count++;
        methodBreakdown[method].amount += parseFloat(order.total_amount?.toString() || '0');
      });

      const paymentMethodBreakdown = Object.entries(methodBreakdown).map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount
      })).sort((a, b) => b.amount - a.amount);

      const paidCount = allOrders.filter(o => o.payment_status === 'paid').length;
      const successRate = allOrders.length > 0 ? (paidCount / allOrders.length) * 100 : 0;

      // W-Balance deductions total
      const wBalanceDeductions = deductionOrders.reduce((sum, o) => sum + parseFloat(o.total_amount?.toString() || '0'), 0);

      // Stamp redemptions count
      const redemptionOrders = allOrders.filter(o => o.payment_type === 'redemption');
      const stampRedemptions = redemptionOrders.length;

      setStats({
        totalRevenue,
        monthlyRevenue,
        weeklyRevenue,
        todayRevenue,
        totalOrders: paymentOrders.length,
        averageOrderValue: paymentOrders.length > 0 ? totalRevenue / paymentOrders.length : 0,
        walletTopups,
        pendingPayments,
        paymentMethodBreakdown,
        successRate,
        wBalanceDeductions,
        stampRedemptions,
        allOrdersCount: allOrders.length
      });

      // Transactions loaded in loadTransactions
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);

      // Load ALL recent transactions (limit 2000) for client-side filtering
      // This ensures we can calculate totals accurately for the filtered set
      let transactionsQuery = supabase
        .from('shop_orders')
        .select('id, user_id, order_number, total_amount, gross_sales, discount_amount, bonus_discount_amount, created_at, payment_status, payment_method, payment_type, voucher_code')
        .order('created_at', { ascending: false })
        .limit(2000);

      // DB Filters (Date only)
      if (dateRange.start) {
        transactionsQuery = transactionsQuery.gte('created_at', dateRange.start);
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        transactionsQuery = transactionsQuery.lte('created_at', endDate.toISOString());
      }

      const { data: transactionsData } = await transactionsQuery;
      const transactions = transactionsData || [];

      // Manually fetch users to ensure data reliability (joins can sometimes be tricky with permissions or nulls)
      const userIds = [...new Set(transactions.map((t: any) => t.user_id).filter(Boolean))];

      let usersMap = new Map();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, email, phone')
          .in('id', userIds);

        if (users) {
          usersMap = new Map(users.map(u => [u.id, u]));
        }
      }

      const enrichedTransactions = transactions.map((t: any) => ({
        ...t,
        users: usersMap.get(t.user_id) || { name: 'Guest', email: '-' }
      }));

      setRecentTransactions(enrichedTransactions);
      setCurrentPage(1); // Reset to first page on load
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering - only show payment and topup types (income transactions)
  const filteredTransactions = recentTransactions
    .filter(txn => txn.payment_type === 'payment' || txn.payment_type === 'topup') // Only income types
    .filter(txn => statusFilter === 'all' || txn.payment_status === statusFilter)
    .filter(txn => methodFilter === 'all' || txn.payment_method === methodFilter)
    .filter(txn => paymentTypeFilter === 'all' || txn.payment_type === paymentTypeFilter);

  // Client-side pagination calculations
  const totalTransactions = filteredTransactions.length;
  const totalPages = Math.ceil(totalTransactions / PAGE_SIZE) || 1;
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const exportToExcel = () => {
    // Create CSV content with BOM for Excel to recognize UTF-8
    const BOM = '\uFEFF';

    const sections = [];

    // Section 1: Supabase Transactions (existing)
    sections.push(['=== SUPABASE TRANSACTIONS (Shop Orders) ===', '', '', '', '', '', '', '', '', '', '']);
    sections.push(['Date', 'Time', 'Payment Method', 'Payment Type', 'Amount (RM)', 'Status', 'User Name', 'User Email', 'Order ID', '', '']);

    filteredTransactions.forEach(txn => {
      const date = new Date(txn.created_at);
      sections.push([
        date.toLocaleDateString('en-MY'),
        date.toLocaleTimeString('en-MY'),
        txn.payment_method || 'N/A',
        txn.payment_type || 'N/A',
        parseFloat(txn.total_amount || 0).toFixed(2),
        txn.payment_status || 'N/A',
        txn.users?.name || 'Unknown',
        txn.users?.email || 'N/A',
        txn.id,
        '',
        ''
      ]);
    });

    // Empty row separator
    sections.push(['', '', '', '', '', '', '', '', '', '', '']);

    // Section 2: WPay Topup Transactions (from Laravel API)
    sections.push(['=== WPAY TOPUP TRANSACTIONS (Laravel WPay API) ===', '', '', '', '', '', '', '', '', '', '']);
    sections.push(['Order ID', 'Fiuu Txn ID', 'Date', 'Time', 'Email', 'Amount Paid (RM)', 'Topup Amount (RM)', 'Bonus (RM)', 'Stars', 'Method', 'Status']);

    wpayTopups.forEach(topup => {
      const date = new Date(topup.created_at);
      sections.push([
        topup.order_id || 'N/A',
        topup.fiuu_transaction_id || 'N/A',
        date.toLocaleDateString('en-MY'),
        date.toLocaleTimeString('en-MY'),
        topup.email || 'N/A',
        parseFloat(topup.amount || 0).toFixed(2),
        parseFloat(topup.topup_amount || 0).toFixed(2),
        parseFloat(topup.bonus_awarded || 0).toFixed(2),
        topup.stars_awarded || 0,
        topup.payment_method || 'online',
        topup.status || 'N/A'
      ]);
    });

    // Summary section
    sections.push(['', '', '', '', '', '', '', '', '', '', '']);
    sections.push(['=== SUMMARY ===', '', '', '', '', '', '', '', '', '', '']);
    sections.push(['Total Supabase Transactions:', filteredTransactions.length, '', '', '', '', '', '', '', '', '']);
    sections.push(['Total Supabase Amount:', `RM ${filteredTransactions.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0).toFixed(2)}`, '', '', '', '', '', '', '', '', '']);
    sections.push(['Total WPay Topups:', wpayTopups.length, '', '', '', '', '', '', '', '', '']);
    sections.push(['Total WPay Topup Amount Paid:', `RM ${wpayTopups.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0).toFixed(2)}`, '', '', '', '', '', '', '', '', '']);
    sections.push(['Total WPay Topup Amount Credited:', `RM ${wpayTopups.reduce((sum, t) => sum + parseFloat(t.topup_amount || 0), 0).toFixed(2)}`, '', '', '', '', '', '', '', '', '']);

    const csv = BOM + sections.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `financial-report-${dateStr}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportDetailedReport = () => {
    const BOM = '\uFEFF';

    const periodText = quickFilter === 'all' ? 'All Time' :
      quickFilter === 'today' ? 'Today' :
        quickFilter === 'week' ? 'This Week' : 'This Month';

    const rows = [
      ['Financial Summary Report', '', '', '', '', ''],
      ['Period:', periodText, '', '', '', ''],
      ['Generated:', new Date().toLocaleString('en-MY'), '', '', '', ''],
      ['', '', '', '', '', ''],
      ['--- KEY METRICS ---', '', '', '', '', ''],
      ['Total Sales (from Orders)', `RM ${stats.totalRevenue.toFixed(2)}`, '', '', '', ''],
      ['Total Wallet Topups (Count)', totalWallets.toString(), '', '', '', ''],
      ['Total Wallet Topups (Amount)', `RM ${totalLifetimeTopups.toFixed(2)}`, '', '', '', ''],
      ['Total W-Balance Spent', `RM ${stats.wBalanceDeductions.toFixed(2)}`, '', '', '', ''],
      ['Total Current Balance', `RM ${totalWalletBalance.toFixed(2)}`, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['--- REVENUE BREAKDOWN ---', '', '', '', '', ''],
      ['Monthly Revenue', `RM ${stats.monthlyRevenue.toFixed(2)}`, '', '', '', ''],
      ['Weekly Revenue', `RM ${stats.weeklyRevenue.toFixed(2)}`, '', '', '', ''],
      ['Today Revenue', `RM ${stats.todayRevenue.toFixed(2)}`, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['--- ORDER STATS ---', '', '', '', '', ''],
      ['Total Orders', stats.totalOrders.toString(), '', '', '', ''],
      ['Average Order Value', `RM ${stats.averageOrderValue.toFixed(2)}`, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['--- WALLET STATS ---', '', '', '', '', ''],
      ['Wallet Topups', `RM ${stats.walletTopups.toFixed(2)}`, '', '', '', ''],
      ['Pending Payments', `RM ${stats.pendingPayments.toFixed(2)}`, '', '', '', ''],
      ['Success Rate', `${stats.successRate.toFixed(1)}%`, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['--- PAYMENT METHOD BREAKDOWN ---', '', '', '', '', ''],
      ...stats.paymentMethodBreakdown.map(m => [
        m.method.toUpperCase(),
        `RM ${m.amount.toFixed(2)}`,
        `${m.count} transactions`,
        '',
        '',
        ''
      ])
    ];

    const csv = BOM + rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `financial-summary-${dateStr}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && recentTransactions.length === 0) {
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
              onClick={() => { loadFinancialStats(); loadTransactions(); loadWPayUsers(); loadWPayTopups(); }}
              className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading || topupsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportDetailedReport}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Summary Report
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
            >
              <Download className="w-5 h-5" />
              Export Transactions
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-gray-700">Quick Filters:</span>
            <button
              onClick={() => applyQuickFilter('all')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${quickFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              All Time
            </button>
            <button
              onClick={() => applyQuickFilter('today')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${quickFilter === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Today
            </button>
            <button
              onClick={() => applyQuickFilter('week')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${quickFilter === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              This Week
            </button>
            <button
              onClick={() => applyQuickFilter('month')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${quickFilter === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              This Month
            </button>

            <div className="ml-auto flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  setQuickFilter('all');
                  setDateRange({ ...dateRange, start: e.target.value });
                }}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm focus:border-blue-500 focus:outline-none"
              />
              <span className="text-gray-500 font-bold">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => {
                  setQuickFilter('all');
                  setDateRange({ ...dateRange, end: e.target.value });
                }}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* KEY 4 METRICS - From Laravel API */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 0. Total Sales */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm font-bold text-green-700 mb-1">0. Total Sales</p>
            <p className="text-3xl font-black text-green-900">RM {stats.totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-green-700 mt-2">{stats.totalOrders} orders</p>
          </div>

          {/* 1. Total Wallet Topups */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-200 px-2 py-1 rounded-full">
                {totalWallets} wallets
              </span>
            </div>
            <p className="text-sm font-bold text-blue-700 mb-1">1. Total Wallet Topups</p>
            <p className="text-3xl font-black text-blue-900">RM {totalLifetimeTopups.toFixed(2)}</p>
            <p className="text-xs text-blue-700 mt-2">Since launch (from WPay API)</p>
          </div>

          {/* 2. Total Spent (W-Balance Deductions) */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border-2 border-purple-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <ShoppingBag className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-purple-700 mb-1">2. Total Spent</p>
            <p className="text-3xl font-black text-purple-900">RM {stats.wBalanceDeductions.toFixed(2)}</p>
            <p className="text-xs text-purple-700 mt-2">W-Balance deductions</p>
          </div>

          {/* 3. Total Balance */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border-2 border-orange-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <PiggyBank className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-orange-700 mb-1">3. Total Balance</p>
            <p className="text-3xl font-black text-orange-900">RM {totalWalletBalance.toFixed(2)}</p>
            <p className="text-xs text-orange-700 mt-2">Current balance (from WPay API)</p>
          </div>
        </div>

        {/* Original Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <p className="text-xs text-yellow-700 mt-2">Customer topups (Supabase)</p>
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

          <div className="bg-gradient-to-br from-fuchsia-50 to-fuchsia-100 rounded-2xl border-2 border-fuchsia-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <Gift className="w-6 h-6 text-fuchsia-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-fuchsia-700 mb-1">Stamp Redemptions</p>
            <p className="text-3xl font-black text-fuchsia-900">{stats.stampRedemptions}</p>
            <p className="text-xs text-fuchsia-700 mt-2">Free orders redeemed</p>
          </div>
        </div>

        {/* User Balances from WPay API */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900">User Wallet Balances</h2>
                <p className="text-sm text-gray-600 mt-1">{wpayUsers.length} users from Laravel WPay API</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-600">Total Balance</p>
                  <p className="text-lg font-black text-green-600">RM {totalWalletBalance.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-600">Lifetime Topups</p>
                  <p className="text-lg font-black text-blue-600">RM {totalLifetimeTopups.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Email</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-900 uppercase">W-Balance</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-900 uppercase">Bonus</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-900 uppercase">Stars</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-gray-900 uppercase">Tier</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-900 uppercase">Lifetime Topups</th>
                </tr>
              </thead>
              <tbody>
                {wpayUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-600 font-medium">No users found</p>
                    </td>
                  </tr>
                ) : (
                  wpayUsers.map((user) => {
                    const tierColors: Record<string, string> = {
                      bronze: 'bg-orange-100 text-orange-700',
                      silver: 'bg-gray-200 text-gray-700',
                      gold: 'bg-yellow-100 text-yellow-700',
                      platinum: 'bg-purple-100 text-purple-700',
                      vip: 'bg-red-100 text-red-700'
                    };
                    const wbalance = parseFloat(String(user.wbalance || 0));
                    const bonus = parseFloat(String(user.bonus || 0));
                    const stars = parseInt(String(user.stars || 0));
                    const lifetimeTopups = parseFloat(String(user.lifetime_topups || 0));
                    return (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.email}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-700">RM {wbalance.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-blue-700">RM {bonus.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{stars}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${tierColors[user.tier_type] || tierColors.bronze}`}>
                            {user.tier_type || 'bronze'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">RM {lifetimeTopups.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* WPay Topup Transactions Table - Direct from Laravel API */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-900">WPay Topup Transactions</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {wpayTopups.length} topup transactions from Laravel WPay API
                  {topupsLoading && ' (Loading...)'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-500" />
                <input
                  type="date"
                  value={topupDateRange.start}
                  onChange={(e) => setTopupDateRange({ ...topupDateRange, start: e.target.value })}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Start date"
                />
                <span className="text-gray-500 font-bold">to</span>
                <input
                  type="date"
                  value={topupDateRange.end}
                  onChange={(e) => setTopupDateRange({ ...topupDateRange, end: e.target.value })}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="End date"
                />
                <button
                  onClick={() => {
                    setTopupDateRange({ start: '', end: '' });
                    loadWPayTopups();
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-amber-50 to-orange-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Order ID</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Fiuu Txn ID</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Email</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-green-600 uppercase">Amount Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-blue-600 uppercase">Topup Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-purple-600 uppercase">Bonus</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-amber-600 uppercase">Stars</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-gray-900 uppercase">Method</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-gray-900 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {topupsLoading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600 font-medium">Loading topup transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : wpayTopups.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No topup transactions found</p>
                      <p className="text-xs text-gray-500 mt-2">Try adjusting the date filters</p>
                    </td>
                  </tr>
                ) : (
                  wpayTopups
                    .slice((topupCurrentPage - 1) * TOPUP_PAGE_SIZE, topupCurrentPage * TOPUP_PAGE_SIZE)
                    .map((topup: any) => {
                      const amountPaid = parseFloat(topup.amount || 0);
                      const topupAmount = parseFloat(topup.topup_amount || 0);
                      const bonusAwarded = parseFloat(topup.bonus_awarded || 0);
                      const starsAwarded = parseInt(topup.stars_awarded || 0);

                      return (
                        <tr key={topup.id} className="border-b border-gray-100 hover:bg-amber-50/50">
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-blue-600">{topup.order_id}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-600 font-mono">{topup.fiuu_transaction_id || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDateTimeCMS(topup.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900">{topup.email || 'N/A'}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-green-700">
                            RM {amountPaid.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-blue-700">
                            RM {topupAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-purple-700">
                            {bonusAwarded > 0 ? `RM ${bonusAwarded.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-amber-700">
                            {starsAwarded > 0 ? starsAwarded : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-medium text-gray-600 uppercase">
                              {topup.payment_method || 'online'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                              topup.status === 'success' ? 'bg-green-100 text-green-700' :
                              topup.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {topup.status || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
          {wpayTopups.length > 0 && (
            <div className="p-4 bg-amber-50 border-t border-gray-200">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Showing {wpayTopups.length === 0 ? 0 : (topupCurrentPage - 1) * TOPUP_PAGE_SIZE + 1} to{' '}
                    {Math.min(topupCurrentPage * TOPUP_PAGE_SIZE, wpayTopups.length)} of {wpayTopups.length} topups
                  </span>
                  <span className="text-sm font-bold text-green-700 border-l pl-4 border-gray-300">
                    Total Paid: RM {wpayTopups.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0).toFixed(2)}
                  </span>
                  <span className="text-sm font-bold text-blue-700 border-l pl-4 border-gray-300">
                    Total Topped Up: RM {wpayTopups.reduce((sum, t) => sum + parseFloat(t.topup_amount || 0), 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTopupCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={topupCurrentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    Page {topupCurrentPage} of {Math.ceil(wpayTopups.length / TOPUP_PAGE_SIZE) || 1}
                  </span>
                  <button
                    onClick={() => setTopupCurrentPage(prev => Math.min(prev + 1, Math.ceil(wpayTopups.length / TOPUP_PAGE_SIZE)))}
                    disabled={topupCurrentPage >= Math.ceil(wpayTopups.length / TOPUP_PAGE_SIZE) || wpayTopups.length === 0}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          )}
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-900">Transaction Details</h2>
                <p className="text-sm text-gray-600">
                  {filteredTransactions.length} transactions found
                  {recentTransactions.length >= 2000 && ' (Limited to 2000 recent)'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={paymentTypeFilter}
                  onChange={(e) => setPaymentTypeFilter(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="payment">💳 Payment</option>
                  <option value="topup">💵 Topup</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
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
                  <option value="wonderstars">WonderStars</option>
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Order #</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-900 uppercase">Method</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-900 uppercase">Gross</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-red-600 uppercase">Discount</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-green-600 uppercase">Total Paid</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-gray-900 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No transactions match the selected filters</p>
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((txn) => {
                    const grossSales = parseFloat(txn.gross_sales || txn.total_amount || 0);
                    const discount = parseFloat(txn.discount_amount || 0) + parseFloat(txn.bonus_discount_amount || 0);
                    const totalPaid = parseFloat(txn.total_amount || 0);

                    const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
                      payment: { bg: 'bg-green-100', text: 'text-green-700', label: 'Payment' },
                      topup: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Topup' }
                    };
                    const typeStyle = typeConfig[txn.payment_type] || { bg: 'bg-gray-100', text: 'text-gray-700', label: txn.payment_type || 'N/A' };

                    return (
                      <tr key={txn.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-blue-600">{txn.order_number || txn.id?.slice(0, 8)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDateTimeCMS(txn.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{txn.users?.name || 'Guest'}</span>
                            <span className="text-xs text-gray-500">{txn.users?.email || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${typeStyle.bg} ${typeStyle.text}`}>
                            {typeStyle.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {txn.payment_method || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          RM {grossSales.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">
                          {discount > 0 ? `-RM ${discount.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-700">
                          RM {totalPaid.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${txn.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                            txn.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                            {txn.payment_status || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Showing {totalTransactions === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, totalTransactions)} of {totalTransactions} transactions
                </span>
                <span className="text-sm font-bold text-gray-900 border-l pl-4 border-gray-300">
                  Total: RM {filteredTransactions.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CMSLayout>
  );
};

export default CMSFinancial;
