import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useStars } from '../hooks/useStars';
import { Star, CheckCircle, Target, Calendar, TrendingUp } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import type { Mission, MissionProgress } from '../types/database';

const Missions: React.FC = () => {
  const { user } = useAuth();
  const { earnStars, currentTier } = useStars();
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'seasonal'>('active');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [progress, setProgress] = useState<Record<string, MissionProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMissions();
    if (user) {
      loadProgress();
    }
  }, [user, activeTab]);

  const loadMissions = async () => {
    setLoading(true);
    try {
      let query = supabase.from('missions').select('*').eq('is_active', true);

      if (activeTab === 'seasonal') {
        query = query.eq('is_seasonal', true);
      } else if (activeTab === 'active') {
        query = query.eq('is_seasonal', false);
      }

      const { data } = await query.order('reward_stars', { ascending: false });
      setMissions(data || []);
    } catch (error) {
      console.error('Error loading missions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('mission_progress')
        .select('*')
        .eq('user_id', user.id);

      const progressMap: Record<string, MissionProgress> = {};
      data?.forEach((p) => {
        progressMap[p.mission_id] = p;
      });
      setProgress(progressMap);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const handleClaimMission = async (mission: Mission) => {
    if (!user || !currentTier) return;

    const missionProgress = progress[mission.id];
    if (!missionProgress || !missionProgress.is_completed || missionProgress.claimed_at) {
      return;
    }

    try {
      const bonusStars = currentTier.mission_bonus_stars;
      const totalStars = mission.reward_stars + bonusStars;

      await earnStars(totalStars, `Mission: ${mission.title}`, { missionId: mission.id });

      await supabase
        .from('mission_progress')
        .update({ claimed_at: new Date().toISOString() })
        .eq('id', missionProgress.id);

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Mission Complete!',
        message: `You earned ${totalStars} stars from "${mission.title}"`,
        notification_type: 'mission',
      });

      await loadProgress();
    } catch (error) {
      console.error('Error claiming mission:', error);
    }
  };

  const handleStartMission = async (mission: Mission) => {
    if (!user) return;

    try {
      await supabase.from('mission_progress').insert({
        user_id: user.id,
        mission_id: mission.id,
        current_progress: 0,
        is_completed: false,
      });

      await loadProgress();
    } catch (error) {
      console.error('Error starting mission:', error);
    }
  };

  const getMissionIcon = (type: string) => {
    switch (type) {
      case 'visit':
      case 'checkin':
        return Target;
      case 'workshop':
        return Calendar;
      case 'spend':
        return TrendingUp;
      default:
        return Star;
    }
  };

  const filteredMissions = missions.filter((mission) => {
    const missionProgress = progress[mission.id];
    if (activeTab === 'completed') {
      return missionProgress?.is_completed;
    }
    return !missionProgress?.is_completed;
  });

  return (
    <div className="min-h-screen pb-28 bg-gradient-to-b from-primary-50 to-white">
      <PageHeader />
      <div className="max-w-md mx-auto px-6 pt-6 space-y-6">
        <div className="text-center animate-slide-up">
          <h1 className="text-4xl font-black text-gray-900">Missions</h1>
          <p className="text-gray-700 font-medium mt-2">Complete challenges and earn stars</p>
        </div>

        <div className="glass p-2 rounded-2xl flex gap-2 shadow-xl animate-pop-in">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'active'
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow scale-105'
                : 'text-gray-700 hover:bg-white/50'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'completed'
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow scale-105'
                : 'text-gray-700 hover:bg-white/50'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setActiveTab('seasonal')}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'seasonal'
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow scale-105'
                : 'text-gray-700 hover:bg-white/50'
            }`}
          >
            Seasonal
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mx-auto"></div>
          </div>
        ) : filteredMissions.length === 0 ? (
          <div className="glass p-8 rounded-3xl text-center shadow-xl animate-slide-up">
            <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">No missions available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMissions.map((mission) => {
              const Icon = getMissionIcon(mission.mission_type);
              const missionProgress = progress[mission.id];
              const isStarted = !!missionProgress;
              const isCompleted = missionProgress?.is_completed;
              const isClaimed = missionProgress?.claimed_at;

              return (
                <div key={mission.id} className="glass p-6 rounded-3xl space-y-4 shadow-xl hover:scale-105 transition-all animate-pop-in">
                  <div className="flex items-start gap-4">
                    <div className="p-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-glow animate-bounce-soft">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-base">{mission.title}</h3>
                          <p className="text-sm text-gray-700 font-medium mt-1">{mission.description}</p>
                        </div>
                        <div className="flex items-center gap-1 px-4 py-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full whitespace-nowrap shadow-glow">
                          <Star className="w-5 h-5 text-white" fill="white" />
                          <span className="text-sm font-black text-white">
                            +{mission.reward_stars}
                            {currentTier && currentTier.mission_bonus_stars > 0 && (
                              <span className="text-xs">+{currentTier.mission_bonus_stars}</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {isStarted && !isCompleted && (
                        <div className="mt-3">
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                            <div
                              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 shadow-glow"
                              style={{
                                width: `${Math.min((missionProgress.current_progress / mission.requirement_value) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-sm text-gray-700 font-bold mt-2">
                            {missionProgress.current_progress} / {mission.requirement_value}
                          </p>
                        </div>
                      )}

                      {mission.is_seasonal && (
                        <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-gradient-to-r from-orange-100 to-amber-100 rounded-full w-fit border border-orange-300">
                          <Calendar className="w-4 h-4 text-orange-600" />
                          <span className="text-xs font-bold text-orange-700">Limited Time</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {!isStarted ? (
                      <button
                        onClick={() => handleStartMission(mission)}
                        className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-black text-base hover:scale-105 active:scale-95 transition-transform shadow-glow"
                      >
                        Start Mission
                      </button>
                    ) : isCompleted && !isClaimed ? (
                      <button
                        onClick={() => handleClaimMission(mission)}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-black text-base hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-glow-gold"
                      >
                        <CheckCircle className="w-6 h-6" />
                        Claim Reward
                      </button>
                    ) : isClaimed ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 py-4">
                        <CheckCircle className="w-6 h-6" />
                        <span className="font-black text-base">Claimed</span>
                      </div>
                    ) : (
                      <div className="text-center text-gray-700 py-4">
                        <span className="font-bold">In Progress...</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Missions;
