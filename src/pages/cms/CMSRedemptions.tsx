import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Gift, Trophy, ShoppingBag, Calendar, User, DollarSign, Filter, Download, Search, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CMSLayout from '../../components/cms/CMSLayout';
import OrderNumberLink from '../../components/cms/OrderNumberLink';
import { formatCMSDateTime } from '../../utils/dateTimeUtils';
import { formatCurrency } from '../../utils/paymentMethodUtils';

interface VoucherRedemption {
  id: string;
  created_at: string;
  user_id: string;
  voucher_id: string;
  discount_amount: number;
  original_price: number;
  final_price: number;
  order_number: string;
  voucher_code: string;
  user_name: string;
  user_email: string;
}

interface BonusTransaction {
  id: string;
  created_at: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  order_number: string | null;
  user_name: string;
  user_email: string;
  metadata?: any;
}

interface RewardRedemption {
  id: string;
  created_at: string;
  user_id: string;
  reward_name: string;
  stars_cost: number;
  user_name: string;
  user_email: string;
  qr_code?: string;
  used_at?: string;
  category?: string;
}

interface OrderItemRedemption {
  id: string;
  created_at: string;
  redeemed_at: string;
  user_id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  redeemed_quantity: number;
  status: string;
  user_name: string;
  user_email: string;
  order_number: string;
  outlet_name: string;
}

