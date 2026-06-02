import { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useResizableCanvas } from '../hooks/useResizableCanvas';
import { useHoverCapable } from './useHoverCapable';
import {
  advanceParticle,
  blinkOn,
  COMET_SPARKS,
  createParticle,
  isDead,
  particleAlpha,
  SPARKLER_GRAVITY,
  SPARKLER_SPARKS,
  type CursorParticle,
} from './cursorTrail';

/** How fast the comet head eases toward the real pointer (fraction per frame). */
const COMET_EASE = 0.28;
/** Comet sparks emitted per frame while the cursor is live. */
const COMET_RATE = 2;
/** Sparkler sparks emitted per frame. */
const SPARKLER_RATE = 4;

/**
 * Desktop-only, theme-driven custom cursor. Mounts only on hover-capable devices
 * (touch keeps its native pointer); the inner {@link CursorCanvas} does the work
 * so its canvas exists from first render and the DPR-aware `useResizableCanvas`
 * binds correctly.
 */
export function ThemeCursor() {
  const enabled = useHoverCapable();
  return enabled ? <CursorCanvas /> : null;
}

/**
 * One canvas painted on top of everything; what it draws depends on the theme:
 *
 * - **galaxy** → a glowing comet head that trails cyan→violet sparks.
 * - **matrix** → a blinking green terminal caret block (no trail).
 * - **rainbow** → a fireworks sparkler: a white-hot tip flinging colored sparks
 *   that arc and fall under gravity.
 *
 * The native cursor is hidden by `[data-cursor] { cursor: none }` (scoped to
 * `@media (hover: hover)` in index.css); this sets `data-cursor` on the root
 * while mounted. Particle physics live in the pure `cursorTrail.ts` model; this
 * owns the canvas, pointer tracking, and the rAF loop.
 */
function CursorCanvas() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const particlesRef = useRef<CursorParticle[]>([]);
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const headRef = useRef<{ x: number; y: number } | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useResizableCanvas(canvasRef, (ctx, width, height) => {
    ctxRef.current = ctx;
    sizeRef.current = { width, height };
  });

  // Hide the native pointer (via [data-cursor]) while the custom cursor is live.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-cursor', theme);
    return () => root.removeAttribute('data-cursor');
  }, [theme]);

  // Track the real pointer.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      targetRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // A theme switch starts the new cursor's trail fresh.
  useEffect(() => {
    particlesRef.current = [];
  }, [theme]);

  useAnimationLoop((dt) => {
    const ctx = ctxRef.current;
    if (!ctx) return; // jsdom / unsupported — nothing to animate.
    const { width, height } = sizeRef.current;
    ctx.clearRect(0, 0, width, height);

    const target = targetRef.current;
    if (!target) return; // pointer hasn't moved yet — draw nothing.
    const list = particlesRef.current;

    if (themeRef.current === 'galaxy') {
      // Comet: head eases toward the pointer, sparks shed from the head.
      const head = headRef.current ?? { ...target };
      head.x += (target.x - head.x) * COMET_EASE;
      head.y += (target.y - head.y) * COMET_EASE;
      headRef.current = head;
      for (let i = 0; i < COMET_RATE; i++) list.push(createParticle(head.x, head.y, COMET_SPARKS));

      ctx.globalCompositeOperation = 'lighter';
      for (const p of list) {
        advanceParticle(p, dt);
        const a = particleAlpha(p);
        const r = p.r * 2.2;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `hsla(${p.hue},90%,72%,${a})`);
        g.addColorStop(1, `hsla(${p.hue},90%,72%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      drawGlow(ctx, head.x, head.y, 8, 'rgba(220,245,255,'); // bright comet head
      particlesRef.current = list.filter((p) => !isDead(p));
    } else if (themeRef.current === 'rainbow') {
      // Sparkler: white-hot tip at the pointer, colored sparks fling + fall.
      for (let i = 0; i < SPARKLER_RATE; i++) list.push(createParticle(target.x, target.y, SPARKLER_SPARKS));
      ctx.globalCompositeOperation = 'lighter';
      for (const p of list) {
        advanceParticle(p, dt, SPARKLER_GRAVITY);
        const a = particleAlpha(p);
        ctx.fillStyle = `hsla(${p.hue},95%,62%,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      drawGlow(ctx, target.x, target.y, 6, 'rgba(255,250,235,'); // sparkler tip
      particlesRef.current = list.filter((p) => !isDead(p));
    } else {
      // Matrix: a blinking green terminal caret at the pointer (no trail).
      headRef.current = null;
      ctx.globalCompositeOperation = 'source-over';
      if (blinkOn(performance.now())) {
        ctx.save();
        ctx.shadowColor = 'rgba(59,255,122,0.9)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(59,255,122,0.9)';
        ctx.fillRect(Math.round(target.x), Math.round(target.y) - 2, 10, 18);
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50" />;
}

/** A soft radial glow used for the comet head and sparkler tip. */
function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgbPrefix: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${rgbPrefix}0.95)`);
  g.addColorStop(1, `${rgbPrefix}0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
