import React, { useEffect, useRef } from 'react';

interface EmojiCelebrationProps {
  active: boolean;
  duration?: number;
  onComplete?: () => void;
}

interface EmojiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  emoji: string;
  rotation: number;
  rotationSpeed: number;
  size: number;
  scale: number;
  opacity: number;
}

const EmojiCelebration: React.FC<EmojiCelebrationProps> = ({
  active,
  duration = 4000,
  onComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesArray = useRef<EmojiParticle[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const emojis = [
      '😊', '😃', '🎉', '🎊', '🥳', '😄', '🤩', '✨',
      '⭐', '🌟', '💫', '🎈', '🎁', '🎆', '🎇', '💝',
      '😁', '🤗', '😍', '🥰', '🤪', '😎', '🔥', '💖',
      '🌈', '🦄', '🍀', '👏', '🙌', '💯', '🏆', '🎯'
    ];

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    particlesArray.current = Array.from({ length: 200 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 8 + 4;

      return {
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - Math.random() * 3,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        size: Math.random() * 30 + 20,
        scale: 0.1,
        opacity: 1
      };
    });

    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      if (elapsed >= duration) {
        if (onComplete) onComplete();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesArray.current.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.rotationSpeed;

        particle.vy += 0.3;
        particle.vx *= 0.99;

        if (particle.scale < 1) {
          particle.scale += 0.05;
        }

        if (progress > 0.6) {
          particle.opacity = Math.max(0, 1 - (progress - 0.6) / 0.4);
        }

        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate((particle.rotation * Math.PI) / 180);
        ctx.scale(particle.scale, particle.scale);
        ctx.globalAlpha = particle.opacity;

        ctx.font = `${particle.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(particle.emoji, 0, 0);

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

export default EmojiCelebration;
