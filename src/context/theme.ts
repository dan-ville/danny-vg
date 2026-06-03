/**
 * Pure theme model. Kept free of React/DOM so the cycle order, accent palette,
 * and localStorage persistence can be unit-tested deterministically;
 * ThemeContext.tsx owns the provider, the CSS-variable side effects, and the
 * crossfade. Storage is injected so persistence is testable without globals.
 */

/** The four backgrounds, in click-cycle order. */
export type Theme = 'galaxy' | 'matrix' | 'rainbow' | 'kitty';

/** Themes in the order the orb cycles through them. */
export const THEMES: Theme[] = ['galaxy', 'matrix', 'rainbow', 'kitty'];

/** First-visit theme; also the fallback when nothing valid is stored. */
export const DEFAULT_THEME: Theme = "rainbow"

/** localStorage key the active theme persists under. */
export const THEME_STORAGE_KEY = 'danny-vg:theme';

/** URL query param that pins the active theme, so a link can share one theme. */
export const THEME_PARAM = 'theme';

/**
 * Per-theme accent pair driving `--accent` / `--accent-2` (profile ring, card
 * glow, icon/arrow tint, focus rings). Galaxy = cyan/purple, Matrix = green,
 * Rainbow = soft white/iridescent, Kitty = tabby orange / yarn pink.
 */
export const THEME_ACCENTS: Record<Theme, { accent: string; accent2: string }> = {
  galaxy: { accent: '#8be9ff', accent2: '#b388ff' },
  matrix: { accent: '#3bff7a', accent2: '#0aff5a' },
  rainbow: { accent: '#f5f3ff', accent2: '#ffd6f6' },
  kitty: { accent: '#ffb454', accent2: '#ff8fc7' },
};

/** Type guard: true only for one of the known theme strings. */
export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as string[]).includes(value);
}

/** Next theme in the cycle, wrapping kitty back to galaxy. */
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

/**
 * Read a theme pinned via the URL `?theme=` param, or null if it's absent or
 * not a known theme. Lets a shared link open straight on one theme.
 */
export function themeFromSearch(search: string): Theme | null {
  try {
    const value = new URLSearchParams(search).get(THEME_PARAM);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * The theme to start on: a valid `?theme=` param wins (a shared link forces its
 * theme), otherwise the persisted choice, otherwise the default.
 */
export function resolveInitialTheme(storage: Storage, search: string): Theme {
  return themeFromSearch(search) ?? loadTheme(storage);
}

/**
 * A query string (leading `?`) with `theme` set to the active theme, preserving
 * any other params. Written back to the address bar so it's always shareable.
 */
export function withThemeParam(search: string, theme: Theme): string {
  const params = new URLSearchParams(search);
  params.set(THEME_PARAM, theme);
  return `?${params.toString()}`;
}
