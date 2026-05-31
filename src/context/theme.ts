/**
 * Pure theme model. Kept free of React/DOM so the cycle order, accent palette,
 * and localStorage persistence can be unit-tested deterministically;
 * ThemeContext.tsx owns the provider, the CSS-variable side effects, and the
 * crossfade. Storage is injected so persistence is testable without globals.
 */

/** The three backgrounds, in click-cycle order. */
export type Theme = 'galaxy' | 'matrix' | 'rainbow';

/** Themes in the order the orb cycles through them. */
export const THEMES: Theme[] = ['galaxy', 'matrix', 'rainbow'];

/** First-visit theme; also the fallback when nothing valid is stored. */
export const DEFAULT_THEME: Theme = 'galaxy';

/** localStorage key the active theme persists under. */
export const THEME_STORAGE_KEY = 'danny-vg:theme';

/**
 * Per-theme accent pair driving `--accent` / `--accent-2` (profile ring, card
 * glow, icon/arrow tint, focus rings). Galaxy = cyan/purple, Matrix = green,
 * Rainbow = soft white/iridescent.
 */
export const THEME_ACCENTS: Record<Theme, { accent: string; accent2: string }> = {
  galaxy: { accent: '#8be9ff', accent2: '#b388ff' },
  matrix: { accent: '#3bff7a', accent2: '#0aff5a' },
  rainbow: { accent: '#f5f3ff', accent2: '#ffd6f6' },
};

/** Type guard: true only for one of the known theme strings. */
export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as string[]).includes(value);
}

/** Next theme in the cycle, wrapping rainbow back to galaxy. */
export function nextTheme(theme: Theme): Theme {
  const i = THEMES.indexOf(theme);
  return THEMES[(i + 1) % THEMES.length];
}

/** Read the persisted theme, falling back to the default if absent/corrupt/blocked. */
export function loadTheme(storage: Storage): Theme {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Persist the active theme, swallowing storage errors (private mode, quota). */
export function saveTheme(theme: Theme, storage: Storage): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Persistence is best-effort; a blocked write must never break theming.
  }
}
