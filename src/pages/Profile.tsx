import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStars } from '../hooks/useStars';
import { useMasterBalances } from '../hooks/useMasterBalances';
import { supabase } from '../lib/supabase';
import {
  Phone, Mail, Users, LogOut,
  ChevronRight,
  Sparkles, Gift, Star,
  Edit, Trophy, Crown, TrendingUp, Info, Wallet, CheckCircle
} from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import EditChildModal from '../components/EditChildModal';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';
import EditProfileModal from '../components/EditProfileModal';
import TierBenefitsModal from '../components/TierBenefitsModal';
import LoadingScreen from '../components/LoadingScreen';
import type { ChildProfile } from '../types/database';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, reloadUser } = useAuth();
  const { currentTier, nextTier } = useStars();
  const { balances, loading: balancesLoading, refresh: refreshBalances } = useMasterBalances({
    userId: user?.id || null,
    userEmail: user?.email || null
  });
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadChildren();
    }
  }, [user]);

  const loadChildren = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('child_profiles')
        .select('*')
        .eq('user_id', user.id);

      setChildren(data || []);
    } catch (error) {
      console.error('Error loading children:', error);
    }
  };


  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isLoading = balancesLoading || !currentTier;

  return (
    <div className="min-h-screen pb-28 pt-20">
      <PageHeader />
      <div className="max-w-md mx-auto px-6 pt-6 space-y-6">
        {isLoading ? (
          <LoadingScreen variant="content" text="Loading your profile..." />
        ) : (
          <>
            <div className="animate-slide-up">
              <ProfilePhotoUpload
                currentPhotoUrl={user?.profile_picture_url}
                onPhotoUpdated={async () => {
                  await reloadUser();
                }}
              />
              <h1 className="text-3xl font-black theme-text-primary text-center mt-4">{user?.name}</h1>
              <p className="theme-text-secondary font-medium mt-1 text-center">{user?.email}</p>
            </div>

            <div className="glass p-6 rounded-3xl shadow-xl animate-pop-in">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black theme-text-primary flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Your Balances
                  </h2>
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <p className="text-xs font-bold text-green-700">Live from transaction history</p>
                  </div>
                </div>
                <button
                  onClick={refreshBalances}
                  disabled={balancesLoading}
                  className="text-xs font-bold theme-bg-primary text-white px-3 py-1 rounded-lg disabled:opacity-50"
                >
                  {balancesLoading ? '...' : 'Refresh'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border-2 border-green-200">
                  <p className="text-xs font-bold text-green-700 mb-1">W Balance</p>
                  <p className="text-xl font-black text-green-900">RM{(balances?.wBalance || 0).toFixed(2)}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 border-2 border-purple-200">
                  <p className="text-xs font-bold text-purple-700 mb-1">Bonus</p>
                  <p className="text-xl font-black text-purple-900">RM{(balances?.bonusBalance || 0).toFixed(2)}</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-4 border-2 border-yellow-200">
                  <p className="text-xs font-bold text-yellow-700 mb-1">Stars</p>
                  <p className="text-xl font-black text-yellow-900">{(balances?.starsBalance || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-3 border border-blue-200">
                  <p className="text-xs font-bold text-blue-700 mb-1">Lifetime Topups</p>
                  <p className="text-lg font-black text-blue-900">RM{(balances?.lifetimeTopup || 0).toFixed(2)}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-3 border border-gray-200">
                  <p className="text-xs font-bold text-gray-700 mb-1">Total Transactions</p>
                  <p className="text-lg font-black text-gray-900">{balances?.totalTransactions || 0}</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/wallet')}
                className="w-full mt-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Manage Wallet
              </button>
            </div>

            <div className="glass p-6 rounded-3xl space-y-4 shadow-xl animate-pop-in">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-black theme-text-primary">Account Information</h2>
                <button
                  onClick={() => setShowEditProfileModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="w-6 h-6 theme-text-secondary" />
                <div className="flex-1">
                  <p className="text-sm theme-text-secondary font-semibold">Email</p>
                  <p className="font-bold theme-text-primary">{user?.email}</p>
                </div>
              </div>

              {user?.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-6 h-6 theme-text-secondary" />
                  <div className="flex-1">
                    <p className="text-sm theme-text-secondary font-semibold">Phone</p>
                    <p className="font-bold theme-text-primary">{user.phone}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="glass p-6 rounded-3xl shadow-xl animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black theme-text-primary">Children</h2>
                <button
                  onClick={() => navigate('/add-child')}
                  className="text-sm text-primary-600 font-bold hover:scale-105 transition-transform"
                >
                  Add Child +
                </button>
              </div>

              {children.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-16 h-16 theme-text-tertiary mx-auto mb-2" />
                  <p className="theme-text-secondary font-medium">No children added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {children.map((child, index) => (
                    <button
                      key={child.id}
                      onClick={() => setEditingChild(child)}
                      className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border-2 border-primary-100 hover:border-primary-300 hover:scale-105 transition-all shadow-lg animate-pop-in cursor-pointer"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {child.photo_url ? (
                        <img
                          src={child.photo_url}
                          alt={child.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-primary-300 shadow-glow"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-black text-xl shadow-glow">
                          {child.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <p className="font-bold theme-text-primary">{child.name}</p>
                        {child.age && <p className="text-sm theme-text-secondary font-medium">{child.age} years old</p>}
                      </div>
                      <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg">
                        <ChevronRight className="w-5 h-5 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentTier && (
              <button
                onClick={() => setShowTierModal(true)}
                className="w-full glass p-6 rounded-3xl hover:scale-105 active:scale-95 transition-all shadow-xl animate-slide-up relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-6 h-6 text-primary-600" />
                      <h2 className="text-lg font-black theme-text-primary">Your Membership Tier</h2>
                    </div>
                    <div className="p-2 bg-primary-100 rounded-full">
                      <Info className="w-4 h-4 text-primary-600" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl shadow-lg ${currentTier.name === 'Bronze' ? 'bg-gradient-to-br from-amber-700 to-amber-900' :
                          currentTier.name === 'Silver' ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                            currentTier.name === 'Gold' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                              currentTier.name === 'Platinum' ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
                                'bg-gradient-to-br from-purple-500 to-purple-700'
                        }`}>
                        <Crown className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-2xl font-black theme-text-primary">{currentTier.name}</p>
                      </div>
                      <ChevronRight className="w-6 h-6 theme-text-tertiary" />
                    </div>

                    <div className="p-5 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl border-2 border-yellow-200">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-bold text-gray-700">Key Benefits</span>
                        <span className="px-3 py-1.5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-black">
                          Active
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center text-center p-3 bg-white/60 rounded-xl">
                          <Star className="w-7 h-7 text-yellow-600 mb-2" fill="currentColor" />
                          <p className="text-xs text-gray-600 font-semibold mb-1">Stars Multiplier</p>
                          <p className="text-lg font-black text-gray-900">{currentTier.earn_multiplier}x</p>
                        </div>
                        <div className="flex flex-col items-center text-center p-3 bg-white/60 rounded-xl">
                          <Crown className="w-7 h-7 text-amber-600 mb-2" />
                          <p className="text-xs text-gray-600 font-semibold mb-1">Perks</p>
                          <p className="text-lg font-black text-gray-900">Active</p>
                        </div>
                      </div>
                    </div>

                    {nextTier && (
                      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-bold text-gray-700">Next: {nextTier.name}</span>
                          </div>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black">
                            RM{(nextTier.threshold - (user?.lifetime_topups || 0)).toFixed(0)} to go
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                            style={{
                              width: `${Math.min(((user?.lifetime_topups || 0) - currentTier.threshold) / (nextTier.threshold - currentTier.threshold) * 100, 100)}%`
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 font-medium mt-2">
                          Unlock {nextTier.earn_multiplier}x stars & other benefits
                        </p>
                      </div>
                    )}

                  </div>
                </div>
              </button>
            )}


            <div className="space-y-3">
              <button
                onClick={handleLogout}
                className="w-full glass p-5 rounded-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all border-2 border-red-300 shadow-xl"
              >
                <LogOut className="w-7 h-7 text-red-600" />
                <span className="flex-1 text-left font-bold text-red-600 text-lg">Log Out</span>
              </button>
            </div>
          </>
        )}
      </div>

      {editingChild && (
        <EditChildModal
          child={editingChild}
          isOpen={!!editingChild}
          onClose={() => setEditingChild(null)}
          onUpdate={() => {
            loadChildren();
            setEditingChild(null);
          }}
        />
      )}

      {showEditProfileModal && (
        <EditProfileModal
          isOpen={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          onUpdate={async () => {
            await reloadUser();
            setShowEditProfileModal(false);
          }}
        />
      )}

      <TierBenefitsModal
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
      />
    </div>
  );
};

export default Profile;
