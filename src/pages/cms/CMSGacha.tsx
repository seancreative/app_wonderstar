import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { useToast } from '../../contexts/ToastContext';
import CMSLayout from '../../components/cms/CMSLayout';
import SetupPrizeModal from '../../components/cms/SetupPrizeModal';
import RevokePrizeModal from '../../components/cms/RevokePrizeModal';
import { Gift, TrendingUp, Users, DollarSign, Package, RefreshCw, Settings, XCircle, Eye } from 'lucide-react';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import { getActiveConfiguration } from '../../server/egg-gacha/configurationManager';
import { setActiveConfiguration as updateActiveConfig } from '../../server/egg-gacha/configurationManager';

interface GachaStats {
  totalPrizes: number;
  claimedPrizes: number;
  unclaimedPrizes: number;
  revokedPrizes: number;
  totalValue: number;
  claimedValue: number;
  uniqueClaimers: number;
  currentConfig: string | null;
  configLinesPerBatch: number | null;
}

interface ClaimRecord {
  id: number;
  line_number: number;
  username: string;
  reward_label: string;
  reward_amount: number;
  claimed_at: string;
  is_revoked: boolean;
  revoke_reason: string | null;
}

interface PrizeLine {
  id: number;
  line_number: number;
  reward_label: string;
  reward_amount: number;
  is_claimed: boolean;
  is_revoked: boolean;
  claimed_by_username: string | null;
  claimed_at: string | null;
}

