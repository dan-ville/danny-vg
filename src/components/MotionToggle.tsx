import { useMotion } from '../context/MotionContext';

/**
 * Reduced-motion switch: a fixed bottom-left translucent button mirroring the
 * bottom-right ThemeOrb. One click flips the *resolved* motion state, so it
 * always visibly changes whether the page animates — even for a visitor whose
 * OS already prefers reduced motion (the click moves them to the deliberate
 * opposite override). `aria-pressed` exposes the on/off state to assistive tech;
 * the icon swaps a "play"/"pause"-style glyph for sighted users. A native
 * `<button>` with an accent `:focus-visible` ring keeps it keyboard-accessible.
 */
export interface MotionToggleProps {
  /**
   * Mobile immersive mode: when true the toggle fades out + ignores pointers
   * along with the rest of the chrome. Always overridden visible at `lg:`.
   */
  hidden?: boolean;
}

export function MotionToggle({ hidden = false }: MotionToggleProps) {
  const { reducedMotion, toggleMotion } = useMotion();

  return (
    <button
      type="button"
      onClick={toggleMotion}
      aria-pressed={reducedMotion}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      aria-label={reducedMotion ? 'Enable motion and animations' : 'Reduce motion and animations'}
      title={reducedMotion ? 'Motion reduced' : 'Motion on'}
      // Smaller on mobile; full size restored at `lg:`. Fades out in immersive mode.
      className={`motion-toggle concealable fixed bottom-6 left-6 z-20 flex h-10 w-10 items-center justify-center rounded-full text-base lg:h-12 lg:w-12 lg:text-lg${
        hidden ? ' concealable--off' : ''
      }`}
    >
      <span aria-hidden="true">{reducedMotion ? '✦' : '✶'}</span>
    </button>
  );
}
