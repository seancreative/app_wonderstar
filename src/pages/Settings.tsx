import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import VersionModal from '../components/VersionModal';
import { supabase } from '../lib/supabase';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [showClearModal, setShowClearModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('...');

  useEffect(() => {
    loadLatestVersion();
  }, []);

  const loadLatestVersion = async () => {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('version')
        .order('release_date', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setCurrentVersion(data.version);
      }
    } catch (error) {
      console.error('Failed to load version');
    }
  };

  const handleClearData = async () => {
    if (!user) return;

    try {
      // Clear user data from Supabase (not localStorage)
      // Clear cart items
      await supabase
        .from('shop_cart_items')
        .delete()
        .eq('user_id', user.id);

      // Clear user preferences (theme, UI hints)
      await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id);

      // Note: We keep orders, transactions, stamps, stars for audit/history
      // These are important records that shouldn't be deleted

      console.log('User data cleared from database');
      setShowClearModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data. Please try again.');
    }
  };

  const toggleSetting = async (key: 'haptics' | 'surprises' | 'reduceMotion') => {
    if (!user) return;

    const newSettings = {
      ...user.settings,
      [key]: !user.settings[key],
    };

    try {
      await updateUser({ settings: newSettings });
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  return (
    <div className="min-h-screen pb-28 pt-20">
      <div className="max-w-md mx-auto px-6 pt-8 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-3 glass rounded-xl hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>

        <div className="glass p-6 rounded-3xl space-y-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Preferences</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/40 rounded-2xl">
              <div>
                <p className="font-semibold text-gray-900">Haptic Feedback</p>
                <p className="text-sm text-gray-600">Vibration on interactions</p>
              </div>
              <button
                onClick={() => toggleSetting('haptics')}
                className={`w-14 h-8 rounded-full transition-colors ${
                  user?.settings.haptics ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full transition-transform ${
                    user?.settings.haptics ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/40 rounded-2xl">
              <div>
                <p className="font-semibold text-gray-900">Surprise Moments</p>
                <p className="text-sm text-gray-600">Show special celebrations</p>
              </div>
              <button
                onClick={() => toggleSetting('surprises')}
                className={`w-14 h-8 rounded-full transition-colors ${
                  user?.settings.surprises ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full transition-transform ${
                    user?.settings.surprises ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/40 rounded-2xl">
              <div>
                <p className="font-semibold text-gray-900">Reduce Motion</p>
                <p className="text-sm text-gray-600">Minimize animations</p>
              </div>
              <button
                onClick={() => toggleSetting('reduceMotion')}
                className={`w-14 h-8 rounded-full transition-colors ${
                  user?.settings.reduceMotion ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full transition-transform ${
                    user?.settings.reduceMotion ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="glass p-6 rounded-3xl">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Data</h2>
          <button
            onClick={() => setShowClearModal(true)}
            className="w-full p-4 bg-red-500/10 border-2 border-red-500/20 rounded-2xl flex items-center gap-3 hover:scale-105 transition-transform"
          >
            <Trash2 className="w-6 h-6 text-red-600" />
            <div className="flex-1 text-left">
              <p className="font-semibold text-red-600">Clear App Data</p>
              <p className="text-sm text-red-500">Remove all local data</p>
            </div>
          </button>
        </div>

        <button
          onClick={() => setShowVersionModal(true)}
          className="glass p-6 rounded-3xl text-center w-full hover:shadow-lg transition-shadow"
        >
          <p className="text-sm text-gray-600 font-semibold">WonderStars v{currentVersion}</p>
          <p className="text-xs text-gray-500 mt-1">Made with care for Wonderpark</p>
          <p className="text-xs text-primary-600 mt-2">Tap to view changelog</p>
        </button>
      </div>
      <ConfirmationModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearData}
        title="Clear All Data"
        message="Are you sure you want to clear all app data? This action cannot be undone."
        confirmText="Clear Data"
        cancelText="Cancel"
        type="danger"
      />
      <ConfirmationModal
        isOpen={showSuccessModal}
        onClose={() => window.location.reload()}
        onConfirm={() => window.location.reload()}
        title="Data Cleared"
        message="App data has been cleared successfully. Please refresh the page to continue."
        confirmText="Refresh Now"
        cancelText="Close"
        type="success"
      />
      <VersionModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        currentVersion={currentVersion}
      />
    </div>
  );
};

export default Settings;
