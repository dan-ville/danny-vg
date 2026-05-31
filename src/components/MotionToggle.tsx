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
export function MotionToggle() {
  const { reducedMotion, toggleMotion } = useMotion();

  return (
    <button
      type="button"
      onClick={toggleMotion}
      aria-pressed={reducedMotion}
      aria-label={reducedMotion ? 'Enable motion and animations' : 'Reduce motion and animations'}
      title={reducedMotion ? 'Motion reduced' : 'Motion on'}
      className="motion-toggle fixed bottom-6 left-6 z-20 flex h-12 w-12 items-center justify-center rounded-full text-lg"
    >
      <span aria-hidden="true">{reducedMotion ? '✦' : '✶'}</span>
    </button>
  );
}
