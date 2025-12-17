import React, { useState } from 'react';
import { X, ChevronRight, ChevronDown, Bug, Trash2, Copy, Check } from 'lucide-react';
import { useWPayDebug } from '../contexts/WPayDebugContext';

export const WPayDebugBox: React.FC = () => {
  const { logs, clearLogs, isEnabled, setIsEnabled } = useWPayDebug();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isEnabled) return null;

  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const getStatusColor = (log: any) => {
    if (log.type === 'error') return 'bg-red-500';
    if (log.response?.wpay_status === 'success') return 'bg-green-500';
    if (log.response?.wpay_status === 'pending') return 'bg-yellow-500';
    if (log.response?.wpay_status === 'failed') return 'bg-red-500';
    return 'bg-blue-500';
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-4 top-20 z-50 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-all"
          title="Open WPay Debug Panel"
        >
          <Bug className="w-5 h-5" />
          {logs.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {logs.length}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="fixed right-0 top-0 h-screen w-96 bg-gray-900 text-gray-100 shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="bg-purple-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              <span className="font-bold">WPay Debug</span>
              <span className="text-xs bg-purple-700 px-2 py-1 rounded">
                {logs.length} logs
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearLogs}
                className="p-1 hover:bg-purple-700 rounded"
                title="Clear logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-purple-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Logs Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {logs.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Bug className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No WPay API calls yet</p>
                <p className="text-xs mt-1">Logs will appear here</p>
              </div>
            ) : (
              logs.map(log => {
                const isExpanded = expandedLogs.has(log.id);
                const statusColor = getStatusColor(log);

                return (
                  <div
                    key={log.id}
                    className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700"
                  >
                    {/* Log Header */}
                    <div
                      className="flex items-start gap-2 p-3 cursor-pointer hover:bg-gray-750"
                      onClick={() => toggleExpand(log.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
                          <span className="font-mono text-xs text-purple-400">
                            {log.method}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTime(log.timestamp)}
                          </span>
                        </div>
                        <div className="text-sm font-medium truncate">
                          {log.endpoint}
                        </div>
                        {log.duration && (
                          <div className="text-xs text-gray-500">
                            {log.duration}ms
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="p-3 pt-0 space-y-3 text-xs">
                        {/* Request */}
                        {log.request && (
                          <div>
                            <div className="text-blue-400 font-semibold mb-1 flex items-center justify-between">
                              <span>REQUEST</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(JSON.stringify(log.request, null, 2), `${log.id}-req`);
                                }}
                                className="p-1 hover:bg-gray-700 rounded"
                              >
                                {copiedId === `${log.id}-req` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="bg-gray-900 p-2 rounded font-mono overflow-x-auto">
                              {log.request.email && (
                                <div><span className="text-gray-500">email:</span> {log.request.email}</div>
                              )}
                              {log.request.payment_category && (
                                <div><span className="text-gray-500">category:</span> {log.request.payment_category}</div>
                              )}
                              {log.request.payment_type && (
                                <div><span className="text-gray-500">type:</span> {log.request.payment_type}</div>
                              )}
                              {log.request.order_id && (
                                <div><span className="text-gray-500">order_id:</span> {log.request.order_id}</div>
                              )}
                              {log.request.amount !== undefined && (
                                <div><span className="text-gray-500">amount:</span> RM {log.request.amount.toFixed(2)}</div>
                              )}
                              {log.request.metadata && (
                                <details className="mt-1">
                                  <summary className="text-gray-500 cursor-pointer">metadata</summary>
                                  <pre className="text-xs mt-1 whitespace-pre-wrap">
                                    {JSON.stringify(log.request.metadata, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Response */}
                        {log.response && (
                          <div>
                            <div className="text-green-400 font-semibold mb-1 flex items-center justify-between">
                              <span>RESPONSE</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(JSON.stringify(log.response, null, 2), `${log.id}-res`);
                                }}
                                className="p-1 hover:bg-gray-700 rounded"
                              >
                                {copiedId === `${log.id}-res` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="bg-gray-900 p-2 rounded font-mono overflow-x-auto space-y-1">
                              {log.response.wpay_status && (
                                <div>
                                  <span className="text-gray-500">status:</span>{' '}
                                  <span className={
                                    log.response.wpay_status === 'success' ? 'text-green-400' :
                                    log.response.wpay_status === 'failed' ? 'text-red-400' :
                                    'text-yellow-400'
                                  }>
                                    {log.response.wpay_status}
                                  </span>
                                </div>
                              )}
                              {log.response.transaction_id && (
                                <div><span className="text-gray-500">transaction_id:</span> {log.response.transaction_id}</div>
                              )}
                              {log.response.order_id && (
                                <div><span className="text-gray-500">order_id:</span> {log.response.order_id}</div>
                              )}

                              {/* Profile Data */}
                              {log.response.profile && (
                                <details>
                                  <summary className="text-purple-400 cursor-pointer">Profile</summary>
                                  <div className="ml-4 mt-1 space-y-1">
                                    {log.response.profile.email && (
                                      <div><span className="text-gray-500">email:</span> {log.response.profile.email}</div>
                                    )}
                                    {log.response.profile.wbalance !== undefined && (
                                      <div><span className="text-gray-500">wbalance:</span> RM {log.response.profile.wbalance.toFixed(2)}</div>
                                    )}
                                    {log.response.profile.bonus !== undefined && (
                                      <div><span className="text-gray-500">bonus:</span> RM {log.response.profile.bonus.toFixed(2)}</div>
                                    )}
                                    {log.response.profile.stars !== undefined && (
                                      <div><span className="text-gray-500">stars:</span> {log.response.profile.stars}</div>
                                    )}
                                    {log.response.profile.tier_type && (
                                      <div><span className="text-gray-500">tier:</span> {log.response.profile.tier_type}</div>
                                    )}
                                    {log.response.profile.tier_factor !== undefined && (
                                      <div><span className="text-gray-500">tier_factor:</span> {log.response.profile.tier_factor}x</div>
                                    )}
                                    {log.response.profile.lifetime_topups !== undefined && (
                                      <div><span className="text-gray-500">lifetime_topups:</span> RM {log.response.profile.lifetime_topups.toFixed(2)}</div>
                                    )}
                                  </div>
                                </details>
                              )}

                              {/* Transaction Details */}
                              {log.response.transaction_details && (
                                <details>
                                  <summary className="text-yellow-400 cursor-pointer">Transaction Details</summary>
                                  <div className="ml-4 mt-1 space-y-1">
                                    {log.response.transaction_details.amount !== undefined && (
                                      <div><span className="text-gray-500">amount:</span> RM {log.response.transaction_details.amount.toFixed(2)}</div>
                                    )}
                                    {log.response.transaction_details.wbalance_used !== undefined && (
                                      <div><span className="text-gray-500">wbalance_used:</span> RM {log.response.transaction_details.wbalance_used.toFixed(2)}</div>
                                    )}
                                    {log.response.transaction_details.bonus_used !== undefined && (
                                      <div><span className="text-gray-500">bonus_used:</span> RM {log.response.transaction_details.bonus_used.toFixed(2)}</div>
                                    )}
                                    {log.response.transaction_details.stars_awarded !== undefined && (
                                      <div><span className="text-gray-500">stars_awarded:</span> {log.response.transaction_details.stars_awarded}</div>
                                    )}
                                  </div>
                                </details>
                              )}

                              {log.response.message && (
                                <div><span className="text-gray-500">message:</span> {log.response.message}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Error */}
                        {log.error && (
                          <div>
                            <div className="text-red-400 font-semibold mb-1">ERROR</div>
                            <div className="bg-red-900/20 border border-red-500/30 p-2 rounded text-red-300">
                              {log.error}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-800 p-3 border-t border-gray-700 text-xs text-gray-400">
            <div className="flex items-center justify-between">
              <span>Debug Mode: ON</span>
              <button
                onClick={() => setIsEnabled(false)}
                className="text-red-400 hover:text-red-300"
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
