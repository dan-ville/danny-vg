import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_THEME,
  THEME_ACCENTS,
  loadTheme,
  nextTheme,
  saveTheme,
  type Theme,
} from './theme';

interface ThemeContextValue {
  /** Currently active background theme. */
  theme: Theme;
  /** Advance galaxy -> matrix -> rainbow -> galaxy (what the orb calls). */
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
  // Lazy init so a returning visitor never flashes the default theme first.
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === 'undefined' ? DEFAULT_THEME : loadTheme(window.localStorage),
  );

  // Keep the document root in sync with the active theme (runs on mount too).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (typeof window !== 'undefined') saveTheme(next, window.localStorage);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = nextTheme(current);
      if (typeof window !== 'undefined') saveTheme(next, window.localStorage);
      return next;
    });
  }, []);

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
