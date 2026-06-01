import { useEffect, useRef } from 'react';
import { useResizableCanvas } from '../hooks/useResizableCanvas';
import { advanceRing, createRipple, isBackgroundTap, isRingExpired, ringAlpha, ringRadius, type Ring } from './ripples';

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
 * DPR-aware sizing comes from the shared `useResizableCanvas` hook. The rAF loop
 * runs only while rings are alive, so an idle page costs nothing.
 */
export function RippleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  useResizableCanvas(canvasRef, (_ctx, width, height) => {
    sizeRef.current = { width, height };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported — nothing to animate.

    const accent = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || FALLBACK_ACCENT;

    let rings: Ring[] = [];
    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      // Clamp dt so a long pause between frames doesn't snap rings outward.
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

      const { width, height } = sizeRef.current;
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
        ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
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

    // Pause the on-demand loop while the tab is hidden; resume any live rings
    // with a fresh dt so they don't snap outward on return (spec §11).
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (rings.length > 0) {
        startLoop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}
