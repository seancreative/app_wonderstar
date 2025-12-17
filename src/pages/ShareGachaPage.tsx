import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, ExternalLink, Sparkles } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import BottomNav from '../components/Layout/BottomNav';
import confetti from 'canvas-confetti';
import '../styles/egg-gacha.css';

interface SocialTask {
  id: string;
  platform_name: string;
  task_type: string;
  task_description: string;
  link_url: string;
  icon_emoji: string;
  reward_spins: number;
  display_order: number;
}

interface CompletionResult {
  success: boolean;
  spins_awarded?: number;
  bonus_awarded?: boolean;
  total_completed?: number;
  platform_name?: string;
  error?: string;
}

const ShareGachaPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<SocialTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentTask, setCurrentTask] = useState<SocialTask | null>(null);
  const [freeSpins, setFreeSpins] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      loadTasksAndCompletions();
      loadFreeSpins();
    }
  }, [user, navigate]);

  const loadTasksAndCompletions = async () => {
    if (!user) return;

    try {
      const { supabase } = await import('../lib/supabase');

      const [tasksResult, completionsResult] = await Promise.all([
        supabase
          .from('social_tasks')
          .select('*')
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('user_social_tasks_completed')
          .select('social_task_id')
          .eq('user_id', user.id)
      ]);

      if (!tasksResult.error && tasksResult.data) {
        setTasks(tasksResult.data);
      }

      if (!completionsResult.error && completionsResult.data) {
        const completedIds = new Set(completionsResult.data.map(c => c.social_task_id));
        setCompletedTaskIds(completedIds);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFreeSpins = async () => {
    if (!user) return;

    try {
      const { supabase } = await import('../lib/supabase');
      const { data } = await supabase
        .from('users')
        .select('gacha_freespin')
        .eq('id', user.id)
        .single();

      if (data) {
        setFreeSpins(data.gacha_freespin || 0);
      }
    } catch (error) {
      console.error('Error loading free spins:', error);
    }
  };

  const handleTaskClick = (task: SocialTask) => {
    if (completedTaskIds.has(task.id)) return;

    window.open(task.link_url, '_blank');
    setCurrentTask(task);
    setShowConfirmModal(true);
  };

  const handleConfirmCompletion = async () => {
    if (!currentTask || !user || completing) return;

    setCompleting(true);

    try {
      const { supabase } = await import('../lib/supabase');

      const { data, error } = await supabase.rpc('complete_social_task', {
        p_user_id: user.id,
        p_social_task_id: currentTask.id
      });

      if (error) throw error;

      const result = data as CompletionResult;

      if (result.success) {
        setCompletedTaskIds(prev => new Set([...prev, currentTask.id]));
        await loadFreeSpins();
        await loadTasksAndCompletions();

        if (result.bonus_awarded) {
          setSuccessMessage(`🎉 MEGA BONUS! +${result.spins_awarded} FREE SPINS!\nYOU COMPLETED ALL TASKS!`);
          triggerBonusConfetti();
        } else {
          setSuccessMessage(`✨ SUCCESS! +${result.spins_awarded} FREE SPIN!`);
          triggerConfetti();
        }

        setShowSuccessModal(true);
      } else if (result.error) {
        alert(result.error);
      }
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task. Please try again.');
    } finally {
      setCompleting(false);
      setShowConfirmModal(false);
      setCurrentTask(null);
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const triggerBonusConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });

      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  };

  const completedCount = completedTaskIds.size;
  const allTasksCompleted = completedCount === tasks.length && tasks.length > 0;

  if (!user) return null;

  return (
    <div className="min-h-screen pb-28 bg-gradient-to-b from-purple-50 via-pink-50 to-orange-50">
      <PageHeader />

      <div
        className="fixed left-0 right-0 z-40 top-[72px] max-w-md mx-auto"
        style={{
          background: 'linear-gradient(135deg, #FF1493 0%, #FF8C00 100%)',
          border: '4px solid #000',
          borderTop: 'none',
          boxShadow: '0 4px 0 #000'
        }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
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
            SHARE & GACHA!
          </h1>

          <div
            className="flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)',
              border: '3px solid #000',
              boxShadow: '3px 3px 0 #000',
              padding: '0.4rem 0.6rem',
              borderRadius: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🎁</span>
            <span
              style={{
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                fontSize: '0.7rem',
                color: '#000',
                fontWeight: 'bold'
              }}
            >
              {freeSpins}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-[140px] px-4 pb-8 max-w-md mx-auto">
        <div
          className="mb-6 p-4 text-center"
          style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            border: '4px solid #000',
            boxShadow: '4px 4px 0 #000',
            borderRadius: '1rem',
            position: 'relative'
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6" style={{ color: '#FF1493' }} />
            <h2
              style={{
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                fontSize: '0.7rem',
                color: '#000',
                textShadow: '1px 1px 0 #FFF'
              }}
            >
              COMPLETE ALL = +6 SPINS!
            </h2>
            <Sparkles className="w-6 h-6" style={{ color: '#FF1493' }} />
          </div>

          <div className="mt-3">
            <div
              className="flex gap-1"
              style={{
                background: '#000',
                padding: '4px',
                borderRadius: '0.5rem'
              }}
            >
              {tasks.map((_, index) => (
                <div
                  key={index}
                  className="flex-1 h-6 rounded transition-all duration-300"
                  style={{
                    background: index < completedCount
                      ? 'linear-gradient(135deg, #00FF00 0%, #32CD32 100%)'
                      : '#666',
                    border: '2px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {index < completedCount && (
                    <CheckCircle className="w-4 h-4" style={{ color: '#000' }} />
                  )}
                </div>
              ))}
            </div>
            <p
              className="mt-2"
              style={{
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                fontSize: '0.6rem',
                color: '#000'
              }}
            >
              {completedCount}/{tasks.length} TASKS DONE!
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div
              className="inline-block w-12 h-12 border-4 border-black border-t-yellow-400 rounded-full animate-spin"
              style={{ borderRightColor: '#FF1493' }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const isCompleted = completedTaskIds.has(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  disabled={isCompleted}
                  className="w-full text-left transition-all duration-200"
                  style={{
                    background: isCompleted
                      ? 'linear-gradient(135deg, #888 0%, #666 100%)'
                      : 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0 #000',
                    borderRadius: '1rem',
                    padding: '1rem',
                    position: 'relative',
                    opacity: isCompleted ? 0.6 : 1,
                    cursor: isCompleted ? 'not-allowed' : 'pointer',
                    transform: 'scale(1)',
                    ...((!isCompleted && {
                      animation: 'bounce 2s infinite'
                    }))
                  }}
                  onMouseEnter={(e) => {
                    if (!isCompleted) {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = '6px 6px 0 #000';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCompleted) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '4px 4px 0 #000';
                    }
                  }}
                >
                  {isCompleted && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-12px',
                        right: '-12px',
                        background: 'linear-gradient(135deg, #00FF00 0%, #32CD32 100%)',
                        border: '4px solid #000',
                        borderRadius: '50%',
                        width: '48px',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        boxShadow: '3px 3px 0 #000'
                      }}
                    >
                      <CheckCircle className="w-6 h-6" style={{ color: '#000' }} />
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center"
                      style={{
                        fontSize: '2.5rem',
                        minWidth: '60px',
                        filter: 'drop-shadow(2px 2px 0 #000)'
                      }}
                    >
                      {task.icon_emoji}
                    </div>

                    <div className="flex-1">
                      <h3
                        style={{
                          fontFamily: "'Press Start 2P', 'Courier New', monospace",
                          fontSize: '0.7rem',
                          color: '#000',
                          marginBottom: '0.5rem',
                          textShadow: '1px 1px 0 rgba(255,255,255,0.5)'
                        }}
                      >
                        {task.platform_name}
                      </h3>
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: '#000',
                          marginBottom: '0.5rem'
                        }}
                      >
                        {task.task_description}
                      </p>
                      <div
                        className="inline-flex items-center gap-2 px-3 py-1"
                        style={{
                          background: isCompleted ? '#555' : '#FF1493',
                          border: '2px solid #000',
                          borderRadius: '0.5rem',
                          boxShadow: '2px 2px 0 #000'
                        }}
                      >
                        {isCompleted ? (
                          <span
                            style={{
                              fontFamily: "'Press Start 2P', 'Courier New', monospace",
                              fontSize: '0.6rem',
                              color: '#FFF',
                              textShadow: '1px 1px 0 #000'
                            }}
                          >
                            COMPLETED!
                          </span>
                        ) : (
                          <>
                            <ExternalLink className="w-3 h-3" style={{ color: '#FFFF00' }} />
                            <span
                              style={{
                                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                                fontSize: '0.6rem',
                                color: '#FFFF00',
                                textShadow: '1px 1px 0 #000'
                              }}
                            >
                              +{task.reward_spins} SPIN!
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {allTasksCompleted && (
              <div
                className="p-6 text-center"
                style={{
                  background: 'linear-gradient(135deg, #FF1493 0%, #FFD700 50%, #00FFFF 100%)',
                  border: '6px solid #000',
                  boxShadow: '6px 6px 0 #000',
                  borderRadius: '1rem',
                  animation: 'bounce 1s infinite'
                }}
              >
                <div className="text-6xl mb-3">🎉</div>
                <h2
                  style={{
                    fontFamily: "'Press Start 2P', 'Courier New', monospace",
                    fontSize: '0.9rem',
                    color: '#000',
                    textShadow: '2px 2px 0 #FFF',
                    marginBottom: '0.5rem'
                  }}
                >
                  MEGA BONUS!
                </h2>
                <p
                  style={{
                    fontFamily: "'Press Start 2P', 'Courier New', monospace",
                    fontSize: '0.7rem',
                    color: '#000',
                    textShadow: '1px 1px 0 #FFF'
                  }}
                >
                  ALL TASKS COMPLETE!
                </p>
                <div className="text-5xl mt-3">✨</div>
              </div>
            )}

            <button
              onClick={() => navigate('/egg-gacha')}
              className="w-full py-4 mt-6"
              style={{
                background: 'linear-gradient(135deg, #FF1493 0%, #FF8C00 100%)',
                border: '4px solid #000',
                boxShadow: '4px 4px 0 #000',
                borderRadius: '1rem',
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                fontSize: '0.8rem',
                color: '#FFFF00',
                textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
                cursor: 'pointer',
                animation: 'bounce 2s infinite'
              }}
            >
              🎰 GO SPIN NOW! 🎰
            </button>
          </div>
        )}
      </div>

      {showConfirmModal && currentTask && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => !completing && setShowConfirmModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              border: '6px solid #000',
              boxShadow: '8px 8px 0 #000',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '400px',
              width: '100%'
            }}
          >
            <h2
              className="text-center mb-4"
              style={{
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                fontSize: '0.8rem',
                color: '#000',
                lineHeight: '1.5'
              }}
            >
              DID YOU COMPLETE THIS TASK?
            </h2>

            <div className="text-center mb-6">
              <div className="text-5xl mb-2">{currentTask.icon_emoji}</div>
              <p
                style={{
                  fontFamily: "'Press Start 2P', 'Courier New', monospace",
                  fontSize: '0.7rem',
                  color: '#000'
                }}
              >
                {currentTask.platform_name}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmCompletion}
                disabled={completing}
                className="flex-1 py-3"
                style={{
                  background: 'linear-gradient(135deg, #00FF00 0%, #32CD32 100%)',
                  border: '4px solid #000',
                  boxShadow: '4px 4px 0 #000',
                  borderRadius: '0.5rem',
                  fontFamily: "'Press Start 2P', 'Courier New', monospace",
                  fontSize: '0.6rem',
                  color: '#000',
                  cursor: completing ? 'not-allowed' : 'pointer',
                  opacity: completing ? 0.6 : 1
                }}
              >
                {completing ? 'WAIT...' : 'YES, I DID!'}
              </button>

              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={completing}
                className="flex-1 py-3"
                style={{
                  background: 'linear-gradient(135deg, #FF0000 0%, #DC143C 100%)',
                  border: '4px solid #000',
                  boxShadow: '4px 4px 0 #000',
                  borderRadius: '0.5rem',
                  fontFamily: "'Press Start 2P', 'Courier New', monospace",
                  fontSize: '0.6rem',
                  color: '#FFF',
                  textShadow: '1px 1px 0 #000',
                  cursor: completing ? 'not-allowed' : 'pointer',
                  opacity: completing ? 0.6 : 1
                }}
              >
                NOT YET
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => setShowSuccessModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="text-center"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              border: '6px solid #000',
              boxShadow: '8px 8px 0 #000',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '400px',
              width: '100%',
              animation: 'bounce 0.5s'
            }}
          >
            <div className="text-6xl mb-4">🎉</div>
            <p
              style={{
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                fontSize: '0.7rem',
                color: '#000',
                lineHeight: '1.8',
                whiteSpace: 'pre-line'
              }}
            >
              {successMessage}
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="mt-6 px-6 py-3"
              style={{
                background: 'linear-gradient(135deg, #00FFFF 0%, #00CED1 100%)',
                border: '4px solid #000',
                boxShadow: '4px 4px 0 #000',
                borderRadius: '0.5rem',
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                fontSize: '0.6rem',
                color: '#000',
                cursor: 'pointer'
              }}
            >
              AWESOME!
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default ShareGachaPage;
