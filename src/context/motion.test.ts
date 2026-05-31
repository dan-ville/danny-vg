import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MOTION,
  MOTION_STORAGE_KEY,
  isMotionSetting,
  resolveReducedMotion,
  nextMotionSetting,
  loadMotion,
  saveMotion,
} from './motion';

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

describe('motion model', () => {
  it('defaults to following the system preference', () => {
    expect(DEFAULT_MOTION).toBe('system');
  });

  it('recognises only valid motion settings', () => {
    expect(isMotionSetting('system')).toBe(true);
    expect(isMotionSetting('reduce')).toBe(true);
    expect(isMotionSetting('full')).toBe(true);
    expect(isMotionSetting('slow')).toBe(false);
    expect(isMotionSetting(null)).toBe(false);
    expect(isMotionSetting(0)).toBe(false);
  });

  describe('resolveReducedMotion', () => {
    it('defers to the OS when following the system', () => {
      expect(resolveReducedMotion('system', true)).toBe(true);
      expect(resolveReducedMotion('system', false)).toBe(false);
    });

    it('lets the explicit overrides win over the OS', () => {
      expect(resolveReducedMotion('reduce', false)).toBe(true);
      expect(resolveReducedMotion('full', true)).toBe(false);
    });
  });

  describe('nextMotionSetting', () => {
    it('flips the resolved state to its opposite explicit override', () => {
      // Currently reduced (via override) -> full.
      expect(nextMotionSetting('reduce', false)).toBe('full');
      // Currently full (via override) -> reduce.
      expect(nextMotionSetting('full', true)).toBe('reduce');
    });

    it('moves off "system" to the deliberate opposite of the OS state', () => {
      // OS prefers reduce, following system -> one click gives full motion.
      expect(nextMotionSetting('system', true)).toBe('full');
      // OS does not prefer reduce, following system -> one click reduces motion.
      expect(nextMotionSetting('system', false)).toBe('reduce');
    });
  });
});

describe('motion persistence', () => {
  it('returns the default when nothing is stored', () => {
    expect(loadMotion(memoryStorage())).toBe('system');
  });

  it('returns a previously stored valid setting', () => {
    expect(loadMotion(memoryStorage({ [MOTION_STORAGE_KEY]: 'reduce' }))).toBe('reduce');
  });

  it('falls back to the default on a corrupt stored value', () => {
    expect(loadMotion(memoryStorage({ [MOTION_STORAGE_KEY]: 'glacial' }))).toBe('system');
  });

  it('round-trips through save then load', () => {
    const storage = memoryStorage();
    saveMotion('full', storage);
    expect(loadMotion(storage)).toBe('full');
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
    expect(loadMotion(throwing)).toBe('system');
    expect(() => saveMotion('reduce', throwing)).not.toThrow();
  });
});