const CMSRedemptions: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'vouchers' | 'bonus' | 'rewards' | 'orders'>('vouchers');
  const [voucherRedemptions, setVoucherRedemptions] = useState<VoucherRedemption[]>([]);
  const [bonusTransactions, setBonusTransactions] = useState<BonusTransaction[]>([]);
  const [rewardRedemptions, setRewardRedemptions] = useState<RewardRedemption[]>([]);
  const [orderRedemptions, setOrderRedemptions] = useState<OrderItemRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    loadData();
  }, [activeTab, dateFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'vouchers') {
        await loadVoucherRedemptions();
      } else if (activeTab === 'bonus') {
        await loadBonusTransactions();
      } else if (activeTab === 'rewards') {
        await loadRewardRedemptions();
      } else if (activeTab === 'orders') {
        await loadOrderRedemptions();
      }
    } catch (error) {
      console.error('Error loading redemptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return today.toISOString();
    } else if (dateFilter === 'week') {
      const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return week.toISOString();
    } else if (dateFilter === 'month') {
      const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return month.toISOString();
    }
    return null;
  };

  const loadVoucherRedemptions = async () => {
    try {
      let query = supabase
        .from('shop_orders')
        .select(`
          id,
          created_at,
          user_id,
          voucher_id,
          voucher_code,
          discount_amount,
          subtotal,
          total_amount,
          order_number,
          users!shop_orders_user_id_fkey (name, email)
        `)
        .not('voucher_code', 'is', null)
        .order('created_at', { ascending: false });

      const dateFilterValue = getDateFilter();
      if (dateFilterValue) {
        query = query.gte('created_at', dateFilterValue);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading voucher redemptions:', error);
        throw error;
      }

      const formatted = data?.map(item => ({
        id: item.id,
        created_at: item.created_at,
        user_id: item.user_id,
        voucher_id: item.voucher_id || '',
        discount_amount: item.discount_amount || 0,
        original_price: item.subtotal || 0,
        final_price: item.total_amount || 0,
        order_number: item.order_number || 'N/A',
        voucher_code: item.voucher_code || 'N/A',
        user_name: (item.users as any)?.name || 'Unknown',
        user_email: (item.users as any)?.email || 'N/A'
      })) || [];

      setVoucherRedemptions(formatted);
    } catch (error) {
      console.error('Failed to load voucher redemptions:', error);
      setVoucherRedemptions([]);
    }
  };

  const loadBonusTransactions = async () => {
    try {
      let query = supabase
        .from('shop_orders')
        .select(`
          id,
          created_at,
          user_id,
          order_number,
          bonus_discount_amount,
          total_amount,
          status,
          users!shop_orders_user_id_fkey (name, email)
        `)
        .gt('bonus_discount_amount', 0)
        .order('created_at', { ascending: false });

      const dateFilterValue = getDateFilter();
      if (dateFilterValue) {
        query = query.gte('created_at', dateFilterValue);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading bonus transactions:', error);
        throw error;
      }

      const formatted = data?.map(item => ({
        id: item.id,
        created_at: item.created_at,
        user_id: item.user_id,
        amount: item.bonus_discount_amount,
        transaction_type: 'payment',
        order_number: item.order_number,
        user_name: (item.users as any)?.name || 'Unknown',
        user_email: (item.users as any)?.email || 'N/A',
        metadata: { total_amount: item.total_amount, status: item.status }
      })) || [];

      setBonusTransactions(formatted);
    } catch (error) {
      console.error('Failed to load bonus transactions:', error);
      setBonusTransactions([]);
    }
  };

  const loadRewardRedemptions = async () => {
    try {
      let query = supabase
        .from('redemptions')
        .select(`
          id,
          redeemed_at,
          user_id,
          stars_cost,
          reward_id,
          qr_code,
          used_at,
          users!redemptions_user_id_fkey (name, email),
          rewards (name, category)
        `)
        .order('redeemed_at', { ascending: false });

      const dateFilterValue = getDateFilter();
      if (dateFilterValue) {
        query = query.gte('redeemed_at', dateFilterValue);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading reward redemptions:', error);
        throw error;
      }

      const formatted = data?.map(item => ({
        id: item.id,
        created_at: item.redeemed_at,
        user_id: item.user_id,
        reward_name: (item.rewards as any)?.name || 'Reward',
        stars_cost: item.stars_cost,
        user_name: (item.users as any)?.name || 'Unknown',
        user_email: (item.users as any)?.email || 'N/A',
        qr_code: item.qr_code,
        used_at: item.used_at,
        category: (item.rewards as any)?.category || 'N/A'
      })) || [];

      setRewardRedemptions(formatted);
    } catch (error) {
      console.error('Failed to load reward redemptions:', error);
      setRewardRedemptions([]);
    }
  };

  const loadOrderRedemptions = async () => {
    try {
      let query = supabase
        .from('order_item_redemptions')
        .select(`
          id,
          created_at,
          redeemed_at,
          user_id,
          order_id,
          product_name,
          quantity,
          redeemed_quantity,
          status,
          redeemed_at_outlet_id,
          users!order_item_redemptions_user_id_fkey (name, email)
        `)
        .order('redeemed_at', { ascending: false });

      const dateFilterValue = getDateFilter();
      if (dateFilterValue) {
        query = query.gte('redeemed_at', dateFilterValue);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading order item redemptions:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        setOrderRedemptions([]);
        return;
      }

      // Get unique order IDs and outlet IDs
      const orderIds = [...new Set(data.map(d => d.order_id).filter(Boolean))];
      const outletIds = [...new Set(data.map(d => d.redeemed_at_outlet_id).filter(Boolean))];

      // Fetch related orders
      const { data: orders } = await supabase
        .from('shop_orders')
        .select('id, order_number')
        .in('id', orderIds);

      // Fetch outlets
      const { data: outlets } = await supabase
        .from('outlets')
        .select('id, name')
        .in('id', outletIds);

      // Create lookup maps
      const orderMap = new Map(orders?.map(o => [o.id, o.order_number]) || []);
      const outletMap = new Map(outlets?.map(o => [o.id, o.name]) || []);

      // Map data together
      const formatted = data.map(item => ({
        id: item.id,
        created_at: item.redeemed_at || item.created_at,
        redeemed_at: item.redeemed_at,
        user_id: item.user_id,
        order_id: item.order_id,
        product_name: item.product_name,
        quantity: item.quantity,
        redeemed_quantity: item.redeemed_quantity,
        status: item.status,
        user_name: (item.users as any)?.name || 'Unknown',
        user_email: (item.users as any)?.email || 'N/A',
        order_number: orderMap.get(item.order_id) || 'N/A',
        outlet_name: outletMap.get(item.redeemed_at_outlet_id) || 'N/A'
      }));

      setOrderRedemptions(formatted);
    } catch (error) {
      console.error('Failed to load order item redemptions:', error);
      setOrderRedemptions([]);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';

    if (activeTab === 'vouchers') {
      csvContent = 'Timestamp,User Name,Email,Voucher Code,Order Number,Discount Amount,Original Price,Final Price\n';
      voucherRedemptions.forEach(item => {
        csvContent += `${formatDate(item.created_at)},${item.user_name},${item.user_email},${item.voucher_code},${item.order_number},${item.discount_amount},${item.original_price},${item.final_price}\n`;
      });
      filename = 'voucher_redemptions.csv';
    } else if (activeTab === 'bonus') {
      csvContent = 'Timestamp,User Name,Email,Type,Amount,Order Number,Description\n';
      bonusTransactions.forEach(item => {
        const desc = getTransactionDescription(item);
        csvContent += `${formatDate(item.created_at)},${item.user_name},${item.user_email},${item.transaction_type},${item.amount},${item.order_number || 'N/A'},${desc}\n`;
      });
      filename = 'bonus_transactions.csv';
    } else if (activeTab === 'rewards') {
      csvContent = 'Timestamp,User Name,Email,Reward,Category,Stars Cost,Status\n';
      rewardRedemptions.forEach(item => {
        csvContent += `${formatDate(item.created_at)},${item.user_name},${item.user_email},${item.reward_name},${item.category},${item.stars_cost},${item.used_at ? 'Used' : 'Pending'}\n`;
      });
      filename = 'reward_redemptions.csv';
    } else if (activeTab === 'orders') {
      csvContent = 'Timestamp,User Name,Email,Product,Quantity,Redeemed,Status,Order Number,Outlet\n';
      orderRedemptions.forEach(item => {
        csvContent += `${formatDate(item.created_at)},${item.user_name},${item.user_email},${item.product_name},${item.quantity},${item.redeemed_quantity},${item.status},${item.order_number},${item.outlet_name}\n`;
      });
      filename = 'order_item_redemptions.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredVouchers = voucherRedemptions.filter(item =>
    item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.voucher_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.order_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBonus = bonusTransactions.filter(item =>
    item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.order_number && item.order_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    item.transaction_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRewards = rewardRedemptions.filter(item =>
    item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.reward_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = orderRedemptions.filter(item =>
    item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.outlet_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTransactionDescription = (item: BonusTransaction): string => {
    if (item.metadata?.description) {
      return item.metadata.description;
    }
    return item.transaction_type.charAt(0).toUpperCase() + item.transaction_type.slice(1);
  };

  return (
    <CMSLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Redemption History</h1>
            <p className="text-sm text-gray-600 mt-1">Track all voucher, bonus, and prize redemptions with timestamps</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/cms/redemption-logs')}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-blue-200 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Redemption Logs
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('vouchers')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                  activeTab === 'vouchers'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Ticket className="w-4 h-4" />
                  <span>Voucher Redemptions</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{voucherRedemptions.length}</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('bonus')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                  activeTab === 'bonus'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Gift className="w-4 h-4" />
                  <span>Bonus Transactions</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{bonusTransactions.length}</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('rewards')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                  activeTab === 'rewards'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Trophy className="w-4 h-4" />
                  <span>Rewards Redemptions</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{rewardRedemptions.length}</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                  activeTab === 'orders'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Order Item Redemptions</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{orderRedemptions.length}</span>
                </div>
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-gray-200 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by user, email, or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : activeTab === 'vouchers' ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voucher Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No voucher redemptions found
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(item.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.user_name}</div>
                          <div className="text-xs text-gray-500">{item.user_email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold">
                            {item.voucher_code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.order_number}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                          - RM {item.discount_amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">RM {item.original_price.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          RM {item.final_price.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : activeTab === 'bonus' ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBonus.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No bonus transactions found
                      </td>
                    </tr>
                  ) : (
                    filteredBonus.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCMSDateTime(item.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.user_name}</div>
                          <div className="text-xs text-gray-500">{item.user_email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-orange-100 text-orange-700">
                            Payment
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                          -{formatCurrency(item.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.order_number ? (
                            <OrderNumberLink orderNumber={item.order_number} />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          Bonus credits used for order payment
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : activeTab === 'rewards' ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stars Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRewards.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No reward redemptions found
                      </td>
                    </tr>
                  ) : (
                    filteredRewards.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(item.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.user_name}</div>
                          <div className="text-xs text-gray-500">{item.user_email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.reward_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold capitalize">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600">
                          {item.stars_cost} stars
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.used_at ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                              Used
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-semibold">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outlet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No order item redemptions found
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(item.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.user_name}</div>
                          <div className="text-xs text-gray-500">{item.user_email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.product_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                            {item.order_number}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.outlet_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.redeemed_quantity}/{item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            item.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : item.status === 'partial'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </CMSLayout>
  );
};

export default CMSRedemptions;
