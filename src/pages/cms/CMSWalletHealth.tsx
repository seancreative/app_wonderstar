import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle, Search, Play, Eye } from 'lucide-react';
import CMSLayout from '../../components/cms/CMSLayout';
import { checkStuckTransactions, autoFixStuckTransactions, updateWalletTransactionStatus, verifyWalletTransactionStatus } from '../../services/walletStatusUpdateService';
import { supabase } from '../../lib/supabase';

interface StuckTransaction {
  wallet_transaction_id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
  minutes_stuck: number;
  payment_transaction_status: string;
  can_auto_fix: boolean;
  fix_reason: string;
}

interface AuditEntry {
  id: string;
  wallet_transaction_id: string;
  attempted_at: string;
  old_status: string;
  new_status: string;
  success: boolean;
  error_code: string;
  error_message: string;
  triggered_by: string;
  user_id: string;
}

const CMSWalletHealth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stuckTransactions, setStuckTransactions] = useState<StuckTransaction[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [ageMinutes, setAgeMinutes] = useState(10);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [manualStatus, setManualStatus] = useState<'success' | 'failed' | 'cancelled'>('success');
  const [actionResult, setActionResult] = useState<any>(null);

  useEffect(() => {
    loadStuckTransactions();
    loadAuditLog();
  }, []);

  const loadStuckTransactions = async () => {
    setLoading(true);
    try {
      const transactions = await checkStuckTransactions(ageMinutes);
      setStuckTransactions(transactions);
    } catch (error) {
      console.error('Error loading stuck transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async () => {
    try {
      const { data, error } = await supabase
        .from('wallet_status_update_audit')
        .select('*')
        .order('attempted_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAuditLog(data || []);
    } catch (error) {
      console.error('Error loading audit log:', error);
    }
  };

  const handleAutoFix = async (dryRun: boolean = false) => {
    setLoading(true);
    setActionResult(null);
    try {
      const result = await autoFixStuckTransactions(ageMinutes, dryRun);
      setActionResult(result);

      if (!dryRun) {
        await loadStuckTransactions();
        await loadAuditLog();
      }
    } catch (error) {
      console.error('Error running auto-fix:', error);
      setActionResult({ error: 'Failed to run auto-fix' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualFix = async (transactionId: string) => {
    setLoading(true);
    setActionResult(null);
    try {
      const result = await updateWalletTransactionStatus(
        transactionId,
        manualStatus,
        'admin_manual_fix',
        {
          admin_override: true,
          fixed_at: new Date().toISOString()
        }
      );

      setActionResult(result);

      if (result.success) {
        await loadStuckTransactions();
        await loadAuditLog();
        setSelectedTransaction(null);
      }
    } catch (error) {
      console.error('Error manually fixing transaction:', error);
      setActionResult({ error: 'Failed to fix transaction' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTransaction = async (transactionId: string, expectedStatus: string) => {
    setLoading(true);
    setActionResult(null);
    try {
      const result = await verifyWalletTransactionStatus(transactionId, expectedStatus);
      setActionResult(result);
    } catch (error) {
      console.error('Error verifying transaction:', error);
      setActionResult({ error: 'Failed to verify transaction' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CMSLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Wallet Transaction Health Monitor</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Monitor and fix stuck wallet transactions
            </p>
          </div>
          <button
            onClick={() => { loadStuckTransactions(); loadAuditLog(); }}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold mb-3">Configuration</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm">Consider stuck after:</span>
              <input
                type="number"
                value={ageMinutes}
                onChange={(e) => setAgeMinutes(parseInt(e.target.value))}
                className="px-3 py-1 border rounded w-20"
                min="1"
              />
              <span className="text-sm">minutes</span>
            </label>
            <button
              onClick={loadStuckTransactions}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stuck Transactions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Stuck Transactions ({stuckTransactions.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleAutoFix(true)}
                disabled={loading || stuckTransactions.length === 0}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1 text-sm"
              >
                <Eye className="w-4 h-4" />
                Dry Run
              </button>
              <button
                onClick={() => handleAutoFix(false)}
                disabled={loading || stuckTransactions.length === 0}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 text-sm"
              >
                <Play className="w-4 h-4" />
                Auto-Fix All
              </button>
            </div>
          </div>

          {stuckTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>No stuck transactions found!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Transaction ID</th>
                    <th className="px-4 py-2 text-left">User ID</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Stuck (min)</th>
                    <th className="px-4 py-2 text-left">Payment Status</th>
                    <th className="px-4 py-2 text-left">Can Fix</th>
                    <th className="px-4 py-2 text-left">Reason</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stuckTransactions.map((tx) => (
                    <tr key={tx.wallet_transaction_id} className="border-t dark:border-gray-700">
                      <td className="px-4 py-2 font-mono text-xs">{tx.wallet_transaction_id.slice(0, 8)}...</td>
                      <td className="px-4 py-2 font-mono text-xs">{tx.user_id.slice(0, 8)}...</td>
                      <td className="px-4 py-2 text-right font-semibold">RM {tx.amount.toFixed(2)}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">{tx.minutes_stuck}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          tx.payment_transaction_status === 'completed' || tx.payment_transaction_status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {tx.payment_transaction_status || 'none'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {tx.can_auto_fix ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">{tx.fix_reason}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedTransaction(tx.wallet_transaction_id)}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200"
                          >
                            Fix
                          </button>
                          <button
                            onClick={() => handleVerifyTransaction(tx.wallet_transaction_id, tx.status)}
                            className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs hover:bg-gray-200"
                          >
                            Verify
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Manual Fix Modal */}
        {selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Manual Transaction Fix</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Transaction: {selectedTransaction.slice(0, 16)}...
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Target Status</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleManualFix(selectedTransaction)}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply Fix
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Result */}
        {actionResult && (
          <div className={`rounded-lg p-4 ${
            actionResult.success || actionResult.verified
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <h3 className="font-semibold mb-2">Action Result</h3>
            <pre className="text-xs overflow-auto bg-white dark:bg-gray-900 p-2 rounded">
              {JSON.stringify(actionResult, null, 2)}
            </pre>
          </div>
        )}

        {/* Audit Log */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold mb-4">Recent Audit Log (Last 50)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Transaction</th>
                  <th className="px-4 py-2 text-left">Status Change</th>
                  <th className="px-4 py-2 text-left">Result</th>
                  <th className="px-4 py-2 text-left">Triggered By</th>
                  <th className="px-4 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="border-t dark:border-gray-700">
                    <td className="px-4 py-2 text-xs">
                      {new Date(entry.attempted_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {entry.wallet_transaction_id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {entry.old_status || 'unknown'} → {entry.new_status}
                    </td>
                    <td className="px-4 py-2">
                      {entry.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">{entry.triggered_by}</td>
                    <td className="px-4 py-2 text-xs text-red-600">
                      {entry.error_message && (
                        <span title={entry.error_message}>
                          {entry.error_code || 'Error'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CMSLayout>
  );
};

export default CMSWalletHealth;
