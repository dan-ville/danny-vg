import { useEffect, useRef } from 'react';
import { advanceStar, createStars, starAlpha, starCount, type Star } from './stars';

/** DPR cap from the spec — keeps the buffer reasonable on retina/4K. */
const MAX_DPR = 2;

/**
 * Cosmic galaxy background: drifting, twinkling star particles drawn on a
 * Canvas 2D layer over the CSS radial-gradient nebula (`.galaxy-bg`). The
 * nebula lives in CSS so it paints instantly; the canvas only adds stars.
 *
 * A shared resizable-canvas hook + visibilitychange pause arrive in M4; this
 * M1 version owns its own resize listener and rAF loop.
 */
export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported — nothing to animate.

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let stars: Star[] = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = createStars(starCount(width, height), width, height);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't teleport stars on resume.
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="galaxy-bg fixed inset-0 -z-10" />;
}
