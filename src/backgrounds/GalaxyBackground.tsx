import { useEffect, useRef } from 'react';
import { useResizableCanvas } from '../hooks/useResizableCanvas';
import { advanceStar, createStars, starAlpha, starCount, type Star } from './stars';

/**
 * Cosmic galaxy background: drifting, twinkling star particles drawn on a
 * Canvas 2D layer over the CSS radial-gradient nebula (`.galaxy-bg`). The
 * nebula lives in CSS so it paints instantly; the canvas only adds stars.
 *
 * DPR-aware sizing + resize handling come from the shared `useResizableCanvas`
 * hook; this component owns only the rAF loop. Star field is rebuilt for each
 * new viewport size via the resize handler and read by the loop through a ref.
 */
export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{ width: number; height: number; stars: Star[] }>({
    width: 0,
    height: 0,
    stars: [],
  });

  useResizableCanvas(canvasRef, (_ctx, width, height) => {
    sceneRef.current = { width, height, stars: createStars(starCount(width, height), width, height) };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported — nothing to animate.

    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't teleport stars on resume.
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

      const { width, height, stars } = sceneRef.current;
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        advanceStar(star, width, height, dt);
        ctx.globalAlpha = starAlpha(star);
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="galaxy-bg fixed inset-0 -z-10" />;
}
