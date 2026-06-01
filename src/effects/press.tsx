import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/** How long the accent glow lingers after a tap before it eases out (ms). */
const GLOW_MS = 150;

export interface UseTapGlowResult {
  /** True while the post-tap glow window is open. */
  pressed: boolean;
  /** Spread onto the element; sets an accent box-shadow while pressed. */
  style: CSSProperties;
  /** Pointer-down handler that opens the glow window. */
  onPointerDown: () => void;
}

/**
 * Mobile tap-glow companion to the desktop hover tilt. On touch a tap flashes an
 * accent-tinted glow around the card that fades out shortly after, pairing with
 * the card's CSS `active:scale` press-down. `enabled` is the *inverse* of the
 * hover-capable gate — it runs only where {@link useTilt} does not, so the two
 * never contend over the same element's transform/box. On hover-capable devices
 * it short-circuits to no glow and a no-op handler. Repeated taps restart the
 * window rather than stacking timers.
 */
export function useTapGlow(enabled: boolean, glowMs = GLOW_MS): UseTapGlowResult {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = () => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  };

  const onPointerDown = useCallback(() => {
    clear();
    setPressed(true);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setPressed(false);
    }, glowMs);
  }, [glowMs]);

  // Drop any in-flight timer on unmount so it can't fire into a gone component.
  useEffect(() => clear, []);

  const style: CSSProperties = enabled
    ? {
        boxShadow: pressed ? '0 0 28px -2px var(--accent)' : undefined,
        transition: 'box-shadow 200ms ease-out',
      }
    : {};

  return {
    pressed: enabled ? pressed : false,
    style,
    onPointerDown: enabled ? onPointerDown : () => {},
  };
}