const CMSGacha: React.FC = () => {
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const { staff } = useStaffAuth();
  const toast = useToast();
  const [stats, setStats] = useState<GachaStats | null>(null);
  const [allClaims, setAllClaims] = useState<ClaimRecord[]>([]);
  const [allLines, setAllLines] = useState<PrizeLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [selectedPrize, setSelectedPrize] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'claims' | 'lines'>('lines');

  useEffect(() => {
    if (staff && !admin) {
      const permissions = (staff as any).assigned_permissions || {};
      if (!permissions.gacha) {
        navigate('/cms/unauthorized');
        return;
      }
    }
    loadData();
  }, [staff, admin, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prizesResult, configResult] = await Promise.all([
        supabase.from('egg_prize_lines').select('*'),
        getActiveConfiguration(),
      ]);

      const allPrizes = prizesResult.data || [];
      const claimed = allPrizes.filter((p) => p.is_claimed && !p.is_revoked);
      const unclaimed = allPrizes.filter((p) => !p.is_claimed && !p.is_revoked);
      const revoked = allPrizes.filter((p) => p.is_revoked);
      const uniqueUsers = new Set(claimed.map((p) => p.claimed_by_user_id)).size;

      setStats({
        totalPrizes: allPrizes.length,
        claimedPrizes: claimed.length,
        unclaimedPrizes: unclaimed.length,
        revokedPrizes: revoked.length,
        totalValue: allPrizes.reduce((sum, p) => sum + parseFloat(p.reward_amount), 0),
        claimedValue: claimed.reduce((sum, p) => sum + parseFloat(p.reward_amount), 0),
        uniqueClaimers: uniqueUsers,
        currentConfig: configResult?.config_name || null,
        configLinesPerBatch: configResult?.total_lines || null,
      });

      const claimedPrizes = allPrizes
        .filter((p) => p.is_claimed)
        .sort((a, b) => new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime())
        .map((p) => ({
          id: p.id,
          line_number: p.line_number,
          username: p.claimed_by_username || 'Unknown',
          reward_label: p.reward_label,
          reward_amount: parseFloat(p.reward_amount),
          claimed_at: p.claimed_at,
          is_revoked: p.is_revoked,
          revoke_reason: p.revoke_reason,
        }));

      const allPrizeLines = allPrizes
        .sort((a, b) => a.line_number - b.line_number)
        .map((p) => ({
          id: p.id,
          line_number: p.line_number,
          reward_label: p.reward_label,
          reward_amount: parseFloat(p.reward_amount),
          is_claimed: p.is_claimed,
          is_revoked: p.is_revoked,
          claimed_by_username: p.claimed_by_username,
          claimed_at: p.claimed_at,
        }));

      setAllClaims(claimedPrizes);
      setAllLines(allPrizeLines);
    } catch (error) {
      console.error('Error loading gacha data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = (claim: ClaimRecord) => {
    if (claim.is_revoked) {
      toast.warning('This prize has already been revoked');
      return;
    }
    setSelectedPrize(claim);
    setShowRevokeModal(true);
  };

  const getStatusBadge = (line: PrizeLine) => {
    if (line.is_revoked) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Revoked</span>;
    }
    if (line.is_claimed) {
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Claimed</span>;
    }
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Available</span>;
  };

  if (loading) {
    return (
      <CMSLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </CMSLayout>
    );
  }

  return (
    <CMSLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Egg Gacha Management</h1>
            <p className="text-gray-600 mt-1 font-medium">
              Monitor prize distribution, claims, and manage configurations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-semibold"
            >
              <Settings className="w-4 h-4" />
              Setup Prize
            </button>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {stats?.currentConfig && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-blue-900 mb-1">Active Configuration</h3>
                <p className="text-blue-700 font-medium">{stats.currentConfig}</p>
                <p className="text-sm text-blue-600 mt-1">
                  {stats.configLinesPerBatch} lines per batch • Auto-generates when buffer is low
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-blue-900">
                  {stats.unclaimedPrizes}
                </div>
                <div className="text-sm text-blue-600">Unclaimed</div>
              </div>
            </div>
          </div>
        )}

        {!stats?.currentConfig && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
            <Package className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
            <h3 className="font-bold text-yellow-900 mb-2">No Active Configuration</h3>
            <p className="text-yellow-700 mb-4">
              Set up a prize configuration to start generating lines for users.
            </p>
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold"
            >
              Setup Prize Configuration
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-700">Total Lines</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.totalPrizes || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Generated</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-700">Claimed</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.claimedPrizes || 0}</p>
            <p className="text-sm text-gray-600 mt-1">
              {stats?.totalPrizes
                ? ((stats.claimedPrizes / stats.totalPrizes) * 100).toFixed(1)
                : 0}
              % claimed
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-gray-700">Unique Players</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.uniqueClaimers || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Active participants</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-gray-700">Claimed Value</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              RM {stats?.claimedValue.toFixed(2) || '0.00'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Awarded to players</p>
          </div>

          {stats && stats.revokedPrizes > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-gray-700">Revoked</h3>
              </div>
              <p className="text-3xl font-bold text-red-600">{stats.revokedPrizes}</p>
              <p className="text-sm text-gray-600 mt-1">Admin revoked</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Prize Management</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('lines')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    activeTab === 'lines'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All Lines ({allLines.length})
                </button>
                <button
                  onClick={() => setActiveTab('claims')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    activeTab === 'claims'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Claims Only ({allClaims.length})
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {activeTab === 'lines' ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Line #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Reward
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Claimed By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Claimed At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No prize lines generated yet. Click "Setup Prize" to create your first batch.
                      </td>
                    </tr>
                  ) : (
                    allLines.map((line) => (
                      <tr key={line.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono font-semibold text-gray-900">
                          #{line.line_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{line.reward_label}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          RM {line.reward_amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(line)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {line.claimed_by_username || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                          {line.claimed_at ? formatDateTimeCMS(line.claimed_at) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          {line.is_claimed && !line.is_revoked && admin && (
                            <button
                              onClick={() =>
                                handleRevoke({
                                  id: line.id,
                                  line_number: line.line_number,
                                  username: line.claimed_by_username || 'Unknown',
                                  reward_label: line.reward_label,
                                  reward_amount: line.reward_amount,
                                  claimed_at: line.claimed_at || '',
                                  is_revoked: false,
                                  revoke_reason: null,
                                })
                              }
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-semibold"
                            >
                              Revoke
                            </button>
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Line #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Reward
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allClaims.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No claims yet
                      </td>
                    </tr>
                  ) : (
                    allClaims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono font-semibold text-gray-900">
                          #{claim.line_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{claim.username}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{claim.reward_label}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          RM {claim.reward_amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                          {formatDateTimeCMS(claim.claimed_at)}
                        </td>
                        <td className="px-6 py-4">
                          {claim.is_revoked ? (
                            <div className="group relative inline-block">
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold cursor-help">
                                Revoked
                              </span>
                              {claim.revoke_reason && (
                                <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg -top-2 left-full ml-2">
                                  {claim.revoke_reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {!claim.is_revoked && admin && (
                            <button
                              onClick={() => handleRevoke(claim)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-semibold"
                            >
                              Revoke
                            </button>
                          )}
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

      <SetupPrizeModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSuccess={() => {
          setShowSetupModal(false);
          loadData();
        }}
      />

      <RevokePrizeModal
        isOpen={showRevokeModal}
        onClose={() => {
          setShowRevokeModal(false);
          setSelectedPrize(null);
        }}
        onSuccess={() => {
          setShowRevokeModal(false);
          setSelectedPrize(null);
          loadData();
        }}
        prize={selectedPrize}
      />
    </CMSLayout>
  );
};

export default CMSGacha;
