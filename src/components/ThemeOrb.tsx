import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Floating theme switcher: a fixed bottom-right orb that cycles
 * galaxy → matrix → rainbow → kitty → galaxy on click. Its surface paints from
 * `--accent`/`--accent-2`, which flip with the theme, so it always reflects the
 * active background. It idle-bobs (CSS, stilled under reduced-motion) and pulses
 * briefly on click for cause-and-effect feedback. A native `<button>`, a
 * theme-aware `aria-label`, and an accent `:focus-visible` ring keep it
 * keyboard-accessible. The bottom-left motion toggle, the cursor-picker sibling,
 * and safe-area-inset padding arrive in M4.
 */
export interface ThemeOrbProps {
  /**
   * Mobile immersive mode: when true the orb fades out + ignores pointers with
   * the rest of the chrome, leaving the bare theme and the visibility toggle.
   * Always overridden visible at `lg:`.
   */
  hidden?: boolean;
}

export function ThemeOrb({ hidden = false }: ThemeOrbProps) {
  const { theme, cycleTheme } = useTheme();
  const [pulsing, setPulsing] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setPulsing(true);
        cycleTheme();
      }}
      // Only the finite pulse fires animationend (the infinite bob never does),
      // so this reliably clears the pulse so it can re-trigger on the next click.
      onAnimationEnd={() => setPulsing(false)}
      aria-label={`Switch theme — current: ${theme}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      // Desktop home is bottom-right (these base classes); below the 1024px
      // cutoff it's relocated to the top-right corner in index.css, clearing the
      // bottom-right visibility toggle.
      className={`theme-orb concealable fixed bottom-6 right-6 z-20 h-12 w-12 rounded-full${
        pulsing ? ' theme-orb--pulse' : ''
      }${hidden ? ' concealable--off' : ''}`}
    />
  );
}
