import { useEffect, useState } from 'react';

/**
 * True only on hover-capable, fine-pointer devices (desktops with a mouse).
 * Touch screens report `(hover: none)`, so the custom theme cursor never mounts
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
 * Hook form of {@link isHoverCapable}. Returns `false` on the first render (so
 * SSR/first paint stays deterministic) and flips to the real capability after
 * mount. ThemeCursor gates on it so it never renders on touch devices.
 */
export function useHoverCapable(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(isHoverCapable());
  }, []);
  return enabled;
}
