import React, { useEffect, useRef } from 'react';

interface StarfieldCanvasProps {
  hyperDrive: boolean;
  speedMultiplier: number;
  accentColor: string;
  secondaryColor: string;
}

interface Star {
  x: number;
  y: number;
  z: number;
  pz: number;
  hue: 'accent' | 'secondary' | 'white';
}

export const StarfieldCanvas: React.FC<StarfieldCanvasProps> = ({
  hyperDrive,
  speedMultiplier,
  accentColor,
  secondaryColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const count = 170;
    const stars: Star[] = Array.from({ length: count }, (_, i) => {
      const z = Math.random() * width;
      return {
        x: (Math.random() - 0.5) * width * 1.4,
        y: (Math.random() - 0.5) * height * 1.4,
        z,
        pz: z,
        hue: i % 5 === 0 ? 'accent' : i % 7 === 0 ? 'secondary' : 'white',
      };
    });

    const render = () => {
      const speed = prefersReducedMotion
        ? 0.3
        : (hyperDrive ? 24 : 2.2) * speedMultiplier;

      ctx.fillStyle = hyperDrive ? 'rgba(7, 9, 14, 0.28)' : 'rgba(7, 9, 14, 0.55)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.pz = s.z;
        s.z -= speed;

        if (s.z <= 1) {
          s.x = (Math.random() - 0.5) * width * 1.4;
          s.y = (Math.random() - 0.5) * height * 1.4;
          s.z = width;
          s.pz = s.z;
        }

        const sx = (s.x / s.z) * cx + cx;
        const sy = (s.y / s.z) * cy + cy;
        const px = (s.x / s.pz) * cx + cx;
        const py = (s.y / s.pz) * cy + cy;

        const size = Math.max(0.6, (1 - s.z / width) * (hyperDrive ? 2.6 : 1.9));
        const alpha = Math.min(1, (1 - s.z / width) * 0.95);

        ctx.strokeStyle =
          s.hue === 'accent'
            ? accentColor
            : s.hue === 'secondary'
            ? secondaryColor
            : `rgba(226, 232, 240, ${alpha})`;

        if (hyperDrive) {
          ctx.globalAlpha = alpha;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      if (!prefersReducedMotion) {
        animationId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [hyperDrive, speedMultiplier, accentColor, secondaryColor]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-80"
    />
  );
};
