import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Power,
  RefreshCw,
  Server,
  Wrench,
  XCircle
} from 'lucide-react';
import CMSLayout from '../../components/cms/CMSLayout';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatDateTimeCMS } from '../../utils/dateFormatter';

const REFRESH_INTERVAL_MS = 30000;

interface PaymentErrorRow {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  amount: number | null;
}

interface WalletErrorRow {
  id: string;
  status: string;
  description: string | null;
  metadata: unknown;
  created_at: string;
  amount: number | null;
}

interface OrderErrorRow {
  id: string;
  order_number: string | null;
  payment_status: string;
  payment_error_code: string | null;
  created_at: string;
  total_amount: number | null;
}

interface WalletAuditErrorRow {
  id: string;
  wallet_transaction_id: string | null;
  attempted_at: string;
  old_status: string | null;
  new_status: string | null;
  error_code: string | null;
  error_message: string | null;
}

interface StatusSummary {
  paymentFailures24h: number;
  walletFailures24h: number;
  orderPaymentFailures24h: number;
  walletAuditFailures24h: number;
}

interface ErrorFeedItem {
  source: string;
  recordId: string;
  status: string;
  message: string;
  createdAt: string;
  amount: number | null;
}

const EMPTY_SUMMARY: StatusSummary = {
  paymentFailures24h: 0,
  walletFailures24h: 0,
  orderPaymentFailures24h: 0,
  walletAuditFailures24h: 0
};

const toShortId = (value: string): string => {
  if (value.length <= 12) return value;
  return `${value.slice(0, 12)}...`;
};

const safeCount = (count: number | null, fallbackLength: number): number => {
  return typeof count === 'number' ? count : fallbackLength;
};

const readErrorMessageFromMetadata = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const maybeMetadata = metadata as Record<string, unknown>;
  const rawMessage = maybeMetadata.error_message ?? maybeMetadata.error ?? maybeMetadata.message;

  if (typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
    return rawMessage;
  }

  return null;
};

