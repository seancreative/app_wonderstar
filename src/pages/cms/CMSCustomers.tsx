import React, { useState, useEffect } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import CustomerDetailModal from '../../components/cms/CustomerDetailModal';
import ChildrenStatsModal from '../../components/cms/ChildrenStatsModal';
import {
  Users,
  Search,
  Filter,
  Eye,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Star,
  Baby,
  Download,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { User, ChildProfile, WalletTransaction, StampsRedemption, ShopOrder } from '../../types/database';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import { calculateWalletBalance } from '../../utils/walletUtils';
import { calculateMasterBalances } from '../../services/masterBalanceCalculator';

interface CustomerWithDetails extends User {
  child_profiles?: ChildProfile[];
  wallet_transactions?: WalletTransaction[];
  stamps_redemptions?: StampsRedemption[];
  shop_orders?: ShopOrder[];
  voucher_redemptions?: any[];
  bonus_transactions?: any[];
  prize_redemptions?: any[];
}

const CMSCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showChildrenStats, setShowChildrenStats] = useState(false);
  const [bonusBalances, setBonusBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          child_profiles(*),
          wallet_transactions(*),
          shop_orders!shop_orders_user_id_fkey(*),
          stamps_redemptions(*)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const customersWithRedemptions = await Promise.all(
        (data || []).map(async (customer) => {
          const [voucherRedemptions, bonusTransactions, prizeRedemptions] = await Promise.all([
            supabase
              .from('voucher_redemptions')
              .select('*, vouchers(code, title)')
              .eq('user_id', customer.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('bonus_transactions')
              .select('*')
              .eq('user_id', customer.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('redemptions')
              .select('*, rewards(name, category)')
              .eq('user_id', customer.id)
              .order('redeemed_at', { ascending: false })
          ]);

          return {
            ...customer,
            voucher_redemptions: voucherRedemptions.data || [],
            bonus_transactions: bonusTransactions.data || [],
            prize_redemptions: prizeRedemptions.data || []
          };
        })
      );

      setCustomers(customersWithRedemptions);

      // Calculate master bonus balances for all customers
      const bonusBalancesMap: Record<string, number> = {};
      await Promise.all(
        customersWithRedemptions.map(async (customer) => {
          try {
            const masterBalances = await calculateMasterBalances(customer.id);
            bonusBalancesMap[customer.id] = masterBalances.bonusBalance;
          } catch (error) {
            console.error(`Error calculating bonus balance for customer ${customer.id}:`, error);
            bonusBalancesMap[customer.id] = 0;
          }
        })
      );
      setBonusBalances(bonusBalancesMap);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    searchTerm === '' ||
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCustomerBalance = (customer: CustomerWithDetails) => {
    const result = calculateWalletBalance(customer.wallet_transactions);
    return result.wBalance;
  };

  const exportToCSV = () => {
    const headers = ['Customer ID', 'Name', 'Email', 'Phone', 'Children', 'Total Topups', 'Balance', 'Joined Date'];
    const rows = filteredCustomers.map(customer => [
      customer.display_id || 'Pending',
      customer.name,
      customer.email,
      customer.phone || '-',
      customer.child_profiles?.length || 0,
      `RM ${customer.lifetime_topups.toFixed(2)}`,
      `RM ${getCustomerBalance(customer).toFixed(2)}`,
      new Date(customer.created_at).toLocaleDateString()
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const stats = {
    total: filteredCustomers.length,
    totalTopups: filteredCustomers.reduce((sum, c) => sum + c.lifetime_topups, 0),
    avgTopup: filteredCustomers.length > 0
      ? filteredCustomers.reduce((sum, c) => sum + c.lifetime_topups, 0) / filteredCustomers.length
      : 0,
    totalChildren: filteredCustomers.reduce((sum, c) => sum + (c.child_profiles?.length || 0), 0)
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
            <h1 className="text-3xl font-black text-gray-900 mb-2">Customer Management</h1>
            <p className="text-gray-600 font-medium">View and manage customer accounts</p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-600 mb-1">Total Customers</p>
                <p className="text-3xl font-black text-gray-900">{stats.total}</p>
              </div>
              <Users className="w-12 h-12 text-gray-300" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-green-700 mb-1">Total Topups</p>
                <p className="text-2xl font-black text-green-900">RM {stats.totalTopups.toFixed(2)}</p>
              </div>
              <DollarSign className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-blue-700 mb-1">Avg Topup</p>
                <p className="text-2xl font-black text-blue-900">RM {stats.avgTopup.toFixed(2)}</p>
              </div>
              <Star className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <button
            onClick={() => setShowChildrenStats(true)}
            className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 p-6 hover:scale-105 transition-transform text-left w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-purple-700 mb-1">Total Children</p>
                <p className="text-3xl font-black text-purple-900">{stats.totalChildren}</p>
              </div>
              <Baby className="w-12 h-12 text-purple-500" />
            </div>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Customer ID</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Customer</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Contact</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Children</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Total Topups</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Wallet Balance</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Bonus Balance</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Joined</th>
                  <th className="text-center px-6 py-4 text-sm font-bold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No customers found</p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => {
                    const balance = getCustomerBalance(customer);
                    return (
                      <tr
                        key={customer.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={async () => {
                          const { data } = await supabase
                            .from('users')
                            .select(`
                              *,
                              child_profiles(*),
                              wallet_transactions(*),
                              stamps_redemptions(*),
                              shop_orders!shop_orders_user_id_fkey(*)
                            `)
                            .eq('id', customer.id)
                            .single();
                          if (data) {
                            setSelectedCustomer(data as CustomerWithDetails);
                            setShowDetailModal(true);
                          }
                        }}
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono font-bold text-gray-900">{customer.display_id || 'Pending'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {customer.profile_picture_url ? (
                              <img src={customer.profile_picture_url} alt="" className="w-10 h-10 rounded-full" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                                {customer.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-gray-900">{customer.name}</p>
                              <p className="text-xs text-gray-600">{customer.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {customer.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Phone className="w-3 h-3 text-gray-400" />
                                {customer.phone}
                              </div>
                            )}
                            {customer.city && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                {customer.city}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                            {customer.child_profiles?.length || 0} {customer.child_profiles?.length === 1 ? 'child' : 'children'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-900">
                            RM {customer.lifetime_topups.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-bold ${balance > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            RM {balance.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-bold ${(bonusBalances[customer.id] || 0) > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                            RM {(bonusBalances[customer.id] || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <span className="font-mono">{formatDateTimeCMS(customer.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const { data } = await supabase
                                  .from('users')
                                  .select(`
                                    *,
                                    child_profiles(*),
                                    wallet_transactions(*),
                                    stamps_redemptions(*),
                                    shop_orders!shop_orders_user_id_fkey(*)
                                  `)
                                  .eq('id', customer.id)
                                  .single();
                                if (data) {
                                  setSelectedCustomer(data as CustomerWithDetails);
                                  setShowDetailModal(true);
                                }
                              }}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
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

      {showDetailModal && selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setShowDetailModal(false)}
        />
      )}

      {showChildrenStats && (
        <ChildrenStatsModal
          children={filteredCustomers.flatMap(c => c.child_profiles || [])}
          onClose={() => setShowChildrenStats(false)}
        />
      )}
    </CMSLayout>
  );
};

export default CMSCustomers;
