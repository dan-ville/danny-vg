import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useCursor } from '../context/CursorContext';
import type { CursorType } from './cursor';

// Fraction of the remaining distance covered each frame — a soft trailing ease.
const LERP_FACTOR = 0.25;

interface Point {
  x: number;
  y: number;
}

/**
 * True only on hover-capable, fine-pointer devices (desktops with a mouse).
 * Touch screens report `(hover: none)`, so the custom cursor never mounts there
 * and the native touch behavior is left untouched. Guards the missing-matchMedia
 * case (jsdom/SSR) the same way MotionContext does.
 */
function isHoverCapable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
}

/**
 * Hand-drawn cursor sprites, tinted to the active `--accent` via `currentColor`.
 * Each is a 28×28 glyph whose visual "tip" sits near the top-left (0,0) so it
 * lands under the real pointer hotspot once translated. `aria-hidden` — this is
 * pure decoration layered over the (CSS-hidden) native cursor.
 */
const SPRITES: Record<CursorType, ReactElement> = {
  sword: (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <path
        d="M5 5 L17 17"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M4 4 L9 5 L5 9 Z" fill="currentColor" />
      <path
        d="M14 20 L20 14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="21" cy="21" r="2.5" fill="currentColor" />
    </svg>
  ),
  bow: (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <path
        d="M7 4 A16 16 0 0 1 7 24"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      <line x1="7" y1="4" x2="7" y2="24" stroke="currentColor" strokeWidth="1" />
      <path
        d="M5 14 L24 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M24 14 L20 11.5 M24 14 L20 16.5" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  staff: (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <path
        d="M8 6 L20 22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 2 L7.9 4.1 L10 5 L7.9 5.9 L7 8 L6.1 5.9 L4 5 L6.1 4.1 Z"
        fill="currentColor"
      />
    </svg>
  ),
};

/**
 * Desktop-only custom cursor. Renders the active fantasy sprite (chosen via the
 * CursorPicker / persisted in CursorContext) and smoothly trails the real pointer
 * with a requestAnimationFrame lerp. Mounts only on hover-capable devices; on
 * touch it renders nothing, so the native pointer behavior is untouched. The
 * native cursor itself is hidden by `[data-cursor] { cursor: none }` (scoped to
 * `@media (hover: hover)` in index.css). The rAF loop pauses while the tab is
 * hidden and idles until the pointer next moves.
 */
export function FantasyCursor() {
  const { cursor } = useCursor();
  // Decide capability after mount so SSR/first paint stays deterministic.
  const [enabled, setEnabled] = useState(false);

  const nodeRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Point | null>(null);
  const posRef = useRef<Point | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setEnabled(isHoverCapable());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      const target = targetRef.current;
      const node = nodeRef.current;
      if (target && node) {
        // Snap directly onto the pointer the first frame, then ease toward it.
        const pos = posRef.current ?? target;
        const nx = pos.x + (target.x - pos.x) * LERP_FACTOR;
        const ny = pos.y + (target.y - pos.y) * LERP_FACTOR;
        posRef.current = { x: nx, y: ny };
        node.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      targetRef.current = { x: event.clientX, y: event.clientY };
      startLoop();
    };

    const onVisibilityChange = () => {
      if (document.hidden) stopLoop();
      else if (targetRef.current) startLoop();
    };

    window.addEventListener('pointermove', onPointerMove);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopLoop();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={nodeRef}
      data-testid="fantasy-cursor"
      data-cursor={cursor}
      aria-hidden="true"
      className="fantasy-cursor"
    >
      {SPRITES[cursor]}
    </div>
  );
}
