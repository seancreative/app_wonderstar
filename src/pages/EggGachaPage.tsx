import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStars } from '../hooks/useStars';
import { EggGachaMachine } from '../components/EggGachaMachine';
import { ArrowLeft, Share2 } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import '../styles/egg-gacha.css';

const EggGachaPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { starsBalance, refresh: refreshStars } = useStars();
  const [machineKey, setMachineKey] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [allTasksCompleted, setAllTasksCompleted] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      loadFreeSpins();
      checkTaskCompletion();
    }
  }, [user, navigate]);

  const loadFreeSpins = async () => {
    if (!user) return;

    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase
        .from('users')
        .select('gacha_freespin')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setFreeSpins(data.gacha_freespin || 0);
      }
    } catch (error) {
      console.error('Error loading free spins:', error);
    }
  };

  const checkTaskCompletion = async () => {
    if (!user) return;

    try {
      const { supabase } = await import('../lib/supabase');

      // Get total number of active tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('social_tasks')
        .select('id')
        .eq('is_active', true);

      if (tasksError) throw tasksError;

      // Get user's completed tasks
      const { data: completed, error: completedError } = await supabase
        .from('user_social_tasks_completed')
        .select('id')
        .eq('user_id', user.id);

      if (completedError) throw completedError;

      // Check if all tasks are completed
      if (tasks && completed && tasks.length > 0 && completed.length === tasks.length) {
        setAllTasksCompleted(true);
      } else {
        setAllTasksCompleted(false);
      }
    } catch (error) {
      console.error('Error checking task completion:', error);
    }
  };

  const handleReset = () => {
    refreshStars();
    loadFreeSpins();
    checkTaskCompletion();
    setMachineKey(prev => prev + 1);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-28 bg-gradient-to-b from-purple-50 via-pink-50 to-orange-50">
      <PageHeader />

      <div
        className="fixed left-0 right-0 z-40 top-[72px] max-w-md mx-auto"
        style={{
          background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 100%)',
          border: '4px solid #000',
          borderTop: 'none',
          boxShadow: '0 4px 0 #000'
        }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="rounded-lg"
            style={{
              background: '#FFD700',
              border: '3px solid #000',
              boxShadow: '3px 3px 0 #000',
              padding: '0.5rem'
            }}
          >
            <ArrowLeft className="w-5 h-5" style={{ color: '#000' }} />
          </button>
          {freeSpins > 0 && (
            <div
              style={{
                position: 'relative',
                animation: 'bounce 1s infinite'
              }}
            >
              <div
                className="flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)',
                  border: '4px solid #000',
                  boxShadow: '4px 4px 0 #000',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.5rem',
                  position: 'relative'
                }}
              >
                <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(2px 2px 0 #000)' }}>🎁</span>
                <span
                  style={{
                    fontFamily: "'Press Start 2P', 'Courier New', monospace",
                    fontSize: '0.85rem',
                    color: '#000',
                    fontWeight: 'bold',
                    textShadow: '-1px -1px 0 #FFF, 1px -1px 0 #FFF, -1px 1px 0 #FFF, 1px 1px 0 #FFF'
                  }}
                >
                  x{freeSpins}
                </span>
                <div
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '-10px',
                    
                 
                    padding: '0.15rem 0.35rem',
                    borderRadius: '0.25rem',
                    transform: 'rotate(-12deg)',
                    zIndex: 10
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Press Start 2P', 'Courier New', monospace",
                      fontSize: '0.5rem',
                      color: '#FFFF00',
                      fontWeight: 'bold',
                      textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                      letterSpacing: '0.05rem',
                      textTransform: 'uppercase'
                    }}
                  >
                    FREE
                  </span>
                </div>
              </div>
            </div>
          )}
          <h1
            className="font-bold uppercase flex-1"
            style={{
              fontSize: '0.8rem',
              color: '#FFFF00',
              letterSpacing: '0.05rem',
              textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
              fontFamily: "'Press Start 2P', 'Courier New', monospace",
              lineHeight: '1.4'
            }}
          >
            Gacha & Sure Win! U hav {starsBalance} Stars. Win RM0.5 to RM50!
          </h1>
        </div>
      </div>

      {!allTasksCompleted && (
        <button
          onClick={() => navigate('/share-gacha')}
          className="fixed left-0 right-0 z-30 max-w-md mx-auto"
          style={{
            top: '158px',
            background: 'linear-gradient(135deg, #00FFFF 0%, #00CED1 100%)',
            border: '4px solid #000',
            borderTop: 'none',
            boxShadow: '0 4px 0 #000',
            padding: '0.75rem',
            cursor: 'pointer'
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <Share2 className="w-5 h-5" style={{ color: '#000' }} />
            <span
              style={{
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                fontSize: '0.7rem',
                color: '#000',
                textShadow: '1px 1px 0 #FFF',
                textTransform: 'uppercase'
              }}
            >
              SHARE & FREE SPIN!
            </span>
            <span style={{ fontSize: '1.2rem' }}>🎁</span>
          </div>
        </button>
      )}

      <div className={allTasksCompleted ? "mt-[128px] px-4" : "mt-[180px] px-4"} id="egg-gacha-app">
        <EggGachaMachine
          key={machineKey}
          onReset={handleReset}
          currentStars={starsBalance}
          onStarsUpdate={refreshStars}
          freeSpins={freeSpins}
          onFreeSpinsUpdate={loadFreeSpins}
        />
      </div>

      <BottomNav />
    </div>
  );
};

export default EggGachaPage;
