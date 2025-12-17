import React from 'react';
import {
  X,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Star,
  Baby,
  Award,
  TrendingUp,
  Gift,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  User,
  CreditCard,
  ShoppingBag,
  MapPin,
  Ticket,
  Trophy,
  Activity,
  FileText
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { User as UserType, ChildProfile, WalletTransaction, StampsRedemption, ShopOrder } from '../../types/database';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import { useMasterBalances } from '../../hooks/useMasterBalances';
import { verifyUserBalances, syncUserBalancesToDatabase } from '../../services/masterBalanceCalculator';
import TransactionDetailsModal from './TransactionDetailsModal';

interface CustomerWithDetails extends UserType {
  child_profiles?: ChildProfile[];
  wallet_transactions?: WalletTransaction[];
  stamps_redemptions?: StampsRedemption[];
  shop_orders?: ShopOrder[];
  voucher_redemptions?: any[];
  bonus_transactions?: any[];
  prize_redemptions?: any[];
}

interface CustomerDetailModalProps {
  customer: CustomerWithDetails;
  onClose: () => void;
}

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ customer, onClose }) => {
  const [activities, setActivities] = React.useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = React.useState(false);
  const [freeSpins, setFreeSpins] = React.useState<number>(customer.gacha_freespin || 0);
  const [grantingFreeSpins, setGrantingFreeSpins] = React.useState(false);
  const [freeSpinAmount, setFreeSpinAmount] = React.useState<string>('1');
  const [freeSpinReason, setFreeSpinReason] = React.useState<string>('admin_grant');
  const [showTransactionDetails, setShowTransactionDetails] = React.useState(false);
  const [showBalanceAudit, setShowBalanceAudit] = React.useState(false);
  const [verificationData, setVerificationData] = React.useState<any>(null);
  const [loadingVerification, setLoadingVerification] = React.useState(false);
  const [syncingBalances, setSyncingBalances] = React.useState(false);

  const { balances, loading: loadingBalances, refresh: refreshBalances } = useMasterBalances({
    userId: customer.id,
    userEmail: customer.email
  });

  React.useEffect(() => {
    loadActivities();
    setFreeSpins(customer.gacha_freespin || 0);
  }, [customer.id]);

  const handleGrantFreeSpins = async () => {
    const amount = parseInt(freeSpinAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid number of free spins');
      return;
    }

    setGrantingFreeSpins(true);
    try {
      const { error } = await supabase.rpc('grant_gacha_freespins', {
        p_user_id: customer.id,
        p_amount: amount,
        p_reason: freeSpinReason
      });

      if (error) throw error;

      // Update local state
      setFreeSpins(prev => prev + amount);
      alert(`Successfully granted ${amount} free spin${amount > 1 ? 's' : ''} to ${customer.name}`);
      setFreeSpinAmount('1');
    } catch (error) {
      console.error('Error granting free spins:', error);
      alert('Failed to grant free spins. Please try again.');
    } finally {
      setGrantingFreeSpins(false);
    }
  };

  const handleVerifyBalances = async () => {
    setLoadingVerification(true);
    try {
      const verification = await verifyUserBalances(customer.id);
      setVerificationData(verification);
      setShowBalanceAudit(true);
    } catch (error) {
      console.error('Error verifying balances:', error);
      alert('Failed to verify balances. Please try again.');
    } finally {
      setLoadingVerification(false);
    }
  };

  const handleSyncBalances = async () => {
    if (!confirm('This will update the database with calculated values. Continue?')) {
      return;
    }

    setSyncingBalances(true);
    try {
      await syncUserBalancesToDatabase(customer.id);
      await refreshBalances();
      await handleVerifyBalances();
      alert('Balances synced successfully!');
    } catch (error) {
      console.error('Error syncing balances:', error);
      alert('Failed to sync balances. Please try again.');
    } finally {
      setSyncingBalances(false);
    }
  };

  const loadActivities = async () => {
    setLoadingActivities(true);
    try {
      const allActivities: any[] = [];

      // 1. Load wallet transactions
      const { data: walletTxs } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });

      walletTxs?.forEach((tx) => {
        const isPositive = tx.transaction_type === 'topup' || tx.transaction_type === 'refund';
        allActivities.push({
          id: `wallet-${tx.id}`,
          created_at: tx.created_at,
          type: 'wallet',
          category: 'transaction',
          icon: isPositive ? 'ArrowUpCircle' : 'ArrowDownCircle',
          title: tx.transaction_type === 'topup' ? 'Wallet Top-up' :
            tx.transaction_type === 'spend' ? 'Wallet Payment' :
              tx.transaction_type === 'refund' ? 'Wallet Refund' : 'Bonus',
          description: tx.description || `${tx.transaction_type} transaction`,
          amount: isPositive ? parseFloat(tx.amount.toString()) : -Math.abs(parseFloat(tx.amount.toString())),
          bonus: tx.bonus_amount ? parseFloat(tx.bonus_amount.toString()) : 0,
          balance_after: tx.balance_after ? parseFloat(tx.balance_after.toString()) : null,
          metadata: tx.metadata,
          status: tx.status
        });
      });

      // 2. Load bonus transactions
      const { data: bonusTxs } = await supabase
        .from('bonus_transactions')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });

      bonusTxs?.forEach((tx) => {
        const isPositive = tx.transaction_type !== 'spend';
        allActivities.push({
          id: `bonus-${tx.id}`,
          created_at: tx.created_at,
          type: 'bonus',
          category: 'transaction',
          icon: 'Gift',
          title: isPositive ? 'Bonus Earned' : 'Bonus Used',
          description: tx.description || `${tx.transaction_type} bonus`,
          amount: isPositive ? parseFloat(tx.amount.toString()) : -Math.abs(parseFloat(tx.amount.toString())),
          balance_after: tx.balance_after ? parseFloat(tx.balance_after.toString()) : null,
          metadata: tx.metadata
        });
      });

      // 3. Load stars transactions
      const { data: starsTxs } = await supabase
        .from('stars_transactions')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });

      starsTxs?.forEach((tx) => {
        const isPositive = tx.transaction_type === 'earn' || tx.transaction_type === 'bonus';
        allActivities.push({
          id: `stars-${tx.id}`,
          created_at: tx.created_at,
          type: 'stars',
          category: 'gamification',
          icon: 'Star',
          title: isPositive ? 'Stars Earned' : 'Stars Spent',
          description: tx.description || `${tx.source || 'Stars transaction'}`,
          stars: tx.amount,
          balance_after: tx.balance_after ? parseFloat(tx.balance_after.toString()) : null,
          metadata: tx.metadata
        });
      });

      // 4. Load shop orders
      const { data: orders } = await supabase
        .from('shop_orders')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });

      orders?.forEach((order) => {
        allActivities.push({
          id: `order-${order.id}`,
          created_at: order.created_at,
          type: 'order',
          category: 'shop',
          icon: 'ShoppingBag',
          title: `Order ${order.order_number || order.id.slice(0, 8)}`,
          description: `${order.payment_method || 'Payment'} • ${order.status}`,
          amount: -parseFloat(order.total_amount.toString()),
          order_id: order.id,
          order_number: order.order_number,
          metadata: {
            payment_method: order.payment_method,
            status: order.status,
            outlet_id: order.outlet_id
          }
        });
      });

      // 5. Load voucher redemptions
      const { data: voucherRedemptions } = await supabase
        .from('voucher_redemptions')
        .select(`
          *,
          user_vouchers!inner(
            voucher_code,
            voucher_name
          )
        `)
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });

      voucherRedemptions?.forEach((redemption: any) => {
        allActivities.push({
          id: `voucher-${redemption.id}`,
          created_at: redemption.created_at,
          type: 'voucher',
          category: 'reward',
          icon: 'Ticket',
          title: 'Voucher Redeemed',
          description: `${redemption.user_vouchers?.voucher_name || 'Voucher'} (${redemption.user_vouchers?.voucher_code || ''})`,
          metadata: {
            order_id: redemption.order_id,
            voucher_code: redemption.user_vouchers?.voucher_code
          }
        });
      });

      // 6. Load gacha spins
      const { data: gachaSpins } = await supabase
        .from('gacha_spin_history')
        .select('*')
        .eq('user_id', customer.id)
        .order('spin_at', { ascending: false });

      gachaSpins?.forEach((spin) => {
        allActivities.push({
          id: `gacha-${spin.id}`,
          created_at: spin.spin_at,
          type: 'gacha',
          category: 'gamification',
          icon: 'Gift',
          title: spin.was_free_spin ? 'Free Gacha Spin' : 'Gacha Spin',
          description: `Won ${spin.reward_label} • RM ${spin.reward_amount.toFixed(2)}`,
          amount: parseFloat(spin.reward_amount.toString()),
          stars: spin.was_free_spin ? 0 : -spin.stars_cost,
          metadata: {
            was_free: spin.was_free_spin,
            stars_cost: spin.stars_cost
          }
        });
      });

      // 7. Load staff scan logs (MyQR scans)
      const { data: scanLogs } = await supabase
        .from('staff_scan_logs')
        .select(`
          *,
          staff_passcodes(staff_name),
          outlets(name)
        `)
        .eq('user_id', customer.id)
        .order('scanned_at', { ascending: false });

      scanLogs?.forEach((scan: any) => {
        allActivities.push({
          id: `scan-${scan.id}`,
          created_at: scan.scanned_at,
          type: 'scan',
          category: 'social',
          icon: 'QrCode',
          title: 'QR Code Scanned',
          description: `Scanned by ${scan.staff_passcodes?.staff_name || 'Staff'} at ${scan.outlets?.name || 'outlet'}`,
          stars: scan.stars_awarded || 0,
          metadata: {
            staff_name: scan.staff_passcodes?.staff_name,
            outlet_name: scan.outlets?.name
          }
        });
      });

      // Sort all activities by created_at
      allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivities(allActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Calculate W Balance using single source of truth

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'topup':
        return <ArrowUpCircle className="w-4 h-4 text-green-600" />;
      case 'spend':
        return <ArrowDownCircle className="w-4 h-4 text-red-600" />;
      case 'bonus':
        return <Gift className="w-4 h-4 text-purple-600" />;
      case 'refund':
        return <TrendingUp className="w-4 h-4 text-blue-600" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-600" />;
    }
  };

  const sortedTransactions = [...(customer.wallet_transactions || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const sortedOrders = [...(customer.shop_orders || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const totalStampsCollected = customer.stamps_redemptions?.reduce((sum, r) => sum + (r.stamps_used || 0), 0) || 0;
  const totalRewards = customer.stamps_redemptions?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 max-w-7xl w-full shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900">Customer Profile</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
              {customer.profile_picture_url ? (
                <img src={customer.profile_picture_url} alt="" className="w-20 h-20 rounded-full border-4 border-white shadow-md" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-md">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-2xl font-black text-gray-900">{customer.name}</h3>
                <p className="text-gray-600 font-medium">{customer.email}</p>
                <p className="text-sm text-gray-500 font-mono mt-1">ID: {customer.display_id || 'Pending'}</p>
              </div>
            </div>

            {/* Contact & Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-gray-600" />
                  <p className="text-sm font-bold text-gray-600">Phone</p>
                </div>
                <p className="text-lg font-black text-gray-900">{customer.phone || '-'}</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-600" />
                  <p className="text-sm font-bold text-gray-600">City</p>
                </div>
                <p className="text-lg font-black text-gray-900">{customer.city || '-'}</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <p className="text-sm font-bold text-gray-600">Joined</p>
                </div>
                <p className="text-base font-black text-gray-900 font-mono">{formatDateTimeCMS(customer.created_at)}</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-gray-600" />
                  <p className="text-sm font-bold text-gray-600">Referral Code</p>
                </div>
                <p className="text-lg font-black text-gray-900">{customer.referral_code || '-'}</p>
              </div>
            </div>

            {/* Balance Summary - Single Source of Truth */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-6 border-2 border-green-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-green-600" />
                    Balance Summary
                  </h3>
                  <p className="text-xs text-green-700 font-bold mt-1">Calculated from Complete Transaction History</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={refreshBalances}
                    disabled={loadingBalances}
                    className="px-3 py-1 text-xs font-bold bg-white rounded-lg border border-green-300 hover:bg-green-50 transition-colors disabled:opacity-50"
                  >
                    {loadingBalances ? 'Loading...' : 'Refresh'}
                  </button>
                  <button
                    onClick={handleVerifyBalances}
                    disabled={loadingVerification}
                    className="px-3 py-1 text-xs font-bold bg-yellow-600 text-white rounded-lg border border-yellow-700 hover:bg-yellow-700 transition-colors"
                  >
                    {loadingVerification ? 'Verifying...' : 'Verify'}
                  </button>
                  <button
                    onClick={() => setShowTransactionDetails(true)}
                    className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg border border-blue-700 hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    View Details
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-bold text-gray-600 mb-1">Total Transactions</p>
                  {loadingBalances ? (
                    <p className="text-xl font-black text-gray-400">...</p>
                  ) : (
                    <p className="text-xl font-black text-gray-900">{balances?.totalTransactions || 0}</p>
                  )}
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-bold text-gray-600 mb-1">Lifetime Topups</p>
                  {loadingBalances ? (
                    <p className="text-xl font-black text-gray-400">...</p>
                  ) : (
                    <p className="text-xl font-black text-blue-600">RM {(balances?.lifetimeTopup || 0).toFixed(2)}</p>
                  )}
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-bold text-gray-600 mb-1">W Balance</p>
                  {loadingBalances ? (
                    <p className="text-xl font-black text-gray-400">...</p>
                  ) : (
                    <p className="text-xl font-black text-green-600">RM {(balances?.wBalance || 0).toFixed(2)}</p>
                  )}
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-bold text-gray-600 mb-1">Bonus</p>
                  {loadingBalances ? (
                    <p className="text-xl font-black text-gray-400">...</p>
                  ) : (
                    <p className="text-xl font-black text-purple-600">RM {(balances?.bonusBalance || 0).toFixed(2)}</p>
                  )}
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-bold text-gray-600 mb-1">Stars</p>
                  {loadingBalances ? (
                    <p className="text-xl font-black text-gray-400">...</p>
                  ) : (
                    <p className="text-xl font-black text-yellow-600">{(balances?.starsBalance || 0).toLocaleString()}</p>
                  )}
                </div>
              </div>

              {/* Balance Verification */}
              {showBalanceAudit && verificationData && (
                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-yellow-300">
                  <div className="space-y-3">
                    <div className="font-bold text-lg text-gray-900 mb-3">Balance Verification Report</div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="font-bold text-gray-700">Calculated (Transaction History):</div>
                        <div className="space-y-1 pl-3">
                          <div>W Balance: <span className="font-bold text-green-600">RM {verificationData.calculated.wBalance.toFixed(2)}</span></div>
                          <div>Bonus: <span className="font-bold text-purple-600">RM {verificationData.calculated.bonusBalance.toFixed(2)}</span></div>
                          <div>Stars: <span className="font-bold text-yellow-600">{verificationData.calculated.starsBalance.toLocaleString()}</span></div>
                          <div>Lifetime: <span className="font-bold text-blue-600">RM {verificationData.calculated.lifetimeTopup.toFixed(2)}</span></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="font-bold text-gray-700">Stored (Database):</div>
                        <div className="space-y-1 pl-3">
                          <div className="text-gray-500">
                            W Balance: <span className="font-bold italic">Calculated Only</span>
                          </div>
                          <div className="text-gray-500">
                            Bonus: <span className="font-bold italic">Calculated Only</span>
                          </div>
                          <div className="text-gray-500">
                            Stars: <span className="font-bold italic">Calculated Only</span>
                          </div>
                          <div className={verificationData.discrepancies.lifetime ? 'text-red-600' : ''}>
                            Lifetime: <span className="font-bold">RM {verificationData.stored.lifetimeTopup.toFixed(2)}</span>
                            {verificationData.discrepancies.lifetime && <span className="ml-2">⚠️</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      {Object.values(verificationData.discrepancies).some(Boolean) ? (
                        <div>
                          <div className="font-bold text-red-600 mb-2">⚠ Discrepancies Detected</div>
                          <button
                            onClick={handleSyncBalances}
                            disabled={syncingBalances}
                            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {syncingBalances ? 'Syncing...' : 'Sync Database Values'}
                          </button>
                        </div>
                      ) : (
                        <div className="font-bold text-green-600">✓ All Balances Match</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Gacha Free Spins Management */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-100 rounded-xl p-6 border-2 border-orange-200">
              <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-orange-600" />
                Gacha Free Spins
              </h3>
              <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-gray-600">Current Free Spins</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🪙</span>
                    <p className="text-3xl font-black text-orange-600">x{freeSpins}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Free spins are used before stars in gacha</p>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Amount</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={freeSpinAmount}
                      onChange={(e) => setFreeSpinAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-bold"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Reason</label>
                    <select
                      value={freeSpinReason}
                      onChange={(e) => setFreeSpinReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-bold"
                    >
                      <option value="admin_grant">Admin Grant</option>
                      <option value="compensation">Compensation</option>
                      <option value="promotion">Promotion</option>
                      <option value="daily_bonus">Daily Bonus</option>
                      <option value="mission_reward">Mission Reward</option>
                      <option value="birthday_gift">Birthday Gift</option>
                      <option value="vip_reward">VIP Reward</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleGrantFreeSpins}
                  disabled={grantingFreeSpins}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-black text-base hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                >
                  {grantingFreeSpins ? 'Granting...' : `Grant ${freeSpinAmount} Free Spin${parseInt(freeSpinAmount) !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>

            {/* Children */}
            {customer.child_profiles && customer.child_profiles.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                  <Baby className="w-5 h-5 text-purple-600" />
                  Children ({customer.child_profiles.length})
                </h3>
                <div className="space-y-3">
                  {customer.child_profiles.map((child) => {
                    const calculateAge = (dob: string) => {
                      const birthDate = new Date(dob);
                      const today = new Date();
                      let age = today.getFullYear() - birthDate.getFullYear();
                      const monthDiff = today.getMonth() - birthDate.getMonth();
                      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                      }
                      return age;
                    };

                    const budgetSymbols: Record<string, string> = {
                      essential: '$',
                      enhanced: '$$',
                      advanced: '$$$',
                      full: '$$$$',
                      none: '-'
                    };

                    return (
                      <div key={child.id} className="p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                            {child.photo_url ? (
                              <img src={child.photo_url} alt={child.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <User className="w-8 h-8" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <p className="font-black text-gray-900 text-lg">{child.name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {child.gender && (
                                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${child.gender === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                                      }`}>
                                      {child.gender === 'male' ? '👦 Male' : '👧 Female'}
                                    </span>
                                  )}
                                  {child.date_of_birth && (
                                    <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full font-bold">
                                      {calculateAge(child.date_of_birth)} years old
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {child.date_of_birth && (
                              <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                                <Calendar className="w-3 h-3" />
                                <span className="font-semibold">DOB: {new Date(child.date_of_birth).toLocaleDateString('en-MY', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}</span>
                              </div>
                            )}

                            {child.workshop_interests && child.workshop_interests.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-bold text-gray-600 mb-1">Interests:</p>
                                <div className="flex flex-wrap gap-1">
                                  {child.workshop_interests.map((interest, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-semibold">
                                      {interest.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {child.budget_tier && (
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-3 h-3 text-green-600" />
                                <span className="text-xs font-bold text-gray-600">Learning Budget:</span>
                                <span className="text-sm px-2 py-0.5 bg-green-100 text-green-700 rounded font-black">
                                  {budgetSymbols[child.budget_tier] || '-'}
                                </span>
                                <span className="text-xs text-gray-600 font-semibold capitalize">
                                  ({child.budget_tier})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unified Activity Timeline - Replaces Transaction History */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Activity Timeline ({activities.length} events)
              </h3>
              {loadingActivities ? (
                <p className="text-center text-gray-500 py-8 text-sm">Loading activities...</p>
              ) : activities.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No activities yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activities.map((activity: any) => {
                    const iconMap: Record<string, any> = {
                      ArrowUpCircle: ArrowUpCircle,
                      ArrowDownCircle: ArrowDownCircle,
                      Gift: Gift,
                      Star: Star,
                      ShoppingBag: ShoppingBag,
                      Ticket: Ticket,
                      QrCode: History,
                    };
                    const IconComponent = iconMap[activity.icon] || Activity;

                    return (
                      <div key={activity.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="mt-0.5">
                              <IconComponent className="w-4 h-4 text-gray-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-1">
                                <p className="text-xs text-gray-500 font-mono whitespace-nowrap">
                                  {formatDateTimeCMS(activity.created_at)}
                                </p>
                                <span className="text-gray-400">•</span>
                                <p className="text-sm font-bold text-gray-900 truncate">
                                  {activity.title}
                                </p>
                              </div>
                              {activity.description && (
                                <div className="flex items-start gap-1.5 mt-1">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                  <p className="text-xs text-gray-700 font-medium line-clamp-2">{activity.description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {activity.stars && activity.stars !== 0 && (
                              <p className={`text-sm font-bold whitespace-nowrap ${activity.stars > 0 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                {activity.stars > 0 ? '+' : ''}{activity.stars} ⭐
                              </p>
                            )}
                            {activity.amount && activity.amount !== 0 && (
                              <p className={`text-sm font-bold whitespace-nowrap ${activity.amount > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {activity.amount > 0 ? '+' : ''}RM {Math.abs(activity.amount).toFixed(2)}
                              </p>
                            )}
                            {activity.bonus && activity.bonus > 0 && (
                              <p className="text-xs text-purple-600 font-bold whitespace-nowrap">
                                +RM {activity.bonus.toFixed(2)} bonus
                              </p>
                            )}
                            {activity.balance_after != null && (
                              <div className="mt-1 flex items-center justify-end gap-1">
                                <TrendingUp className={`w-3 h-3 ${(activity.amount || activity.stars || 0) > 0 ? 'text-green-600' : 'text-red-600'}`} />
                                <p className="text-xs text-gray-600">
                                  Bal: <span className="font-bold text-gray-900">
                                    {activity.type === 'stars'
                                      ? activity.balance_after.toLocaleString()
                                      : `RM ${activity.balance_after.toFixed(2)}`}
                                  </span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Orders & Rewards */}
          <div className="space-y-6">
            {/* Stamps & Rewards Summary */}
            <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-xl p-6 border-2 border-yellow-200">
              <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-600" />
                Stamps & Rewards
              </h3>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-sm font-bold text-gray-600 mb-1">Total Stamps Used</p>
                  <p className="text-2xl font-black text-yellow-600">{totalStampsCollected}</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-sm font-bold text-gray-600 mb-1">Rewards Redeemed</p>
                  <p className="text-2xl font-black text-purple-600">{totalRewards}</p>
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                Recent Orders ({sortedOrders.length})
              </h3>
              {sortedOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No orders yet</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {sortedOrders.slice(0, 10).map((order) => (
                    <div key={order.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900 font-mono">
                            {order.order_number || order.id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-gray-600 font-mono">{formatDateTimeCMS(order.created_at)}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${order.status === 'completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                          }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">{order.items?.length || 0} items</p>
                        <p className="text-sm font-bold text-gray-900">RM {parseFloat(order.total_amount.toString()).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stamp Redemptions */}
            {customer.stamps_redemptions && customer.stamps_redemptions.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-600" />
                  Stamp Redemptions
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {customer.stamps_redemptions.map((redemption) => (
                    <div key={redemption.id} className="p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-gray-900">
                          {redemption.stamps_used} stamps used
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${redemption.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                          {redemption.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 font-mono">{formatDateTimeCMS(redemption.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        isOpen={showTransactionDetails}
        onClose={() => setShowTransactionDetails(false)}
        userId={customer.id}
        userName={customer.name}
      />
    </div>
  );
};

export default CustomerDetailModal;
