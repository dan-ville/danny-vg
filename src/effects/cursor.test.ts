import { describe, it, expect } from 'vitest';
import {
  CURSORS,
  CURSOR_STORAGE_KEY,
  DEFAULT_CURSOR,
  isCursorType,
  nextCursor,
  loadCursor,
  saveCursor,
} from './cursor';

/** Minimal in-memory Storage stand-in so persistence is testable without jsdom globals. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe('cursor model', () => {
  it('offers exactly the three drawn sprites in picker order', () => {
    expect(CURSORS).toEqual(['sword', 'bow', 'staff']);
  });

  it('defaults to the sword', () => {
    expect(DEFAULT_CURSOR).toBe('sword');
  });

  it('recognises only valid cursor types', () => {
    expect(isCursorType('sword')).toBe(true);
    expect(isCursorType('bow')).toBe(true);
    expect(isCursorType('staff')).toBe(true);
    expect(isCursorType('wand')).toBe(false);
    expect(isCursorType(null)).toBe(false);
    expect(isCursorType(2)).toBe(false);
  });

  describe('nextCursor', () => {
    it('cycles sword -> bow -> staff -> sword', () => {
      expect(nextCursor('sword')).toBe('bow');
      expect(nextCursor('bow')).toBe('staff');
      expect(nextCursor('staff')).toBe('sword');
    });
  });
});

describe('cursor persistence', () => {
  it('returns the default when nothing is stored', () => {
    expect(loadCursor(memoryStorage())).toBe('sword');
  });

  it('returns a previously stored valid cursor', () => {
    expect(loadCursor(memoryStorage({ [CURSOR_STORAGE_KEY]: 'bow' }))).toBe('bow');
  });

  it('falls back to the default on a corrupt stored value', () => {
    expect(loadCursor(memoryStorage({ [CURSOR_STORAGE_KEY]: 'trident' }))).toBe('sword');
  });

  it('round-trips through save then load', () => {
    const storage = memoryStorage();
    saveCursor('staff', storage);
    expect(loadCursor(storage)).toBe('staff');
  });

  it('never throws when storage access fails', () => {
    const throwing: Storage = {
      length: 0,
      clear: () => {},
      key: () => null,
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    expect(loadCursor(throwing)).toBe('sword');
    expect(() => saveCursor('bow', throwing)).not.toThrow();
  });
});
