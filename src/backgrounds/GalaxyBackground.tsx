import { useRef } from 'react';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useResizableCanvas } from '../hooks/useResizableCanvas';
import { advanceStar, createStars, starAlpha, starCount, type Star } from './stars';

/**
 * Cosmic galaxy background: drifting, twinkling star particles drawn on a
 * Canvas 2D layer over the CSS radial-gradient nebula (`.galaxy-bg`). The
 * nebula lives in CSS so it paints instantly; the canvas only adds stars.
 *
 * DPR-aware sizing + resize handling come from `useResizableCanvas`; the rAF
 * loop (with dt clamping + hidden-tab pause) comes from `useAnimationLoop`.
 * The star field is rebuilt for each new viewport size via the resize handler
 * and read by the loop through a ref.
 */
export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sceneRef = useRef<{ width: number; height: number; stars: Star[] }>({
    width: 0,
    height: 0,
    stars: [],
  });

  useResizableCanvas(canvasRef, (ctx, width, height) => {
    ctxRef.current = ctx;
    sceneRef.current = { width, height, stars: createStars(starCount(width, height), width, height) };
  });

  useAnimationLoop((dt) => {
    const ctx = ctxRef.current;
    if (!ctx) return; // jsdom / unsupported — nothing to animate.
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
  });

  return <canvas ref={canvasRef} aria-hidden="true" className="galaxy-bg fixed inset-0 -z-10" />;
}
