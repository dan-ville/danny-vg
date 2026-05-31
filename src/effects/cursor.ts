/**
 * Pure custom-cursor model. Kept free of React/DOM so the sprite set, picker
 * cycle order, and localStorage persistence can be unit-tested deterministically;
 * the (desktop-only) FantasyCursor + CursorPicker components own the rendered SVG
 * sprites, the pointer tracking, and the `data-cursor` side effect. Storage is
 * injected so persistence is testable without globals — mirrors theme.ts/motion.ts.
 */

/** The three hand-drawn cursor sprites, in picker-strip order. */
export type CursorType = 'sword' | 'bow' | 'staff';

/** Cursors in the order the picker strip (and any cycle) steps through them. */
export const CURSORS: CursorType[] = ['sword', 'bow', 'staff'];

/** First-visit cursor; also the fallback when nothing valid is stored. */
export const DEFAULT_CURSOR: CursorType = 'sword';

/** localStorage key the active cursor persists under (sits beside theme/motion). */
export const CURSOR_STORAGE_KEY = 'danny-vg:cursor';

/** Type guard: true only for one of the known cursor-type strings. */
export function isCursorType(value: unknown): value is CursorType {
  return typeof value === 'string' && (CURSORS as string[]).includes(value);
}

/** Next cursor in the strip, wrapping the staff back to the sword. */
export function nextCursor(cursor: CursorType): CursorType {
  const i = CURSORS.indexOf(cursor);
  return CURSORS[(i + 1) % CURSORS.length];
}

/** Read the persisted cursor, falling back to the default if absent/corrupt/blocked. */
export function loadCursor(storage: Storage): CursorType {
  try {
    const stored = storage.getItem(CURSOR_STORAGE_KEY);
    return isCursorType(stored) ? stored : DEFAULT_CURSOR;
  } catch {
    return DEFAULT_CURSOR;
  }
}

/** Persist the active cursor, swallowing storage errors (private mode, quota). */
export function saveCursor(cursor: CursorType, storage: Storage): void {
  try {
    storage.setItem(CURSOR_STORAGE_KEY, cursor);
  } catch {
    // Persistence is best-effort; a blocked write must never break the cursor.
  }
}
