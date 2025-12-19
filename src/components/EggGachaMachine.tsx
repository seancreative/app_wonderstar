import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gachaService, GachaSpinResult } from '../services/gachaService';
import { activityTimelineService } from '../services/activityTimelineService';
import { confetti } from '../utils/eggConfetti';
import gsap from 'gsap';

interface Ball {
  id: number;
  x: number;
  y: number;
  rotate: number;
  hue: number;
  size: number;
}

const SPEED = 1;

interface EggGachaMachineProps {
  onReset?: () => void;
  currentStars: number;
  onStarsUpdate: () => void;
  freeSpins: number;
  onFreeSpinsUpdate: () => void;
}

export const EggGachaMachine: React.FC<EggGachaMachineProps> = ({ onReset, currentStars, onStarsUpdate, freeSpins, onFreeSpinsUpdate }) => {
  const { user } = useAuth();
  const [started, setStarted] = useState(false);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [prizeBall, setPrizeBall] = useState<Ball | null>(null);
  const [prize, setPrize] = useState<GachaSpinResult | null>(null);
  const [showPrize, setShowPrize] = useState(false);
  const [hintText, setHintText] = useState('Tap to get a prize!');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spinType, setSpinType] = useState<'free' | 'stars'>('stars');
  const [isProcessing, setIsProcessing] = useState(false);

  const machineRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const prizeBallRef = useRef<HTMLDivElement>(null);
  const prizeContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);

  const jitterTimelines = useRef<gsap.core.Timeline[]>([]);

  useEffect(() => {
    createBalls();
    prepare();
  }, []);

  const createBalls = () => {
    const ballsData: Ball[] = [];
    let id = 0;

    const createBall = (x: number, y: number, rotate: number = Math.floor(Math.random() * 360), hue: number = Math.floor(Math.random() * 360)): Ball => {
      return {
        id: ++id,
        x,
        y,
        rotate,
        hue,
        size: 8
      };
    };

    ballsData.push(createBall(0.5, 0.6));
    ballsData.push(createBall(0, 0.68));
    ballsData.push(createBall(0.22, 0.65));
    ballsData.push(createBall(0.7, 0.63));
    ballsData.push(createBall(0.96, 0.66));
    ballsData.push(createBall(0.75, 0.79));
    ballsData.push(createBall(0.5, 0.8));

    const prizeB = createBall(0.9, 0.81);
    ballsData.push(prizeB);
    setPrizeBall(prizeB);

    ballsData.push(createBall(0, 0.82));
    ballsData.push(createBall(1, 0.9));
    ballsData.push(createBall(0.25, 0.85));
    ballsData.push(createBall(0.9, 1));
    ballsData.push(createBall(0.4, 1));
    ballsData.push(createBall(0.65, 1));
    ballsData.push(createBall(0.09, 1));

    setBalls(ballsData);
  };

  const prepare = () => {
    setTimeout(() => {
      if (!machineRef.current) return;

      gsap.set(machineRef.current, { y: '100vh' });
      gsap.set(titleRef.current, { y: '120vh' });
      gsap.set(pointerRef.current, { opacity: 0 });
      gsap.set(prizeContainerRef.current, { opacity: 0 });

      gsap.to(machineRef.current, {
        y: '0vh',
        ease: 'none',
        duration: 0.6,
        onComplete: () => {
          setTimeout(() => {
            if (!started) {
              showHint();
            }
          }, 2000 * SPEED);
        }
      });
    }, 500 * SPEED);
  };

  const showHint = () => {
    gsap.to(titleRef.current, {
      y: '80vh',
      duration: 1,
      ease: 'back.out'
    });

    gsap.to(pointerRef.current, {
      opacity: 1,
      duration: 1,
      ease: 'none'
    });
  };

  const hideHint = () => {
    gsap.to(titleRef.current, {
      y: '120vh',
      duration: 0.6
    });

    gsap.to(pointerRef.current, {
      opacity: 0,
      duration: 1
    });
  };

  const showHint2 = () => {
    setHintText('Tap to claim it!');
    gsap.set(pointerRef.current, {
      x: '16vh',
      y: '3vh'
    });

    gsap.to(titleRef.current, {
      y: '80vh',
      duration: 1,
      ease: 'back.out'
    });

    gsap.to(pointerRef.current, {
      opacity: 1,
      duration: 1,
      ease: 'none'
    });
  };

  const jitter = () => {
    balls.forEach((ball, i) => {
      const ballEl = document.querySelector(`[data-ball-id="${ball.id}"]`) as HTMLElement;
      if (!ballEl) return;

      const tl = gsap.timeline({ repeat: -1, delay: -i * 0.0613 });
      gsap.set(ballEl, { y: 0, rotateZ: ball.rotate });

      const duration = Math.random() * 0.1 + 0.05;

      tl.to(ballEl, {
        y: -(Math.random() * 6 + 2),
        rotateZ: ball.rotate,
        duration,
        ease: 'power1.out'
      }).to(ballEl, {
        y: 0,
        rotateZ: ball.rotate - Math.random() * 10 - 5,
        duration,
      });

      jitterTimelines.current.push(tl);
    });

    const machineTl = gsap.timeline({ repeat: -1 });
    machineTl.to('.machine-container', {
      x: 2,
      duration: 0.1
    }).to('.machine-container', {
      x: 0,
      duration: 0.1
    });

    jitterTimelines.current.push(machineTl);
  };

  const stopJittering = async () => {
    jitterTimelines.current.forEach(tl => tl.pause());

    balls.forEach((ball) => {
      const ballEl = document.querySelector(`[data-ball-id="${ball.id}"]`) as HTMLElement;
      if (ballEl) {
        gsap.to(ballEl, {
          y: 0,
          rotate: ball.rotate,
          duration: 0.1
        });
      }
    });

    gsap.to('.machine-container', {
      x: 0,
      duration: 0.1
    });

    await new Promise(resolve => setTimeout(resolve, 200));
  };

  const handleClickHandle = () => {
    if (started) return;

    // Check free spins first
    if (freeSpins > 0) {
      setSpinType('free');
      setShowConfirmDialog(true);
    } else if (currentStars < 50) {
      setErrorMessage(`Not enough stars! You need 50 stars to spin. You have ${currentStars} stars.`);
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    } else {
      setSpinType('stars');
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmSpin = async () => {
    setShowConfirmDialog(false);

    if (spinType === 'free') {
      await useFreeSpinAndSpin();
    } else {
      await deductStarsAndSpin();
    }
  };

  const handleCancelSpin = () => {
    setShowConfirmDialog(false);
  };

  // Unified spin handler that uses backend for atomic operations
  const processSpinViaBackend = async (type: 'free' | 'stars') => {
    if (!user) return;

    setIsProcessing(true);

    try {
      console.log(`[Gacha] Processing ${type} spin via backend...`);

      const result = await gachaService.spin({
        email: user.email,
        spinType: type,
      });

      if (!result.success) {
        throw new Error(result.error || 'Spin failed');
      }

      console.log('[Gacha] Backend spin result:', result);

      // Store the result for display later
      setPrize(result);

      // Refresh balances
      onStarsUpdate();
      onFreeSpinsUpdate();

      // Start the animation
      await handleStart();
    } catch (error) {
      console.error('Error processing spin:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to spin. Please try again.');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const useFreeSpinAndSpin = async () => {
    await processSpinViaBackend('free');
  };

  const deductStarsAndSpin = async () => {
    await processSpinViaBackend('stars');
  };

  const handleStart = async () => {
    if (!handleRef.current || !prizeBallRef.current) return;

    setStarted(true);
    hideHint();

    await new Promise<void>(resolve => {
      const tl = gsap.timeline();
      tl.to(handleRef.current, {
        rotate: 90,
        duration: 0.3,
        ease: 'power1.in',
        async onComplete() {
          jitter();
          await new Promise(r => setTimeout(r, 2000 * SPEED));
          await stopJittering();
          resolve();
        }
      }).to(handleRef.current, {
        rotate: 0,
        duration: 1,
      });
    });

    await ballDrop();

    let shouldShowHint = true;

    const clickHandler = () => {
      shouldShowHint = false;
      hideHint();
      pickup();
    };

    if (prizeBallRef.current) {
      prizeBallRef.current.style.cursor = 'pointer';
      prizeBallRef.current.addEventListener('click', clickHandler, { once: true });
    }

    await new Promise(r => setTimeout(r, 2000));
    if (shouldShowHint) {
      showHint2();
    }
  };

  const ballDrop = async () => {
    if (!prizeBall) return;

    const prizeBallEl = document.querySelector(`[data-ball-id="${prizeBall.id}"]`) as HTMLElement;
    const ball3 = document.querySelector(`[data-ball-id="4"]`) as HTMLElement;
    const ball4 = document.querySelector(`[data-ball-id="5"]`) as HTMLElement;
    const ball5 = document.querySelector(`[data-ball-id="6"]`) as HTMLElement;

    if (prizeBallEl) {
      gsap.to(prizeBallEl, {
        x: '-3vh',
        ease: 'none',
        duration: 0.5,
        rotate: prizeBall.rotate + 10
      });
    }

    if (ball3) gsap.to(ball3, { x: '1vh', y: '1vh', ease: 'none', duration: 0.5, rotate: balls[3].rotate - 5 });
    if (ball4) gsap.to(ball4, { x: '-1vh', y: '1vh', ease: 'none', duration: 0.5, rotate: balls[4].rotate - 5 });
    if (ball5) gsap.to(ball5, { x: '1vh', y: '1vh', ease: 'none', duration: 0.5, rotate: balls[5].rotate - 5 });

    await new Promise<void>(resolve => {
      if (!prizeBallEl) return resolve();

      const tl = gsap.timeline();
      tl.to(prizeBallEl, { y: '12vh', ease: 'power1.in', duration: 0.5 })
        .to(prizeBallEl, { y: '23vh', ease: 'power1.in', duration: 0.5 })
        .to(prizeBallEl, { y: '22vh', ease: 'power1.out', duration: 0.2 })
        .to(prizeBallEl, { y: '23vh', ease: 'power1.in', duration: 0.2 })
        .to(prizeBallEl, { y: '22.5vh', ease: 'power1.out', duration: 0.1 })
        .to(prizeBallEl, { y: '23vh', ease: 'power1.in', duration: 0.1, onComplete: resolve });
    });
  };

  const pickup = async () => {
    if (!prizeBall || !appRef.current) return;

    const prizeBallEl = document.querySelector(`[data-ball-id="${prizeBall.id}"]`) as HTMLElement;
    if (!prizeBallEl) return;

    const rect = prizeBallEl.getBoundingClientRect();
    let x = rect.x / window.innerHeight * 100;
    let y = rect.y / window.innerHeight * 100;

    const prizeBallContainer = document.querySelector('.prize-ball-container');
    if (prizeBallContainer) {
      prizeBallContainer.appendChild(prizeBallEl);
    }

    const gameLayer = document.querySelector('.game-layer');
    if (gameLayer) {
      gameLayer.classList.add('dim');
      gameLayer.setAttribute('data-animate', '');
    }

    prizeBallEl.style.left = '0';
    prizeBallEl.style.top = '0';

    gsap.set(prizeBallEl, {
      x: `${x}vh`,
      y: `${y}vh`,
      rotate: prizeBall.rotate,
      duration: 1
    });

    gsap.to('.prize-container .prize-ball-container', {
      x: '-4vh',
      y: '-4vh',
      duration: 1
    });

    const tl = gsap.timeline();
    tl.to(prizeBallEl, {
      x: '50vw',
      y: '50vh',
      scale: 2,
      rotate: -180,
      duration: 1
    }).to(prizeBallEl, {
      duration: 0.1,
      scaleX: 2.1,
      ease: 'power1.inOut',
      scaleY: 1.9
    }).to(prizeBallEl, {
      duration: 0.1,
      ease: 'power1.inOut',
      scaleX: 1.9,
      scaleY: 2.1
    }).to(prizeBallEl, {
      duration: 0.1,
      ease: 'power1.inOut',
      scaleX: 2.1,
      scaleY: 1.9
    }).to(prizeBallEl, {
      duration: 0.1,
      ease: 'power1.inOut',
      scaleX: 1.9,
      scaleY: 2.1
    }).to(prizeBallEl, {
      duration: 0.1,
      ease: 'power1.inOut',
      scaleX: 2.1,
      scaleY: 1.9
    }).to(prizeBallEl, {
      duration: 0.1,
      ease: 'power1.inOut',
      scaleX: 1.9,
      scaleY: 2.1
    }).to(prizeBallEl, {
      duration: 0.5,
      ease: 'power1.out',
      scaleX: 2.6,
      scaleY: 1.6
    }).to(prizeBallEl, {
      duration: 0.1,
      ease: 'power1.out',
      scaleX: 1.6,
      scaleY: 2.4,
      onComplete: () => pop(prizeBallEl)
    }).to(prizeBallEl, {
      duration: 0.1,
      ease: 'power1.out',
      scaleX: 2.1,
      scaleY: 1.9,
    }).to(prizeBallEl, {
      duration: 0.1,
      ease: 'power1.out',
      scaleX: 2,
      scaleY: 2
    });
  };

  const pop = async (prizeBallEl: HTMLElement) => {
    if (!user || !appRef.current) return;

    confetti(appRef.current, {
      speedY: -0.5,
      speedRandY: 1,
      speedRandX: 0.75,
      gravity: 0.02,
      y: 50,
      randX: 6,
      randY: 6,
      size: 8,
      sizeRand: 4,
      count: 128
    });

    // Prize was already claimed via backend in processSpinViaBackend
    // Just show the stored result
    setShowPrize(true);

    // Log gacha spin activity
    if (prize?.status === 'ok') {
      try {
        await activityTimelineService.helpers.logGachaSpin(
          user.id,
          prize.reward_label || 'Prize',
          50
        );
      } catch (activityError) {
        console.warn('Failed to log gacha spin activity:', activityError);
      }
    }

    gsap.set('.prize-reward-container .prize', { scale: 0 });
    gsap.to(prizeContainerRef.current, { opacity: 1, duration: 0.3 });
    gsap.to('.prize-reward-container .prize', { scale: 1, duration: 0.5, ease: 'back.out' });
    gsap.to(prizeBallEl, { opacity: 0 });

    gsap.set(titleRef.current, { y: '-50vh' });
    setHintText(prize?.status === 'ok' ? `You got ${prize.reward_label}!` : 'No prizes left!');

    gsap.to(titleRef.current, {
      delay: 1,
      y: '5vh',
      duration: 0.6
    });

    gsap.to(machineRef.current, {
      y: '100vh',
      duration: 1,
      delay: 1
    });
  };

  const getPrizeIcon = () => {
    if (!prize || prize.status !== 'ok') return '💔';
    const amount = prize.reward_amount || 0;
    if (amount === 0) return '💔';
    if (amount < 1) return '🎁';
    if (amount < 5) return '💝';
    if (amount < 10) return '🎉';
    return '💎';
  };

  const handleSpinAgain = () => {
    // Fade out the prize popup
    gsap.to(prizeContainerRef.current, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        // Reset the component by calling parent's reset handler
        if (onReset) {
          onReset();
        }
      }
    });
  };

  return (
    <div ref={appRef} id="app" className="gotcha">
      <div className="container">
        <div className="game-layer dim">
          <div ref={machineRef} className="machine-container">
            <div className="backboard"></div>
            <div className="balls">
              {balls.map((ball) => (
                <figure
                  key={ball.id}
                  data-ball-id={ball.id}
                  ref={ball.id === prizeBall?.id ? prizeBallRef : undefined}
                  className="ball"
                  style={{
                    '--size': `${ball.size}vh`,
                    '--color1': `hsl(${ball.hue}deg, 80%, 70%)`,
                    '--color2': `hsl(${ball.hue + 20}deg, 50%, 90%)`,
                    '--outline': `hsl(${ball.hue}deg, 50%, 55%)`,
                    left: `calc(${ball.x} * (100% - ${ball.size}vh))`,
                    top: `calc(${ball.y} * (100% - ${ball.size}vh))`,
                    transform: `rotate(${ball.rotate}deg)`
                  } as React.CSSProperties}
                />
              ))}
            </div>
            <img className="machine" src="https://assets.codepen.io/2509128/gotcha.svg" alt="Gacha Machine" />
            <div className="title">
              {'Wonderpark'.split('').map((char, i) => (
                <span key={i}>{char}</span>
              ))}
            </div>
            <img
              ref={handleRef}
              className="handle"
              src="https://assets.codepen.io/2509128/handle.svg"
              alt="Handle"
              onClick={handleClickHandle}
              style={{ cursor: started ? 'default' : 'pointer' }}
            />
            <div ref={pointerRef} className="pointer">
              <img src="https://assets.codepen.io/2509128/point.png" alt="Pointer" />
            </div>
          </div>
        </div>
        <div className="ui-layer">
          <div className="title-container">
            <div ref={titleRef} className="title">
              <h2 className="wiggle">{hintText}</h2>
            </div>
          </div>
          <div className="prize-container">
            <div className="prize-ball-container"></div>
            <div ref={prizeContainerRef} className="prize-reward-container" style={{ pointerEvents: showPrize ? 'auto' : 'none' }}>
              <div className="shine"></div>
              <div className="prize">
                <div className="wiggle" style={{ fontSize: '15vh' }}>
                  {showPrize && getPrizeIcon()}
                </div>
                {showPrize && prize?.status === 'ok' && (
                  <div style={{
                    marginTop: '2rem',
                    color: '#000',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    textShadow: '-2px -2px 0 #FFF, 2px -2px 0 #FFF, -2px 2px 0 #FFF, 2px 2px 0 #FFF',
                    fontFamily: "'Press Start 2P', 'Courier New', monospace"
                  }}>
                    <div style={{
                      fontSize: '3vh',
                      fontWeight: 'bold',
                      letterSpacing: '0.15vh',
                      fontFamily: "'Press Start 2P', 'Courier New', monospace",

                      marginBottom: '1vh'

                    }}>
                      YOU WON!
                    </div>
                    <div style={{
                      fontSize: '3.5vh',
                      fontWeight: 'bold',
                      letterSpacing: '0.15vh',
                      marginBottom: '1.5vh'
                    }}>
                      RM {prize.reward_amount?.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: '1.6vh',
                      marginBottom: '2vh',
                      lineHeight: '1.5'
                    }}>
                      Added to Bonus!
                    </div>
                    <button
                      onClick={handleSpinAgain}
                      style={{
                        background: '#00FFFF',
                        border: '4px solid #000',
                        boxShadow: '6px 6px 0 #000',
                        padding: '1.5vh 3vh',
                        fontSize: '2vh',
                        fontWeight: 'bold',
                        color: '#000',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        fontFamily: "'Press Start 2P', 'Courier New', monospace",
                        letterSpacing: '0.1vh',
                        transition: 'transform 0.1s',
                        marginTop: '1vh'
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'translate(3px, 3px)';
                        e.currentTarget.style.boxShadow = '3px 3px 0 #000';
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'translate(0, 0)';
                        e.currentTarget.style.boxShadow = '6px 6px 0 #000';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translate(0, 0)';
                        e.currentTarget.style.boxShadow = '6px 6px 0 #000';
                      }}
                    >
                      SPIN AGAIN
                    </button>
                  </div>
                )}
                {showPrize && prize?.status !== 'ok' && (
                  <div style={{
                    marginTop: '2rem',
                    color: '#000',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    textShadow: '-2px -2px 0 #FFF, 2px -2px 0 #FFF, -2px 2px 0 #FFF, 2px 2px 0 #FFF',
                    fontFamily: "'Press Start 2P', 'Courier New', monospace"
                  }}>
                    <div style={{
                      fontSize: '2.5vh',
                      fontWeight: 'bold',
                      letterSpacing: '0.15vh',
                      marginBottom: '1vh',
                      lineHeight: '1.5'
                    }}>
                      No Prizes Left!
                    </div>
                    <div style={{
                      fontSize: '2vh',
                      fontWeight: 'normal',
                      letterSpacing: '0.1vh',
                      marginBottom: '2vh',
                      lineHeight: '1.5',
                      fontFamily: "'Press Start 2P', 'Courier New', monospace"
                    }}>
                      You will be lucky next time!
                    </div>
                    <button
                      onClick={handleSpinAgain}
                      style={{
                        background: '#00FFFF',
                        border: '4px solid #000',
                        boxShadow: '6px 6px 0 #000',
                        padding: '1.5vh 3vh',
                        fontSize: '2vh',
                        fontWeight: 'bold',
                        color: '#000',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        fontFamily: "'Press Start 2P', 'Courier New', monospace",
                        letterSpacing: '0.1vh',
                        transition: 'transform 0.1s',
                        marginTop: '1vh'
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'translate(3px, 3px)';
                        e.currentTarget.style.boxShadow = '3px 3px 0 #000';
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'translate(0, 0)';
                        e.currentTarget.style.boxShadow = '6px 6px 0 #000';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translate(0, 0)';
                        e.currentTarget.style.boxShadow = '6px 6px 0 #000';
                      }}
                    >
                      SPIN AGAIN
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showConfirmDialog && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem'
            }}
            onClick={handleCancelSpin}
          >
            <div
              style={{
                background: '#FFD700',
                border: '4px solid #000',
                boxShadow: '8px 8px 0 #000',
                padding: '2rem',
                maxWidth: '90vw',
                width: '400px',
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                textAlign: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontSize: '2vh',
                  color: '#fff',
                  marginBottom: '1.5rem',
                  lineHeight: '1.6',
                  textTransform: 'uppercase',
                  fontWeight: 'bold',


                  letterSpacing: '0.05rem',
                  textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
                  fontFamily: "'Press Start 2P', 'Courier New', monospace"



                }}
              >
                {spinType === 'free' ? (
                  <>
                    Use 1 Free Spin?<br />
                    <span style={{ fontSize: '1.5vh', color: '#FFFF00' }}>Free Spins: {freeSpins}</span>
                  </>
                ) : (
                  <>
                    50 Stars<br />per spin
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={handleConfirmSpin}
                  style={{
                    background: '#00FF00',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0 #000',
                    padding: '1rem 2rem',
                    fontSize: '1.8vh',
                    fontWeight: 'bold',
                    color: '#000',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: "'Press Start 2P', 'Courier New', monospace",
                    transition: 'transform 0.1s'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translate(2px, 2px)';
                    e.currentTarget.style.boxShadow = '2px 2px 0 #000';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '4px 4px 0 #000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '4px 4px 0 #000';
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={handleCancelSpin}
                  style={{
                    background: '#FF0000',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0 #000',
                    padding: '1rem 2rem',
                    fontSize: '1.8vh',
                    fontWeight: 'bold',
                    color: '#FFF',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: "'Press Start 2P', 'Courier New', monospace",
                    transition: 'transform 0.1s'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translate(2px, 2px)';
                    e.currentTarget.style.boxShadow = '2px 2px 0 #000';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '4px 4px 0 #000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '4px 4px 0 #000';
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#FF0000',
              border: '4px solid #000',
              boxShadow: '8px 8px 0 #000',
              padding: '1.5rem 2rem',
              maxWidth: '90vw',
              width: '400px',
              fontFamily: "'Press Start 2P', 'Courier New', monospace",
              fontSize: '1.6vh',
              color: '#FFF',
              textAlign: 'center',
              lineHeight: '1.6',
              zIndex: 9999,
              animation: 'shake 0.5s'
            }}
          >
            {errorMessage}
          </div>
        )}

      </div>

      <div
        style={{
          width: '100%',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#666',
          lineHeight: '1.5',
          padding: '1rem 1rem 2rem',
          marginTop: '1rem'
        }}
      >
        This game is purely for enjoyment and involves no payment or wagering. The random rewards are simply part of the fun and do not constitute gambling. Enjoy!
      </div>
    </div>
  );
};

export default EggGachaMachine;
