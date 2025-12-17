import React, { useEffect, useRef } from 'react';

interface ConfettiAnimationProps {
  active: boolean;
  duration?: number;
  onComplete?: () => void;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  size: number;
}

const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({
  active,
  duration = 3000,
  onComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const confettiArray = useRef<Confetti[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B500', '#FF69B4'
    ];

    confettiArray.current = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 5,
      size: Math.random() * 8 + 4
    }));

    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;

      if (elapsed >= duration) {
        if (onComplete) onComplete();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      confettiArray.current.forEach((confetti) => {
        confetti.x += confetti.vx;
        confetti.y += confetti.vy;
        confetti.rotation += confetti.rotationSpeed;

        confetti.vy += 0.1;

        if (confetti.y > canvas.height) {
          confetti.y = -10;
          confetti.x = Math.random() * canvas.width;
        }

        if (confetti.x > canvas.width) confetti.x = 0;
        if (confetti.x < 0) confetti.x = canvas.width;

        ctx.save();
        ctx.translate(confetti.x, confetti.y);
        ctx.rotate((confetti.rotation * Math.PI) / 180);

        ctx.fillStyle = confetti.color;
        ctx.fillRect(-confetti.size / 2, -confetti.size / 2, confetti.size, confetti.size);

        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, duration, onComplete]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
};

export default ConfettiAnimation;
