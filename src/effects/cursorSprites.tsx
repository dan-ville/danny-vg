import { useEffect, useState, type ReactElement } from 'react';
import type { CursorType } from './cursor';

/**
 * Hand-drawn cursor sprites, shared by the desktop FantasyCursor (the live
 * pointer) and the CursorPicker tiles (the chooser strip). Each is a 28×28 glyph
 * tinted to the active `--accent` via `currentColor`, with its visual "tip" near
 * the top-left (0,0) so it lands under the real pointer hotspot once translated.
 * `aria-hidden` — pure decoration; the picker labels its buttons separately.
 */
export const CURSOR_SPRITES: Record<CursorType, ReactElement> = {
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
      <path d="M7 4 A16 16 0 0 1 7 24" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <line x1="7" y1="4" x2="7" y2="24" stroke="currentColor" strokeWidth="1" />
      <path d="M5 14 L24 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 14 L20 11.5 M24 14 L20 16.5" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  staff: (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <path d="M8 6 L20 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="7" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 2 L7.9 4.1 L10 5 L7.9 5.9 L7 8 L6.1 5.9 L4 5 L6.1 4.1 Z"
        fill="currentColor"
      />
    </svg>
  ),
};

/**
 * True only on hover-capable, fine-pointer devices (desktops with a mouse).
 * Touch screens report `(hover: none)`, so the custom cursor + picker never mount
 * there and native touch behavior is left untouched. Guards the missing-matchMedia
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
 * React hook form of {@link isHoverCapable}. Returns `false` on the first render
 * (so SSR/first paint stays deterministic) and flips to the real capability after
 * mount. Both the FantasyCursor and the CursorPicker gate on it so neither ever
 * renders on touch devices.
 */
export function useHoverCapable(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(isHoverCapable());
  }, []);
  return enabled;
}
