import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

export interface TiltRect {
  width: number;
  height: number;
}

export interface Tilt {
  /** Rotation about the X axis (deg): positive lifts the top edge toward the viewer. */
  rotateX: number;
  /** Rotation about the Y axis (deg): positive pushes the right edge toward the viewer. */
  rotateY: number;
}

const FLAT: Tilt = { rotateX: 0, rotateY: 0 };

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * Pure mouse-position → 3D-tilt mapping for the desktop card hover effect.
 * `offsetX/offsetY` are pointer coordinates relative to the card's top-left.
 * The card tilts *toward* the pointer: pointer on the right pushes the right
 * edge forward (+rotateY), pointer near the top lifts the top edge (+rotateX).
 * Output is clamped to ±`maxDeg` so pointers that stray outside the rect (it
 * can happen between a move and the leave event) never over-rotate. A degenerate
 * zero-size rect maps to flat.
 */
export function computeTilt(
  offsetX: number,
  offsetY: number,
  rect: TiltRect,
  maxDeg = 8,
): Tilt {
  if (rect.width <= 0 || rect.height <= 0) return FLAT;
  const px = offsetX / rect.width - 0.5; // -0.5 (left) .. 0.5 (right)
  const py = offsetY / rect.height - 0.5; // -0.5 (top) .. 0.5 (bottom)
  return {
    rotateX: clamp(-py * 2 * maxDeg, maxDeg),
    rotateY: clamp(px * 2 * maxDeg, maxDeg),
  };
}

export interface UseTiltResult {
  style: CSSProperties;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
}

/**
 * React wiring around {@link computeTilt}. Tracks the live tilt as the pointer
 * moves over an element and resets to flat on leave, returning the transform
 * `style` plus the two handlers to spread onto the element. `enabled` (the
 * hover-capable gate) short-circuits to flat with no-op handlers on touch
 * devices so nothing tilts there. Hover tilt is user-initiated, so it is kept
 * even when reduced motion is on — the caller chooses whether to pass it through.
 */
export function useTilt(enabled: boolean, maxDeg = 8): UseTiltResult {
  const [tilt, setTilt] = useState<Tilt>(FLAT);
  const frame = useRef(0);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      // Coalesce to one update per frame to keep the transform cheap.
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        setTilt(computeTilt(offsetX, offsetY, rect, maxDeg));
      });
    },
    [enabled, maxDeg],
  );

  const onPointerLeave = useCallback(() => {
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    setTilt(FLAT);
  }, []);

  const active = tilt.rotateX !== 0 || tilt.rotateY !== 0;
  const style: CSSProperties = enabled
    ? {
        transform: `perspective(600px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
        // Snap back smoothly on leave; follow the pointer instantly while hovering.
        transition: active ? 'transform 60ms linear' : 'transform 200ms ease-out',
      }
    : {};

  return {
    style,
    onPointerMove: enabled ? onPointerMove : () => {},
    onPointerLeave: enabled ? onPointerLeave : () => {},
  };
}
