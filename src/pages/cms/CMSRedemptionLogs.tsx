import React, { useState, useEffect } from 'react';
import CMSLayout from '../../components/cms/CMSLayout';
import { FileText, CheckCircle, XCircle, Filter, Download, Calendar, User, Store, Package } from 'lucide-react';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import { supabase } from '../../lib/supabase';

interface RedemptionLog {
  id: string;
  staff_passcodes: {
    staff_name: string;
    passcode: string;
  } | null;
  redemption_type: string;
  redemption_id: string;
  users: {
    full_name: string;
    email: string;
  } | null;
  outlets: {
    name: string;
    location: string;
  } | null;
  items_redeemed: any[];
  success: boolean;
  failure_reason: string | null;
  metadata: any;
  created_at: string;
}

const CMSRedemptionLogs: React.FC = () => {
  const [logs, setLogs] = useState<RedemptionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'order' | 'gift' | 'stamp'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    loadLogs();
  }, [filter, typeFilter]);

  const loadLogs = async () => {
    try {
      let query = supabase
        .from('staff_redemption_logs')
        .select(`
          *,
          staff_passcodes(staff_name, passcode),
          users(full_name, email),
          outlets(name, location)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter === 'success') {
        query = query.eq('success', true);
      } else if (filter === 'failed') {
        query = query.eq('success', false);
      }

      if (typeFilter !== 'all') {
        query = query.eq('redemption_type', typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    return (
      log.staff_passcodes?.staff_name.toLowerCase().includes(search) ||
      log.outlets?.name.toLowerCase().includes(search) ||
      log.redemption_id.toLowerCase().includes(search)
    );
  }).filter(log => {
    if (!dateRange.start && !dateRange.end) return true;

    const logDate = new Date(log.created_at);
    const start = dateRange.start ? new Date(dateRange.start) : null;
    const end = dateRange.end ? new Date(dateRange.end) : null;

    if (start && logDate < start) return false;
    if (end && logDate > end) return false;
    return true;
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Staff', 'Type', 'Outlet', 'Items', 'Status', 'Reason'];
    const rows = filteredLogs.map(log => [
      formatDateTimeCMS(log.created_at),
      log.staff_passcodes?.staff_name || 'Unknown',
      log.redemption_type,
      log.outlets?.name || 'N/A',
      log.items_redeemed.length,
      log.success ? 'Success' : 'Failed',
      log.failure_reason || '-'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redemption-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const stats = {
    total: filteredLogs.length,
    successful: filteredLogs.filter(l => l.success).length,
    failed: filteredLogs.filter(l => !l.success).length,
    successRate: filteredLogs.length > 0
      ? ((filteredLogs.filter(l => l.success).length / filteredLogs.length) * 100).toFixed(1)
      : '0.0'
  };

  if (loading) {
    return (
      <CMSLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </CMSLayout>
    );
  }

  return (
    <CMSLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">Redemption Logs</h1>
            <p className="text-gray-600 font-medium">Track all staff redemption activities</p>
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
                <p className="text-sm font-bold text-gray-600 mb-1">Total Redemptions</p>
                <p className="text-3xl font-black text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-12 h-12 text-gray-300" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-green-700 mb-1">Successful</p>
                <p className="text-3xl font-black text-green-900">{stats.successful}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl border-2 border-red-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-red-700 mb-1">Failed</p>
                <p className="text-3xl font-black text-red-900">{stats.failed}</p>
              </div>
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-blue-700 mb-1">Success Rate</p>
                <p className="text-3xl font-black text-blue-900">{stats.successRate}%</p>
              </div>
              <CheckCircle className="w-12 h-12 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none font-bold text-sm"
              >
                <option value="all">All Status</option>
                <option value="success">Successful Only</option>
                <option value="failed">Failed Only</option>
              </select>
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none font-bold text-sm"
            >
              <option value="all">All Types</option>
              <option value="order">Orders</option>
              <option value="gift">Gifts</option>
              <option value="stamp">Stamps</option>
            </select>

            <input
              type="text"
              placeholder="Search by staff, outlet, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none font-medium text-sm"
            />

            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none font-medium text-sm"
              />
              <span className="text-gray-500 font-bold">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none font-medium text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Date & Time</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Staff</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Type</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Outlet</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Items</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-900">Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No redemption logs found</p>
                      <p className="text-sm text-gray-500 mt-1">Logs will appear here when staff redeem items</p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900 font-mono">
                          {formatDateTimeCMS(log.created_at)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-bold text-gray-900">
                            {log.staff_passcodes?.staff_name || 'Unknown'}
                          </span>
                        </div>
                        {log.staff_passcodes && (
                          <p className="text-xs text-gray-500 font-mono mt-1">
                            #{log.staff_passcodes.passcode}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-bold text-gray-900 capitalize">
                            {log.redemption_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {log.outlets?.name || 'N/A'}
                            </p>
                            {log.outlets?.location && (
                              <p className="text-xs text-gray-500 font-medium">
                                {log.outlets.location}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-900">
                          {log.items_redeemed.length} item{log.items_redeemed.length !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {log.success ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                            <CheckCircle className="w-3 h-3" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                            <XCircle className="w-3 h-3" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 font-medium">
                          {log.failure_reason || '-'}
                        </p>
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

export default CMSRedemptionLogs;