const CMSAppStatus: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { admin, loading: adminLoading } = useAdminAuth();
  const { staff, loading: staffLoading } = useStaffAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<StatusSummary>(EMPTY_SUMMARY);
  const [recentErrors, setRecentErrors] = useState<ErrorFeedItem[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const authLoading = adminLoading || staffLoading;
  const currentUser = admin || staff;
  const isStaff = !admin && !!staff;

  const loadStatus = useCallback(async (showFullLoader: boolean = false, notifyOnError: boolean = false) => {
    if (showFullLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [
        maintenanceResult,
        paymentResult,
        walletResult,
        orderResult,
        auditResult,
        paymentCountResult,
        walletCountResult,
        orderCountResult,
        auditCountResult
      ] = await Promise.all([
        supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'maintenance_mode')
          .single(),
        supabase
          .from('payment_transactions')
          .select('id, status, error_message, created_at, amount')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('wallet_transactions')
          .select('id, status, description, metadata, created_at, amount')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('shop_orders')
          .select('id, order_number, payment_status, payment_error_code, created_at, total_amount')
          .eq('payment_status', 'failed')
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('wallet_status_update_audit')
          .select('id, wallet_transaction_id, attempted_at, old_status, new_status, error_code, error_message')
          .eq('success', false)
          .order('attempted_at', { ascending: false })
          .limit(25),
        supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', since24h),
        supabase
          .from('wallet_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', since24h),
        supabase
          .from('shop_orders')
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', 'failed')
          .gte('created_at', since24h),
        supabase
          .from('wallet_status_update_audit')
          .select('id', { count: 'exact', head: true })
          .eq('success', false)
          .gte('attempted_at', since24h)
      ]);

      const queryErrors = [
        maintenanceResult.error,
        paymentResult.error,
        walletResult.error,
        orderResult.error,
        auditResult.error
      ].filter(Boolean);

      if (queryErrors.length > 0) {
        console.error('[CMSAppStatus] Failed queries:', queryErrors);
      }

      if (!maintenanceResult.error && maintenanceResult.data) {
        const settingRow = maintenanceResult.data as { setting_value?: string };
        setMaintenanceMode(settingRow.setting_value === 'true');
      }

      setDbConnected(queryErrors.length === 0);

      const paymentRows = (paymentResult.data ?? []) as PaymentErrorRow[];
      const walletRows = (walletResult.data ?? []) as WalletErrorRow[];
      const orderRows = (orderResult.data ?? []) as OrderErrorRow[];
      const auditRows = (auditResult.data ?? []) as WalletAuditErrorRow[];

      setSummary({
        paymentFailures24h: safeCount(paymentCountResult.count, paymentRows.length),
        walletFailures24h: safeCount(walletCountResult.count, walletRows.length),
        orderPaymentFailures24h: safeCount(orderCountResult.count, orderRows.length),
        walletAuditFailures24h: safeCount(auditCountResult.count, auditRows.length)
      });

      const paymentItems: ErrorFeedItem[] = paymentRows.map((row) => ({
        source: 'Payment Transactions',
        recordId: row.id,
        status: row.status,
        message: row.error_message || 'Payment failed without error message.',
        createdAt: row.created_at,
        amount: row.amount
      }));

      const walletItems: ErrorFeedItem[] = walletRows.map((row) => ({
        source: 'Wallet Transactions',
        recordId: row.id,
        status: row.status,
        message: readErrorMessageFromMetadata(row.metadata) || row.description || 'Wallet transaction failed.',
        createdAt: row.created_at,
        amount: row.amount
      }));

      const orderItems: ErrorFeedItem[] = orderRows.map((row) => ({
        source: 'Shop Orders',
        recordId: row.order_number || row.id,
        status: row.payment_status,
        message: row.payment_error_code
          ? `Payment error: ${row.payment_error_code}`
          : 'Order payment failed without error code.',
        createdAt: row.created_at,
        amount: row.total_amount
      }));

      const auditItems: ErrorFeedItem[] = auditRows.map((row) => ({
        source: 'Wallet Status Audit',
        recordId: row.wallet_transaction_id || row.id,
        status: row.new_status || 'failed',
        message: row.error_message || row.error_code || `Status update failed from ${row.old_status || 'unknown'}.`,
        createdAt: row.attempted_at,
        amount: null
      }));

      const mergedFeed = [...paymentItems, ...walletItems, ...orderItems, ...auditItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 40);

      setRecentErrors(mergedFeed);
      setLastCheckedAt(new Date().toISOString());
    } catch (error) {
      console.error('[CMSAppStatus] Failed to load status:', error);
      setDbConnected(false);
      if (notifyOnError) {
        toast.error('Failed to refresh app status data.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      navigate('/cms/login');
      return;
    }

    if (isStaff) {
      if (staff?.role !== 'manager') {
        navigate('/cms/unauthorized');
        return;
      }

      const permissions = (staff as { assigned_permissions?: Record<string, boolean> }).assigned_permissions || {};
      if (!permissions.settings) {
        navigate('/cms/unauthorized');
        return;
      }
    }

    void loadStatus(true);
  }, [authLoading, currentUser, isStaff, staff, navigate, loadStatus]);

  useEffect(() => {
    if (authLoading || !currentUser) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadStatus(false);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [authLoading, currentUser, loadStatus]);

  useEffect(() => {
    const subscription = supabase
      .channel('cms_app_status_maintenance')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_settings',
        filter: 'setting_key=eq.maintenance_mode'
      }, (payload) => {
        const nextValue = (payload.new as { setting_value?: string } | null)?.setting_value;
        if (typeof nextValue === 'string') {
          setMaintenanceMode(nextValue === 'true');
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const toggleMaintenanceMode = async () => {
    setRefreshing(true);
    const newValue = !maintenanceMode;

    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from('system_settings')
        .update({
          setting_value: newValue.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'maintenance_mode')
        .select('setting_key');

      if (updateError) {
        throw updateError;
      }

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertError } = await supabase
          .from('system_settings')
          .insert({
            setting_key: 'maintenance_mode',
            setting_value: newValue.toString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          throw insertError;
        }
      }

      setMaintenanceMode(newValue);
      toast.success(
        newValue
          ? 'Maintenance mode enabled. Public app now shows maintenance page.'
          : 'Maintenance mode disabled. Public app is live again.'
      );
      await loadStatus(false);
    } catch (error) {
      console.error('[CMSAppStatus] Failed to toggle maintenance mode:', error);
      toast.error('Failed to update maintenance mode.');
    } finally {
      setRefreshing(false);
    }
  };

  const totalErrors24h = useMemo(() => {
    return (
      summary.paymentFailures24h +
      summary.walletFailures24h +
      summary.orderPaymentFailures24h +
      summary.walletAuditFailures24h
    );
  }, [summary]);

  const healthState = useMemo(() => {
    if (dbConnected === false) {
      return {
        label: 'Connection Issue',
        textClass: 'text-red-700',
        bgClass: 'bg-red-50 border-red-200',
        icon: XCircle
      };
    }

    if (totalErrors24h > 0) {
      return {
        label: 'Degraded',
        textClass: 'text-amber-700',
        bgClass: 'bg-amber-50 border-amber-200',
        icon: AlertTriangle
      };
    }

    return {
      label: 'Healthy',
      textClass: 'text-green-700',
      bgClass: 'bg-green-50 border-green-200',
      icon: CheckCircle2
    };
  }, [dbConnected, totalErrors24h]);

  const HealthIcon = healthState.icon;

  if (authLoading || loading) {
    return (
      <CMSLayout>
        <div className="flex items-center justify-center h-96">
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
            <h1 className="text-3xl font-black text-gray-900 mb-2">App Status Monitor</h1>
            <p className="text-gray-600 font-medium">
              Track backend failures and control public maintenance mode from one place.
            </p>
          </div>

          <button
            onClick={() => { void loadStatus(false, true); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className={`rounded-2xl border p-5 ${healthState.bgClass}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-700">System Health</p>
              <HealthIcon className={`w-5 h-5 ${healthState.textClass}`} />
            </div>
            <p className={`text-2xl font-black ${healthState.textClass}`}>{healthState.label}</p>
          </div>

          <div className={`rounded-2xl border p-5 ${maintenanceMode ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-700">Maintenance Mode</p>
              <Power className={`w-5 h-5 ${maintenanceMode ? 'text-red-600' : 'text-gray-500'}`} />
            </div>
            <p className={`text-2xl font-black ${maintenanceMode ? 'text-red-700' : 'text-gray-700'}`}>
              {maintenanceMode ? 'Enabled' : 'Disabled'}
            </p>
          </div>

          <div className="rounded-2xl border p-5 bg-amber-50 border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-700">Backend Errors (24h)</p>
              <Wrench className="w-5 h-5 text-amber-700" />
            </div>
            <p className="text-2xl font-black text-amber-700">{totalErrors24h}</p>
          </div>

          <div className="rounded-2xl border p-5 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-700">Last Check</p>
              <Server className="w-5 h-5 text-blue-700" />
            </div>
            <p className="text-sm font-black text-blue-700">
              {lastCheckedAt ? formatDateTimeCMS(lastCheckedAt) : 'Not checked'}
            </p>
          </div>
        </div>

        <div className={`rounded-2xl border-2 p-6 ${maintenanceMode ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Public App Maintenance Switch</h2>
              <p className="text-sm font-medium text-gray-600">
                {maintenanceMode
                  ? 'Public users are currently blocked and see the maintenance screen.'
                  : 'Public users can access the app normally.'}
              </p>
            </div>

            <button
              onClick={toggleMaintenanceMode}
              disabled={refreshing}
              className={`px-5 py-3 rounded-xl font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                maintenanceMode
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {maintenanceMode ? 'Turn OFF Maintenance' : 'Turn ON Maintenance'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-bold text-gray-500">Payment Failures (24h)</p>
            <p className="text-2xl font-black text-red-700 mt-1">{summary.paymentFailures24h}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-bold text-gray-500">Wallet Failures (24h)</p>
            <p className="text-2xl font-black text-red-700 mt-1">{summary.walletFailures24h}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-bold text-gray-500">Order Payment Failures (24h)</p>
            <p className="text-2xl font-black text-red-700 mt-1">{summary.orderPaymentFailures24h}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-bold text-gray-500">Wallet Audit Failures (24h)</p>
            <p className="text-2xl font-black text-red-700 mt-1">{summary.walletAuditFailures24h}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900">Recent Backend Errors</h2>
            <p className="text-sm text-gray-500 font-semibold">Showing latest {recentErrors.length}</p>
          </div>

          {recentErrors.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-green-700 font-bold">No backend errors found in monitored sources.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Time</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Source</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Record</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700">Message</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentErrors.map((item, index) => (
                    <tr key={`${item.source}-${item.recordId}-${index}`} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDateTimeCMS(item.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-900 font-semibold whitespace-nowrap">{item.source}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{toShortId(item.recordId)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 min-w-[360px]">{item.message}</td>
                      <td className="px-4 py-3 text-right text-gray-700 font-semibold whitespace-nowrap">
                        {item.amount !== null ? `RM ${item.amount.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </CMSLayout>
  );
};

export default CMSAppStatus;
