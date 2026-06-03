import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_THEME,
  THEME_ACCENTS,
  nextTheme,
  resolveInitialTheme,
  saveTheme,
  withThemeParam,
  type Theme,
} from './theme';

interface ThemeContextValue {
  /** Currently active background theme. */
  theme: Theme;
  /** Advance galaxy -> matrix -> rainbow -> kitty -> galaxy (what the orb calls). */
  cycleTheme: () => void;
  /** Jump straight to a specific theme. */
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Apply a theme's accent palette and a `data-theme` hook to the document root.
 * Canvas backgrounds read `data-theme` to mount/unmount; CSS reads `--accent`
 * for the profile ring, card glow, icon tint, and focus rings, and `data-theme`
 * for the rainbow-only scrim. No-op when there's no document (SSR safety).
 */
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.setProperty('--accent', THEME_ACCENTS[theme].accent);
  root.style.setProperty('--accent-2', THEME_ACCENTS[theme].accent2);
}

/**
 * Long-lived theme state: hydrated from localStorage on first paint, persisted
 * on every change, and mirrored onto the document root so both CSS and the
 * canvas backgrounds can react. Per the spec this is plain React Context — no
 * store library; canvas loops will read the latest value via refs in M4.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy init so a returning visitor never flashes the default theme first. A
  // `?theme=` link wins over the persisted choice (see resolveInitialTheme).
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === 'undefined'
      ? DEFAULT_THEME
      : resolveInitialTheme(window.localStorage, window.location.search),
  );

  // Mirror the active theme onto the document root, localStorage, and the URL
  // (`?theme=`). The URL write keeps the address bar shareable at any moment and
  // makes a param-opened theme survive a refresh; replaceState avoids spamming
  // history. Runs on mount too, so an opened link persists its theme.
  useEffect(() => {
    applyTheme(theme);
    if (typeof window === 'undefined') return;
    saveTheme(theme, window.localStorage);
    const { pathname, search, hash } = window.location;
    const next = withThemeParam(search, theme);
    if (next !== search) window.history.replaceState(null, '', `${pathname}${next}${hash}`);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  const cycleTheme = useCallback(() => setThemeState((current) => nextTheme(current)), []);

  return (
    <ThemeContext.Provider value={{ theme, cycleTheme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

/** Read the active theme + mutators. Throws if used outside <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
