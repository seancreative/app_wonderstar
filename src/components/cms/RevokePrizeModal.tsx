import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatDateTimeCMS } from '../../utils/dateFormatter';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { revokePrize, canRevokePrize } from '../../server/egg-gacha/revokePrize';

interface PrizeDetails {
  id: number;
  line_number: number;
  username: string;
  reward_label: string;
  reward_amount: number;
  claimed_at: string;
}

interface RevokePrizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prize: PrizeDetails | null;
}

const RevokePrizeModal: React.FC<RevokePrizeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  prize,
}) => {
  const { admin } = useAdminAuth();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState('');
  const [canRevoke, setCanRevoke] = useState(true);
  const [revokeError, setRevokeError] = useState('');

  useEffect(() => {
    if (isOpen && prize) {
      setReason('');
      setConfirmed(false);
      setError('');
      setRevokeError('');
      checkIfCanRevoke();
    }
  }, [isOpen, prize]);

  const checkIfCanRevoke = async () => {
    if (!prize) return;

    const result = await canRevokePrize(prize.id);
    setCanRevoke(result.canRevoke);
    if (!result.canRevoke) {
      setRevokeError(result.reason || 'Cannot revoke this prize');
    }
  };

  const handleRevoke = async () => {
    if (!admin || !prize) {
      setError('Admin authentication required');
      return;
    }

    if (!reason.trim() || reason.trim().length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }

    if (!confirmed) {
      setError('Please confirm that you understand this action cannot be undone');
      return;
    }

    setIsRevoking(true);
    setError('');

    try {
      const result = await revokePrize(prize.id, admin.id, reason.trim());

      if (!result.success) {
        throw new Error(result.error || 'Failed to revoke prize');
      }

      alert(
        `Prize revoked successfully!\n\nUser: ${result.username}\nAmount deducted: RM${result.amountDeducted?.toFixed(2)}`
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRevoking(false);
    }
  };

  if (!isOpen || !prize) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-900">Revoke Prize</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isRevoking}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!canRevoke ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900 mb-1">Cannot Revoke Prize</h4>
                  <p className="text-sm text-yellow-800">{revokeError}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-700">
                Are you sure you want to revoke this prize? This action{' '}
                <span className="font-semibold text-red-600">cannot be undone</span>.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Prize Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Line Number:</span>
                    <span className="font-semibold text-gray-900">#{prize.line_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">User:</span>
                    <span className="font-semibold text-gray-900">{prize.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reward:</span>
                    <span className="font-semibold text-gray-900">{prize.reward_label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-red-600">
                      RM{prize.reward_amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Claimed At:</span>
                    <span className="font-medium text-gray-900">
                      {formatDateTimeCMS(prize.claimed_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  This action will:
                </h4>
                <ul className="text-sm text-blue-800 space-y-1 ml-6">
                  <li>• Mark the prize as revoked</li>
                  <li>• Deduct RM{prize.reward_amount.toFixed(2)} from user's bonus balance</li>
                  <li>• Log this action in audit trail</li>
                  <li>• Update prize status in the system</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Revocation *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter detailed reason (minimum 10 characters)..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  disabled={isRevoking}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {reason.length}/10 characters minimum
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={isRevoking}
                  className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">
                  I understand this action <span className="font-semibold">cannot be undone</span>{' '}
                  and will immediately deduct the bonus amount from the user's account.
                </span>
              </label>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-gray-50 border-t px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isRevoking}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          {canRevoke && (
            <button
              onClick={handleRevoke}
              disabled={!reason.trim() || reason.length < 10 || !confirmed || isRevoking}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRevoking ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Revoking...
                </>
              ) : (
                'Confirm Revoke'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RevokePrizeModal;
