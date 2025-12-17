import React, { useMemo } from 'react';
import { X, Baby, Users, TrendingUp, Heart, DollarSign } from 'lucide-react';
import { ChildProfile } from '../../types/database';

interface ChildrenStatsModalProps {
  children: ChildProfile[];
  onClose: () => void;
}

const ChildrenStatsModal: React.FC<ChildrenStatsModalProps> = ({ children, onClose }) => {
  const stats = useMemo(() => {
    const totalChildren = children.length;
    const maleCount = children.filter(c => c.gender === 'male').length;
    const femaleCount = children.filter(c => c.gender === 'female').length;

    const interestCounts: Record<string, number> = {};
    children.forEach(child => {
      if (child.workshop_interests && Array.isArray(child.workshop_interests)) {
        child.workshop_interests.forEach(interest => {
          interestCounts[interest] = (interestCounts[interest] || 0) + 1;
        });
      }
    });

    const budgetCounts: Record<string, number> = {
      essential: 0,
      enhanced: 0,
      advanced: 0,
      full: 0,
      none: 0
    };

    children.forEach(child => {
      if (child.budget_tier) {
        budgetCounts[child.budget_tier]++;
      } else {
        budgetCounts.none++;
      }
    });

    return {
      totalChildren,
      maleCount,
      femaleCount,
      malePercentage: totalChildren > 0 ? (maleCount / totalChildren) * 100 : 0,
      femalePercentage: totalChildren > 0 ? (femaleCount / totalChildren) * 100 : 0,
      interestCounts,
      budgetCounts,
      totalInterests: Object.values(interestCounts).reduce((sum, count) => sum + count, 0)
    };
  }, [children]);

  const budgetLabels: Record<string, { label: string; symbol: string; color: string }> = {
    essential: { label: 'Essential', symbol: '$', color: 'bg-blue-100 text-blue-700' },
    enhanced: { label: 'Enhanced', symbol: '$$', color: 'bg-green-100 text-green-700' },
    advanced: { label: 'Advanced', symbol: '$$$', color: 'bg-yellow-100 text-yellow-700' },
    full: { label: 'Full', symbol: '$$$$', color: 'bg-purple-100 text-purple-700' },
    none: { label: 'None', symbol: '-', color: 'bg-gray-100 text-gray-700' }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Baby className="w-7 h-7 text-purple-600" />
            Children Statistics
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Total Children & Gender */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Baby className="w-5 h-5 text-purple-600" />
                <p className="text-sm font-bold text-gray-600">Total Children</p>
              </div>
              <p className="text-4xl font-black text-purple-600">{stats.totalChildren}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <p className="text-sm font-bold text-gray-600">Male</p>
              </div>
              <p className="text-4xl font-black text-blue-600">{stats.maleCount}</p>
              <p className="text-xs text-gray-600 mt-1 font-bold">
                {stats.malePercentage.toFixed(1)}% of total
              </p>
            </div>

            <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-6 border-2 border-pink-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-pink-600" />
                <p className="text-sm font-bold text-gray-600">Female</p>
              </div>
              <p className="text-4xl font-black text-pink-600">{stats.femaleCount}</p>
              <p className="text-xs text-gray-600 mt-1 font-bold">
                {stats.femalePercentage.toFixed(1)}% of total
              </p>
            </div>
          </div>

          {/* Gender Distribution Chart */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-600" />
              Gender Distribution
            </h3>
            <div className="flex gap-2 h-12 rounded-lg overflow-hidden border-2 border-gray-200">
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-white font-black text-sm transition-all"
                style={{ width: `${stats.malePercentage}%` }}
              >
                {stats.malePercentage > 10 && `${stats.malePercentage.toFixed(0)}%`}
              </div>
              <div
                className="bg-gradient-to-r from-pink-400 to-pink-600 flex items-center justify-center text-white font-black text-sm transition-all"
                style={{ width: `${stats.femalePercentage}%` }}
              >
                {stats.femalePercentage > 10 && `${stats.femalePercentage.toFixed(0)}%`}
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span className="text-sm font-bold text-gray-700">Male ({stats.maleCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-pink-500"></div>
                <span className="text-sm font-bold text-gray-700">Female ({stats.femaleCount})</span>
              </div>
            </div>
          </div>

          {/* Workshop Interests */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-600" />
              Workshop Interests
            </h3>
            {Object.keys(stats.interestCounts).length === 0 ? (
              <p className="text-center text-gray-500 py-8">No interest data available</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.interestCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([interest, count]) => {
                    const percentage = stats.totalInterests > 0 ? (count / stats.totalInterests) * 100 : 0;
                    return (
                      <div key={interest}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-700 capitalize">
                            {interest.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm font-black text-gray-900">
                            {count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Learning Budget Distribution */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Learning Budget Distribution
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(stats.budgetCounts).map(([tier, count]) => {
                const config = budgetLabels[tier];
                const percentage = stats.totalChildren > 0 ? (count / stats.totalChildren) * 100 : 0;
                return (
                  <div key={tier} className={`rounded-xl p-4 ${config.color} border-2`}>
                    <p className="text-xs font-bold mb-1">{config.label}</p>
                    <p className="text-2xl font-black mb-1">{config.symbol}</p>
                    <p className="text-lg font-black">{count}</p>
                    <p className="text-xs font-semibold mt-1">{percentage.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform shadow-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChildrenStatsModal;
