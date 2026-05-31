import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_MOTION,
  loadMotion,
  nextMotionSetting,
  resolveReducedMotion,
  saveMotion,
  type MotionSetting,
} from './motion';

interface MotionContextValue {
  /** Raw preference: `system` (follow the OS), or an explicit `reduce`/`full`. */
  setting: MotionSetting;
  /** The single boolean the app acts on: setting resolved against the OS. */
  reducedMotion: boolean;
  /** Flip the *resolved* motion state (what the bottom-left toggle calls). */
  toggleMotion: () => void;
  /** Jump straight to a specific setting. */
  setMotion: (setting: MotionSetting) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/** Read the OS preference, guarding the missing-matchMedia case (jsdom/SSR). */
function systemPrefersReduce(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCE_QUERY).matches;
}

/**
 * Mirror the resolved motion state onto the document root as `data-motion`
 * (`reduce` | `full`). CSS keys off this so an explicit override beats the OS:
 * `[data-motion='full']` re-enables animations the `prefers-reduced-motion`
 * media query would otherwise kill, and `[data-motion='reduce']` stills them
 * even when the OS has no preference. No-op without a document (SSR safety).
 */
function applyMotion(reducedMotion: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-motion', reducedMotion ? 'reduce' : 'full');
}

/**
 * Long-lived motion-preference state. The setting is hydrated from localStorage
 * (so a returning visitor keeps their override) and the OS preference is tracked
 * live via a matchMedia subscription; the two resolve to `reducedMotion`, which
 * is mirrored onto the root for CSS and read by canvas loops/components. Plain
 * React Context, mirroring ThemeProvider — no store library.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  // Lazy init so a stored override never flashes the default first.
  const [setting, setSettingState] = useState<MotionSetting>(() =>
    typeof window === 'undefined' ? DEFAULT_MOTION : loadMotion(window.localStorage),
  );
  const [systemReduce, setSystemReduce] = useState<boolean>(systemPrefersReduce);

  // Track live OS changes (e.g. the user flips the setting in their control panel).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(REDUCE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemReduce(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const reducedMotion = resolveReducedMotion(setting, systemReduce);

  // Keep the document root in sync with the resolved state (runs on mount too).
  useEffect(() => {
    applyMotion(reducedMotion);
  }, [reducedMotion]);

  const setMotion = useCallback((next: MotionSetting) => {
    setSettingState(next);
    if (typeof window !== 'undefined') saveMotion(next, window.localStorage);
  }, []);

  const toggleMotion = useCallback(() => {
    setSettingState((current) => {
      const next = nextMotionSetting(current, systemReduce);
      if (typeof window !== 'undefined') saveMotion(next, window.localStorage);
      return next;
    });
  }, [systemReduce]);

  return (
    <MotionContext.Provider value={{ setting, reducedMotion, toggleMotion, setMotion }}>
      {children}
    </MotionContext.Provider>
  );
}

/** Read the full motion context. Throws if used outside <MotionProvider>. */
export function useMotion(): MotionContextValue {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error('useMotion must be used within a MotionProvider');
  return ctx;
}

/** Convenience: just the resolved boolean. Throws outside <MotionProvider>. */
export function useReducedMotion(): boolean {
  return useMotion().reducedMotion;
}
