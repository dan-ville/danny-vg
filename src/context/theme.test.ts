import { describe, it, expect } from 'vitest';
import {
  THEMES,
  DEFAULT_THEME,
  THEME_ACCENTS,
  isTheme,
  nextTheme,
  loadTheme,
  saveTheme,
  THEME_STORAGE_KEY,
} from './theme';

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

describe('theme model', () => {
  it('lists the three themes in cycle order', () => {
    expect(THEMES).toEqual(['galaxy', 'matrix', 'rainbow']);
  });

  it('defaults to galaxy', () => {
    expect(DEFAULT_THEME).toBe('galaxy');
  });

  it('cycles galaxy -> matrix -> rainbow -> galaxy', () => {
    expect(nextTheme('galaxy')).toBe('matrix');
    expect(nextTheme('matrix')).toBe('rainbow');
    expect(nextTheme('rainbow')).toBe('galaxy');
  });

  it('defines an accent pair for every theme', () => {
    for (const theme of THEMES) {
      expect(THEME_ACCENTS[theme].accent).toMatch(/^#|^rgb/);
      expect(THEME_ACCENTS[theme].accent2).toMatch(/^#|^rgb/);
    }
  });

  it('recognises only valid theme strings', () => {
    expect(isTheme('galaxy')).toBe(true);
    expect(isTheme('matrix')).toBe(true);
    expect(isTheme('rainbow')).toBe(true);
    expect(isTheme('cosmic')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(42)).toBe(false);
  });
});

describe('theme persistence', () => {
  it('returns the default when nothing is stored', () => {
    expect(loadTheme(memoryStorage())).toBe('galaxy');
  });

  it('returns a previously stored valid theme', () => {
    expect(loadTheme(memoryStorage({ [THEME_STORAGE_KEY]: 'matrix' }))).toBe('matrix');
  });

  it('falls back to the default on a corrupt stored value', () => {
    expect(loadTheme(memoryStorage({ [THEME_STORAGE_KEY]: 'banana' }))).toBe('galaxy');
  });

  it('round-trips through save then load', () => {
    const storage = memoryStorage();
    saveTheme('rainbow', storage);
    expect(loadTheme(storage)).toBe('rainbow');
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
    expect(loadTheme(throwing)).toBe('galaxy');
    expect(() => saveTheme('matrix', throwing)).not.toThrow();
  });
});
