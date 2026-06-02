/**
 * Shared predicate for pointer-driven background effects (water ripple, galaxy
 * gravity well, …). A tap should trigger an effect only when it lands on the
 * empty background — never under a card, the theme orb, or any control — so each
 * effect imports this rather than re-deriving the rule.
 */

/** Foreground elements that should swallow a tap instead of triggering an effect. */
const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, [data-no-ripple]';

/**
 * True when a tap on `target` should spawn a background effect: taps that land
 * on (or inside) an interactive foreground element are ignored. Non-Element
 * targets (window, null) count as background.
 */
export function isBackgroundTap(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return target.closest(INTERACTIVE_SELECTOR) === null;
}
