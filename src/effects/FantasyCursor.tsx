import { useEffect, useRef } from 'react';
import { useCursor } from '../context/CursorContext';
import { CURSOR_SPRITES, useHoverCapable } from './cursorSprites';

// Fraction of the remaining distance covered each frame — a soft trailing ease.
const LERP_FACTOR = 0.25;

interface Point {
  x: number;
  y: number;
}

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
  const enabled = useHoverCapable();

  const nodeRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Point | null>(null);
  const posRef = useRef<Point | null>(null);
  const rafRef = useRef<number | null>(null);

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
      {CURSOR_SPRITES[cursor]}
    </div>
  );
}
