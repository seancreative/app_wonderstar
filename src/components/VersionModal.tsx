import React, { useEffect, useState } from 'react';
import { X, Package, Calendar, FileText, Wrench, Sparkles, Database, ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AppVersion {
  id: string;
  version: string;
  release_date: string;
  title: string;
  summary: string;
  changes: {
    features?: string[];
    fixes?: string[];
    improvements?: string[];
    database?: string[];
  };
  files_modified: string[];
  is_major: boolean;
  created_at: string;
}

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion?: string;
}

const VersionModal: React.FC<VersionModalProps> = ({ isOpen, onClose, currentVersion }) => {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [debugEnabled, setDebugEnabled] = useState(() => {
    return localStorage.getItem('debug_mode') === 'true';
  });

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('release_date', { ascending: false });

      if (error) throw error;

      setVersions(data || []);

      // Auto-expand the latest version
      if (data && data.length > 0) {
        setExpandedVersions(new Set([data[0].version]));
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVersion = (version: string) => {
    setExpandedVersions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(version)) {
        newSet.delete(version);
      } else {
        newSet.add(version);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const toggleDebugMode = () => {
    const newValue = !debugEnabled;
    setDebugEnabled(newValue);
    localStorage.setItem('debug_mode', String(newValue));
    window.dispatchEvent(new Event('debug-mode-changed'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="gradient-primary p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Version History</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          {currentVersion && (
            <p className="text-white text-opacity-90">Current Version: {currentVersion}</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No version history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => {
                const isExpanded = expandedVersions.has(version.version);
                const isLatest = index === 0;

                return (
                  <div
                    key={version.id}
                    className={`border-2 rounded-xl overflow-hidden transition-all ${
                      isLatest
                        ? 'border-primary-500 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Version Header */}
                    <button
                      onClick={() => toggleVersion(version.version)}
                      className="w-full p-4 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`px-3 py-1 rounded-lg font-bold ${
                            isLatest
                              ? 'bg-primary-500 text-white'
                              : version.is_major
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-300 text-gray-700'
                          }`}>
                            v{version.version}
                          </div>
                          <div className="text-left">
                            <h3 className="font-bold text-gray-900">{version.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDate(version.release_date)}</span>
                              {isLatest && (
                                <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                                  Latest
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Version Details */}
                    {isExpanded && (
                      <div className="p-4 border-t-2 border-gray-100 space-y-4">
                        {/* Summary */}
                        <p className="text-gray-700">{version.summary}</p>

                        {/* Features */}
                        {version.changes.features && version.changes.features.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-5 h-5 text-green-600" />
                              <h4 className="font-bold text-green-600">New Features</h4>
                            </div>
                            <ul className="ml-7 space-y-1">
                              {version.changes.features.map((feature, idx) => (
                                <li key={idx} className="text-gray-700 flex items-start gap-2">
                                  <span className="text-green-600 mt-1">•</span>
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Fixes */}
                        {version.changes.fixes && version.changes.fixes.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Wrench className="w-5 h-5 text-blue-600" />
                              <h4 className="font-bold text-blue-600">Bug Fixes</h4>
                            </div>
                            <ul className="ml-7 space-y-1">
                              {version.changes.fixes.map((fix, idx) => (
                                <li key={idx} className="text-gray-700 flex items-start gap-2">
                                  <span className="text-blue-600 mt-1">•</span>
                                  <span>{fix}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Improvements */}
                        {version.changes.improvements && version.changes.improvements.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-5 h-5 text-purple-600" />
                              <h4 className="font-bold text-purple-600">Improvements</h4>
                            </div>
                            <ul className="ml-7 space-y-1">
                              {version.changes.improvements.map((improvement, idx) => (
                                <li key={idx} className="text-gray-700 flex items-start gap-2">
                                  <span className="text-purple-600 mt-1">•</span>
                                  <span>{improvement}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Database Changes */}
                        {version.changes.database && version.changes.database.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Database className="w-5 h-5 text-orange-600" />
                              <h4 className="font-bold text-orange-600">Database Changes</h4>
                            </div>
                            <ul className="ml-7 space-y-1">
                              {version.changes.database.map((change, idx) => (
                                <li key={idx} className="text-gray-700 flex items-start gap-2">
                                  <span className="text-orange-600 mt-1">•</span>
                                  <span>{change}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Files Modified */}
                        {version.files_modified && version.files_modified.length > 0 && (
                          <div className="pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <h4 className="font-semibold text-gray-600 text-sm">
                                Files Modified ({version.files_modified.length})
                              </h4>
                            </div>
                            <div className="ml-6 space-y-1">
                              {version.files_modified.slice(0, 5).map((file, idx) => (
                                <p key={idx} className="text-xs text-gray-600 font-mono">
                                  {file}
                                </p>
                              ))}
                              {version.files_modified.length > 5 && (
                                <p className="text-xs text-gray-500 italic">
                                  + {version.files_modified.length - 5} more files
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-semibold text-gray-700">Debug Mode</span>
            </div>
            <button
              onClick={toggleDebugMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                debugEnabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
              title={debugEnabled ? 'Debug mode enabled' : 'Debug mode disabled'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  debugEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {debugEnabled ? 'Debug panel and info boxes are visible' : 'Debug panel and info boxes are hidden'}
          </p>
          <div className="text-center border-t border-gray-200 pt-3">
            <p className="text-sm text-gray-600">
              WonderStars Loyalty App © 2025
            </p>
            <button
              onClick={() => window.location.href = '/cms/login'}
              className="text-xs text-primary-600 hover:text-primary-700 mt-2 hover:underline"
            >
              Admin Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionModal;
