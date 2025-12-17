import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, Search, Calendar, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ExternalLink, CheckCircle, Shield } from 'lucide-react';
import { useMasterBalances } from '../../hooks/useMasterBalances';
import { verifyUserBalances, syncUserBalancesToDatabase } from '../../services/masterBalanceCalculator';
import type { UnifiedTransaction } from '../../services/masterBalanceCalculator';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

type DateRangeType = '7days' | '30days' | '90days' | 'all';

type BalanceType = 'wallet' | 'bonus' | 'stars' | 'all';

export default function TransactionDetailsModal({
  isOpen,
  onClose,
  userId,
  userName
}: TransactionDetailsModalProps) {
  const [dateRange, setDateRange] = useState<DateRangeType>('30days');
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceTypeFilter, setBalanceTypeFilter] = useState<BalanceType>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [showBalanceAudit, setShowBalanceAudit] = useState(false);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [syncingBalances, setSyncingBalances] = useState(false);

  const dateFilter = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case '7days':
        return new Date(now.setDate(now.getDate() - 7)).toISOString();
      case '30days':
        return new Date(now.setDate(now.getDate() - 30)).toISOString();
      case '90days':
        return new Date(now.setDate(now.getDate() - 90)).toISOString();
      case 'all':
      default:
        return new Date('2020-01-01').toISOString();
    }
  }, [dateRange]);

  const { balances, loading, refresh } = useMasterBalances({
    userId: isOpen ? userId : null,
    dateFilter
  });

  const unifiedTransactions = balances?.transactionHistory || [];

  const filteredTransactions = useMemo(() => {
    let filtered = unifiedTransactions;

    if (balanceTypeFilter !== 'all') {
      filtered = filtered.filter(t => t.source_table === balanceTypeFilter);
    }

    if (transactionTypeFilter.length > 0) {
      filtered = filtered.filter(t => transactionTypeFilter.includes(t.transaction_type));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(term) ||
        t.id.toLowerCase().includes(term) ||
        t.order_id?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [unifiedTransactions, balanceTypeFilter, transactionTypeFilter, searchTerm]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredTransactions.slice(start, end);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const allTransactionTypes = useMemo(() => {
    const types = new Set<string>();
    unifiedTransactions.forEach(t => types.add(t.transaction_type));
    return Array.from(types).sort();
  }, [unifiedTransactions]);

  const getTransactionTypeBadge = (type: string, source: string) => {
    const badges: Record<string, string> = {
      topup: 'TU',
      spend: 'SP',
      bonus: 'BN',
      refund: 'RF',
      earn: 'ER',
      topup_bonus: 'TB',
      grant: 'GR',
      revoke: 'RV',
      adjustment: 'AD'
    };
    return badges[type] || type.substring(0, 2).toUpperCase();
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      topup: 'bg-green-100 text-green-700',
      spend: 'bg-red-100 text-red-700',
      bonus: 'bg-purple-100 text-purple-700',
      refund: 'bg-blue-100 text-blue-700',
      earn: 'bg-green-100 text-green-700',
      topup_bonus: 'bg-purple-100 text-purple-700',
      grant: 'bg-blue-100 text-blue-700',
      revoke: 'bg-orange-100 text-orange-700',
      adjustment: 'bg-gray-100 text-gray-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const handleVerifyBalances = async () => {
    setLoadingVerification(true);
    try {
      const verification = await verifyUserBalances(userId);
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
    if (!confirm('This will update the database with calculated values. Continue?')) return;

    setSyncingBalances(true);
    try {
      await syncUserBalancesToDatabase(userId);
      await handleVerifyBalances();
      await refresh();
      alert('Balances synced successfully!');
    } catch (error) {
      console.error('Error syncing balances:', error);
      alert('Failed to sync balances. Please try again.');
    } finally {
      setSyncingBalances(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date/Time', 'Type', 'Order ID', 'Wallet Balance', 'Bonus Balance', 'Stars Balance', 'Lifetime Topup', 'Description'];

    const rows = filteredTransactions.map(t => [
      new Date(t.created_at).toLocaleString(),
      t.transaction_type,
      t.order_id || '-',
      t.wallet_balance.toFixed(2),
      t.bonus_balance.toFixed(2),
      t.stars_balance,
      t.lifetime_topup.toFixed(2),
      t.description
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userName}_unified_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black">Complete Transaction History</h2>
              <p className="text-blue-100 text-sm mt-1">{userName}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleVerifyBalances}
                disabled={loadingVerification}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                <Shield className="w-4 h-4" />
                {loadingVerification ? 'Verifying...' : 'Verify Balances'}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              <select
                value={dateRange}
                onChange={(e) => { setDateRange(e.target.value as DateRangeType); setCurrentPage(1); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Balance Type Filter */}
            <div className="flex items-center gap-2">
              <select
                value={balanceTypeFilter}
                onChange={(e) => { setBalanceTypeFilter(e.target.value as BalanceType); setCurrentPage(1); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Balances</option>
                <option value="wallet">Wallet Only</option>
                <option value="bonus">Bonus Only</option>
                <option value="stars">Stars Only</option>
              </select>
            </div>

            {/* Transaction Type Filter */}
            {allTransactionTypes.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={transactionTypeFilter[0] || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setTransactionTypeFilter([e.target.value]);
                    } else {
                      setTransactionTypeFilter([]);
                    }
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  {allTransactionTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-600" />
              <input
                type="text"
                placeholder="Search description, ID, or order..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Export Button */}
            <button
              onClick={exportToCSV}
              className="ml-auto px-4 py-1.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Summary Stats - Single Source of Truth */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg w-fit">
              <CheckCircle className="w-4 h-4" />
              <span className="font-bold">Single Source of Truth: Calculated from Complete Transaction History</span>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-gray-600">
                Total Transactions: <span className="font-bold text-gray-900">{balances?.totalTransactions || 0}</span>
              </div>
              {balances && (
                <>
                  <div className="text-gray-600">
                    W Balance: <span className="font-bold text-green-600">RM {balances.wBalance.toFixed(2)}</span>
                  </div>
                  <div className="text-gray-600">
                    Bonus: <span className="font-bold text-purple-600">RM {balances.bonusBalance.toFixed(2)}</span>
                  </div>
                  <div className="text-gray-600">
                    Stars: <span className="font-bold text-yellow-600">{balances.starsBalance.toLocaleString()}</span>
                  </div>
                  <div className="text-gray-600">
                    Lifetime Topups: <span className="font-bold text-blue-600">RM {balances.lifetimeTopup.toFixed(2)}</span>
                  </div>
                </>
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

        {/* Transaction Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-semibold">Loading transactions...</p>
              </div>
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-gray-600 font-semibold">No transactions found</p>
                <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-gray-700 border-b-2">Date/Time</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-700 border-b-2">Type</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-700 border-b-2">Order ID</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-b-2">W Balance</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-b-2">Bonus</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-b-2">Stars</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-700 border-b-2">Lifetime Topup</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-700 border-b-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((transaction) => (
                  <TransactionTableRow key={transaction.id} transaction={transaction} getTypeBadge={getTransactionTypeBadge} getTypeBadgeColor={getTypeBadgeColor} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 font-semibold">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TransactionTableRowProps {
  transaction: UnifiedTransaction;
  getTypeBadge: (type: string, source: string) => string;
  getTypeBadgeColor: (type: string) => string;
}

function TransactionTableRow({ transaction, getTypeBadge, getTypeBadgeColor }: TransactionTableRowProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${day} ${month}, ${time}`;
  };

  const hasWalletChange = transaction.wallet_change !== 0;
  const hasBonusChange = transaction.bonus_change !== 0;
  const hasStarsChange = transaction.stars_change !== 0;

  return (
    <tr className="border-b hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
        {formatDate(transaction.created_at)}
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${getTypeBadgeColor(transaction.transaction_type)}`}
          title={transaction.transaction_type}
        >
          {getTypeBadge(transaction.transaction_type, transaction.source_table)}
        </span>
      </td>
      <td className="px-3 py-2 text-xs">
        {transaction.order_id ? (
          <a
            href={`#${transaction.order_id}`}
            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
            title={transaction.order_id}
          >
            {transaction.order_id.substring(0, 15)}...
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className={`px-3 py-2 text-xs text-right font-semibold ${hasWalletChange ? 'bg-blue-50' : ''}`}>
        <div className="flex items-center justify-end gap-1">
          {hasWalletChange && (
            transaction.wallet_change > 0 ? (
              <ArrowUp className="w-3 h-3 text-green-600" />
            ) : (
              <ArrowDown className="w-3 h-3 text-red-600" />
            )
          )}
          <span className={hasWalletChange ? (transaction.wallet_change > 0 ? 'text-green-700' : 'text-red-700') : 'text-gray-700'}>
            RM {transaction.wallet_balance.toFixed(2)}
          </span>
        </div>
      </td>
      <td className={`px-3 py-2 text-xs text-right font-semibold ${hasBonusChange ? 'bg-purple-50' : ''}`}>
        <div className="flex items-center justify-end gap-1">
          {hasBonusChange && (
            transaction.bonus_change > 0 ? (
              <ArrowUp className="w-3 h-3 text-green-600" />
            ) : (
              <ArrowDown className="w-3 h-3 text-red-600" />
            )
          )}
          <span className={hasBonusChange ? (transaction.bonus_change > 0 ? 'text-purple-700' : 'text-red-700') : 'text-gray-700'}>
            RM {transaction.bonus_balance.toFixed(2)}
          </span>
        </div>
      </td>
      <td className={`px-3 py-2 text-xs text-right font-semibold ${hasStarsChange ? 'bg-yellow-50' : ''}`}>
        <div className="flex items-center justify-end gap-1">
          {hasStarsChange && (
            transaction.stars_change > 0 ? (
              <ArrowUp className="w-3 h-3 text-green-600" />
            ) : (
              <ArrowDown className="w-3 h-3 text-red-600" />
            )
          )}
          <span className={hasStarsChange ? (transaction.stars_change > 0 ? 'text-yellow-700' : 'text-red-700') : 'text-gray-700'}>
            {transaction.stars_balance.toLocaleString()}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-right font-semibold text-gray-700">
        RM {transaction.lifetime_topup.toFixed(2)}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate" title={transaction.description}>
        {transaction.description}
      </td>
    </tr>
  );
}
