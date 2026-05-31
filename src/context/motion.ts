/**
 * Pure motion-preference model. Kept free of React/DOM so the resolve logic,
 * toggle behaviour, and localStorage persistence can be unit-tested
 * deterministically; MotionContext.tsx owns the provider, the matchMedia
 * subscription, and the `data-motion` side effect. Storage is injected so
 * persistence is testable without globals — mirrors theme.ts.
 */

/**
 * What drives motion. `system` follows `prefers-reduced-motion`; `reduce` and
 * `full` are explicit overrides set via the bottom-left motion toggle.
 */
export type MotionSetting = 'system' | 'reduce' | 'full';

/** First-visit setting; also the fallback when nothing valid is stored. */
export const DEFAULT_MOTION: MotionSetting = 'system';

/** localStorage key the motion preference persists under (sits beside the theme). */
export const MOTION_STORAGE_KEY = 'danny-vg:motion';

/** Type guard: true only for one of the known motion-setting strings. */
export function isMotionSetting(value: unknown): value is MotionSetting {
  return value === 'system' || value === 'reduce' || value === 'full';
}

/**
 * Resolve a setting + the OS preference into the single boolean the app acts on.
 * `system` defers to the OS; the explicit overrides win regardless of the OS.
 */
export function resolveReducedMotion(setting: MotionSetting, systemPrefersReduce: boolean): boolean {
  if (setting === 'reduce') return true;
  if (setting === 'full') return false;
  return systemPrefersReduce;
}

/**
 * Next setting when the user clicks the toggle: flip the *resolved* state to its
 * opposite explicit override. Following the OS, the toggle moves you off it to
 * the deliberate opposite — so one click always visibly changes motion.
 */
export function nextMotionSetting(
  setting: MotionSetting,
  systemPrefersReduce: boolean,
): MotionSetting {
  return resolveReducedMotion(setting, systemPrefersReduce) ? 'full' : 'reduce';
}

/** Read the persisted setting, falling back to the default if absent/corrupt/blocked. */
export function loadMotion(storage: Storage): MotionSetting {
  try {
    const stored = storage.getItem(MOTION_STORAGE_KEY);
    return isMotionSetting(stored) ? stored : DEFAULT_MOTION;
  } catch {
    return DEFAULT_MOTION;
  }
}

/** Persist the motion setting, swallowing storage errors (private mode, quota). */
export function saveMotion(setting: MotionSetting, storage: Storage): void {
  try {
    storage.setItem(MOTION_STORAGE_KEY, setting);
  } catch {
    // Persistence is best-effort; a blocked write must never break the app.
  }
}
