import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  CURSORS,
  DEFAULT_CURSOR,
  loadCursor,
  nextCursor,
  saveCursor,
  type CursorType,
} from '../effects/cursor';

interface CursorContextValue {
  /** Currently active fantasy cursor sprite. */
  cursor: CursorType;
  /** Advance sword -> bow -> staff -> sword (what the picker's active tile calls). */
  cycleCursor: () => void;
  /** Jump straight to a specific sprite (what each picker tile calls). */
  setCursor: (cursor: CursorType) => void;
}

const CursorContext = createContext<CursorContextValue | null>(null);

/**
 * Mirror the active cursor onto the document root as `data-cursor`. CSS keys off
 * this to hide the native pointer (`[data-cursor] { cursor: none }`) only once a
 * sprite is live, and the desktop-only FantasyCursor reads it to pick which SVG
 * to paint. No-op without a document (SSR safety), matching Theme/MotionProvider.
 */
function applyCursor(cursor: CursorType): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-cursor', cursor);
}

/**
 * Long-lived cursor state: hydrated from localStorage on first paint, persisted
 * on every change, and mirrored onto the document root so CSS and the (desktop-
 * only) FantasyCursor + CursorPicker can react. Plain React Context, mirroring
 * ThemeProvider/MotionProvider — no store library. Note the sprite is only ever
 * *rendered* on hover-capable devices; this provider stays mounted everywhere so
 * the persisted choice survives, but does no work on touch-only screens.
 */
export function CursorProvider({ children }: { children: ReactNode }) {
  // Lazy init so a returning visitor never flashes the default sprite first.
  const [cursor, setCursorState] = useState<CursorType>(() =>
    typeof window === 'undefined' ? DEFAULT_CURSOR : loadCursor(window.localStorage),
  );

  // Keep the document root in sync with the active cursor (runs on mount too).
  useEffect(() => {
    applyCursor(cursor);
  }, [cursor]);

  const setCursor = useCallback((next: CursorType) => {
    setCursorState(next);
    if (typeof window !== 'undefined') saveCursor(next, window.localStorage);
  }, []);

  const cycleCursor = useCallback(() => {
    setCursorState((current) => {
      const next = nextCursor(current);
      if (typeof window !== 'undefined') saveCursor(next, window.localStorage);
      return next;
    });
  }, []);

  return (
    <CursorContext.Provider value={{ cursor, cycleCursor, setCursor }}>
      {children}
    </CursorContext.Provider>
  );
}

/** Read the active cursor + mutators. Throws if used outside <CursorProvider>. */
export function useCursor(): CursorContextValue {
  const ctx = useContext(CursorContext);
  if (!ctx) throw new Error('useCursor must be used within a CursorProvider');
  return ctx;
}

// Re-export the picker order so consumers can map tiles without a second import.
export { CURSORS };
