import { useEffect, useRef } from 'react';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useResizableCanvas } from '../hooks/useResizableCanvas';
import { isBackgroundTap } from './backgroundTap';
import {
  advanceParticle,
  createParticle,
  isDead,
  particleAlpha,
  rotateHue,
  SMOKE_BURST,
  SMOKE_MAX,
  SMOKE_STREAM,
  type SmokeParticle,
} from './rainbowSmoke';

/**
 * Rainbow theme's tap effect: colored smoke-bomb plumes. Pressing the empty
 * background launches a burst of rising, billowing smoke; holding/dragging keeps
 * emitting while the hue sweeps, so a drag paints a rainbow plume. This is an
 * overlay canvas (like the water ripple) — it sits above the CSS `rainbow-bg`
 * and below the foreground; `EffectStage` mounts it only while rainbow is active.
 *
 * Particle physics + palette live in the pure `rainbowSmoke.ts` model; this
 * component owns the canvas (DPR-aware via `useResizableCanvas`), the pointer
 * listeners (gated by `isBackgroundTap`), and the rAF loop (`useAnimationLoop`).
 * Puffs are drawn with normal compositing so overlapping colors stay saturated
 * rather than blowing out to white.
 */
export function SmokeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const particlesRef = useRef<SmokeParticle[]>([]);
  const hueRef = useRef(0);
  const pointerRef = useRef<{ x: number; y: number; held: boolean }>({ x: 0, y: 0, held: false });

  useResizableCanvas(canvasRef, (ctx, width, height) => {
    ctxRef.current = ctx;
    sizeRef.current = { width, height };
  });

  // Press spawns a burst; drag recentres the emitter; release stops it (the
  // existing puffs keep rising). Taps on cards/controls are ignored.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (!isBackgroundTap(event.target)) return;
      const ptr = pointerRef.current;
      ptr.x = event.clientX;
      ptr.y = event.clientY;
      ptr.held = true;
      const list = particlesRef.current;
      for (let i = 0; i < SMOKE_BURST; i++) {
        list.push(createParticle(event.clientX, event.clientY, hueRef.current));
      }
    };
    const onMove = (event: PointerEvent) => {
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
    };
    const onUp = () => {
      pointerRef.current.held = false;
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  useAnimationLoop((dt) => {
    const ctx = ctxRef.current;
    if (!ctx) return; // jsdom / unsupported — nothing to animate.
    const { width, height } = sizeRef.current;
    const list = particlesRef.current;
    const ptr = pointerRef.current;

    // While held, sweep the hue and keep feeding the plume (up to the cap).
    if (ptr.held) {
      hueRef.current = rotateHue(hueRef.current, dt);
      if (list.length < SMOKE_MAX) {
        for (let i = 0; i < SMOKE_STREAM; i++) {
          list.push(createParticle(ptr.x, ptr.y, hueRef.current));
        }
      }
    }

    ctx.clearRect(0, 0, width, height);
    for (const p of list) {
      advanceParticle(p, dt);
      const a = particleAlpha(p);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, `hsla(${p.hue},95%,58%,${a})`);
      grad.addColorStop(1, `hsla(${p.hue},95%,58%,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    particlesRef.current = list.filter((p) => !isDead(p));
  });

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}
