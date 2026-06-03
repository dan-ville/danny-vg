import { describe, it, expect } from 'vitest';
import {
  THEMES,
  DEFAULT_THEME,
  THEME_ACCENTS,
  isTheme,
  nextTheme,
  loadTheme,
  saveTheme,
  themeFromSearch,
  resolveInitialTheme,
  withThemeParam,
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
  it('lists the four themes in cycle order', () => {
    expect(THEMES).toEqual(['galaxy', 'matrix', 'rainbow', 'kitty']);
  });

  it('defaults to rainbow', () => {
    expect(DEFAULT_THEME).toBe('rainbow');
  });

  it('cycles galaxy -> matrix -> rainbow -> kitty -> galaxy', () => {
    expect(nextTheme('galaxy')).toBe('matrix');
    expect(nextTheme('matrix')).toBe('rainbow');
    expect(nextTheme('rainbow')).toBe('kitty');
    expect(nextTheme('kitty')).toBe('galaxy');
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
    expect(isTheme('kitty')).toBe(true);
    expect(isTheme('cosmic')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(42)).toBe(false);
  });
});

describe('theme persistence', () => {
  it('returns the default when nothing is stored', () => {
    expect(loadTheme(memoryStorage())).toBe('rainbow');
  });

  it('returns a previously stored valid theme', () => {
    expect(loadTheme(memoryStorage({ [THEME_STORAGE_KEY]: 'matrix' }))).toBe('matrix');
  });

  it('falls back to the default on a corrupt stored value', () => {
    expect(loadTheme(memoryStorage({ [THEME_STORAGE_KEY]: 'banana' }))).toBe('rainbow');
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
    expect(loadTheme(throwing)).toBe('rainbow');
    expect(() => saveTheme('matrix', throwing)).not.toThrow();
  });
});

describe('theme URL param', () => {
  it('reads a valid theme from the ?theme= param', () => {
    expect(themeFromSearch('?theme=kitty')).toBe('kitty');
    expect(themeFromSearch('?foo=1&theme=matrix')).toBe('matrix');
  });

  it('returns null when the param is absent or not a known theme', () => {
    expect(themeFromSearch('')).toBeNull();
    expect(themeFromSearch('?theme=banana')).toBeNull();
    expect(themeFromSearch('?other=galaxy')).toBeNull();
  });

  it('lets a valid param override the stored theme', () => {
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: 'galaxy' });
    expect(resolveInitialTheme(storage, '?theme=kitty')).toBe('kitty');
  });

  it('falls back to the stored theme when no param is present', () => {
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: 'matrix' });
    expect(resolveInitialTheme(storage, '')).toBe('matrix');
    expect(resolveInitialTheme(storage, '?theme=banana')).toBe('matrix'); // invalid → ignored
  });

  it('writes the theme into a query string, preserving other params', () => {
    expect(withThemeParam('', 'kitty')).toBe('?theme=kitty');
    expect(withThemeParam('?theme=galaxy', 'matrix')).toBe('?theme=matrix');
    expect(withThemeParam('?ref=twitter', 'rainbow')).toBe('?ref=twitter&theme=rainbow');
  });
});
