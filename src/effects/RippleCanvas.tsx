import { useEffect, useRef } from 'react';
import { advanceRing, createRipple, isBackgroundTap, isRingExpired, ringAlpha, ringRadius, type Ring } from './ripples';

/** DPR cap from the spec — keeps the buffer reasonable on retina/4K. */
const MAX_DPR = 2;
/** Fallback tint if the --accent CSS variable can't be read (e.g. jsdom). */
const FALLBACK_ACCENT = '#8be9ff';

/**
 * Water-ripple effect layer. A transparent Canvas 2D surface sitting above the
 * background canvas and below the foreground (`z-0`, between the `-z-10`
 * background and the `z-10` content). It never intercepts pointer events
 * (`pointer-events-none`); instead a window-level `pointerdown` listener spawns
 * a ring cluster only when the tap lands on the empty background, tinted to the
 * active theme accent so the rings spread beneath the floating cards.
 *
 * The rAF loop runs only while rings are alive, so an idle page costs nothing.
 * A shared resizable-canvas hook + visibilitychange pause arrive in M4.
 */
export function RippleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported — nothing to animate.

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
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
    };
    resize();
    window.addEventListener('resize', resize);

    const accent = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || FALLBACK_ACCENT;

    let rings: Ring[] = [];
    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      // Clamp dt so a long pause between frames doesn't snap rings outward.
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = accent();
      ctx.lineWidth = 2;
      for (const ring of rings) {
        advanceRing(ring, dt);
        const alpha = ringAlpha(ring);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ringRadius(ring), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      rings = rings.filter((ring) => !isRingExpired(ring));
      if (rings.length > 0) {
        raf = requestAnimationFrame(frame);
      } else {
        raf = 0;
        last = 0;
        ctx.clearRect(0, 0, width, height);
      }
    };

    const startLoop = () => {
      if (raf === 0) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!isBackgroundTap(event.target)) return;
      rings.push(...createRipple(event.clientX, event.clientY));
      startLoop();
    };
    window.addEventListener('pointerdown', onPointerDown);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}
