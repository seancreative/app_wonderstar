import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  createGachaConfiguration,
  validateConfiguration,
  ValidationResult,
} from '../../server/egg-gacha/configurationManager';
import { generateLinesFromConfig } from '../../server/egg-gacha/dynamicPrizeGenerator';

interface PrizeTier {
  id: string;
  amount: number;
  count: number;
}

interface SetupPrizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SetupPrizeModal: React.FC<SetupPrizeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { admin } = useAdminAuth();
  const toast = useToast();
  const [configName, setConfigName] = useState('');
  const [totalLines, setTotalLines] = useState(20);
  const [tiers, setTiers] = useState<PrizeTier[]>([
    { id: '1', amount: 0.5, count: 10 },
    { id: '2', amount: 1.0, count: 5 },
    { id: '3', amount: 2.0, count: 5 },
  ]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tiers.length > 0 && totalLines > 0) {
      const tierData = tiers.map((t, index) => ({
        tier_order: index + 1,
        prize_amount: t.amount,
        prize_count: t.count,
      }));
      const result = validateConfiguration(totalLines, tierData);
      setValidation(result);
    }
  }, [tiers, totalLines]);

  const addTier = () => {
    const newId = (Math.max(...tiers.map(t => parseInt(t.id)), 0) + 1).toString();
    setTiers([...tiers, { id: newId, amount: 0, count: 1 }]);
  };

  const removeTier = (id: string) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter(t => t.id !== id));
    }
  };

  const updateTier = (id: string, field: 'amount' | 'count', value: number) => {
    setTiers(tiers.map(t => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleGenerate = async () => {
    if (!admin) {
      setError('Admin authentication required');
      return;
    }

    if (!configName.trim()) {
      setError('Configuration name is required');
      return;
    }

    if (!validation || !validation.isValid) {
      setError('Please fix validation errors before generating');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const tierData = tiers.map((t, index) => ({
        tier_order: index + 1,
        prize_amount: t.amount,
        prize_count: t.count,
      }));

      const configResult = await createGachaConfiguration(
        configName.trim(),
        totalLines,
        tierData,
        admin.id
      );

      if (!configResult.success || !configResult.configId) {
        throw new Error(configResult.error || 'Failed to create configuration');
      }

      const config = {
        id: configResult.configId,
        config_name: configName.trim(),
        total_lines: totalLines,
        is_active: true,
        created_by_admin_id: admin.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tiers: tierData,
      };

      const generateResult = await generateLinesFromConfig(config);

      if (!generateResult.success) {
        throw new Error(generateResult.error || 'Failed to generate prize lines');
      }

      toast.success(`Success! Generated ${generateResult.linesGenerated} prize lines.`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Setup Prize Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Configuration Name *
            </label>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="e.g., Holiday Special, Default Setup"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Total Lines to Generate *
            </label>
            <input
              type="number"
              value={totalLines}
              onChange={(e) => setTotalLines(parseInt(e.target.value) || 0)}
              min="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">Prize Tiers *</label>
              <button
                onClick={addTier}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Tier
              </button>
            </div>

            <div className="space-y-3">
              {tiers.map((tier, index) => (
                <div
                  key={tier.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-700">Tier {index + 1}</h4>
                    {tiers.length > 1 && (
                      <button
                        onClick={() => removeTier(tier.id)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Lines Count
                      </label>
                      <input
                        type="number"
                        value={tier.count}
                        onChange={(e) =>
                          updateTier(tier.id, 'count', parseInt(e.target.value) || 0)
                        }
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Bonus Amount (RM)
                      </label>
                      <input
                        type="number"
                        value={tier.amount}
                        onChange={(e) =>
                          updateTier(tier.id, 'amount', parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {tier.count} lines × RM{tier.amount.toFixed(2)} = RM
                    {(tier.count * tier.amount).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {validation && (
            <div
              className={`rounded-lg p-4 ${
                validation.isValid
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {validation.isValid ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4
                    className={`font-semibold text-sm mb-2 ${
                      validation.isValid ? 'text-green-900' : 'text-yellow-900'
                    }`}
                  >
                    {validation.isValid ? 'Configuration Valid' : 'Validation Errors'}
                  </h4>
                  {validation.isValid ? (
                    <div className="text-sm text-green-800 space-y-1">
                      <p>
                        Total Lines: {validation.configuredLines}/{validation.expectedLines}
                      </p>
                      <p>Total Value: RM{validation.totalValue.toFixed(2)}</p>
                      <p>Ready to generate!</p>
                    </div>
                  ) : (
                    <ul className="text-sm text-yellow-800 space-y-1">
                      {validation.errors.map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
          {(!validation?.isValid || !configName.trim()) && !isGenerating && (
            <p className="text-sm text-amber-600 font-semibold mb-3">
              {!configName.trim() ? '⚠️ Please enter a configuration name' : '⚠️ Please fix validation errors before generating'}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!validation?.isValid || isGenerating || !configName.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                'Save & Generate'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPrizeModal;
