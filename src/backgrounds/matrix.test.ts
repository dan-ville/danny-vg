import { describe, it, expect } from 'vitest';
import {
  GLYPHS,
  randomGlyph,
  columnCount,
  createColumns,
  advanceColumn,
  glyphIntensity,
} from './matrix';

// Deterministic pseudo-random sequence so every test is repeatable.
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('randomGlyph', () => {
  it('returns a single character drawn from the glyph set', () => {
    const g = randomGlyph(seq([0]));
    expect(g).toHaveLength(1);
    expect(GLYPHS).toContain(g);
  });

  it('maps rand near 1 to the last glyph without overflowing', () => {
    const g = randomGlyph(seq([0.999999]));
    expect(GLYPHS).toContain(g);
  });
});

describe('columnCount', () => {
  it('is the viewport width divided by the cell size', () => {
    expect(columnCount(400, 20)).toBe(20);
  });

  it('never drops below one column', () => {
    expect(columnCount(5, 20)).toBe(1);
  });
});

describe('createColumns', () => {
  it('creates the requested number of columns', () => {
    const cols = createColumns(12, 40, seq([0.5]));
    expect(cols).toHaveLength(12);
  });

  it('staggers heads above the top of the screen so columns rain in', () => {
    const cols = createColumns(20, 40, seq([0, 0.25, 0.5, 0.75, 0.99]));
    for (const col of cols) {
      expect(col.head).toBeLessThanOrEqual(0);
    }
  });

  it('gives each column a positive fall speed and trail length', () => {
    const cols = createColumns(20, 40, seq([0.1, 0.4, 0.7, 0.9]));
    for (const col of cols) {
      expect(col.speed).toBeGreaterThan(0);
      expect(col.trail).toBeGreaterThan(0);
    }
  });
});

describe('advanceColumn', () => {
  it('falls the head by its speed scaled by the time delta', () => {
    const col = { head: 0, speed: 10, trail: 5 };
    advanceColumn(col, 0.5, 40, seq([0.5])); // half a second at 10 rows/sec
    expect(col.head).toBeCloseTo(5);
  });

  it('recycles a column to above the screen once its whole trail clears the bottom', () => {
    const col = { head: 100, speed: 10, trail: 5 };
    advanceColumn(col, 1, 40, seq([0.5])); // head -> 110, trail tail at 105 > 40 rows
    expect(col.head).toBeLessThanOrEqual(0);
    expect(col.speed).toBeGreaterThan(0);
    expect(col.trail).toBeGreaterThan(0);
  });

  it('leaves a column still on screen untouched apart from its fall', () => {
    const col = { head: 10, speed: 4, trail: 5 };
    advanceColumn(col, 1, 40, seq([0.5]));
    expect(col.head).toBeCloseTo(14);
  });
});

describe('glyphIntensity', () => {
  it('is brightest at the head', () => {
    expect(glyphIntensity(0, 8)).toBe(1);
  });

  it('fades along the trail and is gone past its end', () => {
    const head = glyphIntensity(0, 8);
    const mid = glyphIntensity(4, 8);
    expect(mid).toBeLessThan(head);
    expect(mid).toBeGreaterThan(0);
    expect(glyphIntensity(8, 8)).toBe(0);
    expect(glyphIntensity(20, 8)).toBe(0);
  });

  it('renders nothing above the head', () => {
    expect(glyphIntensity(-1, 8)).toBe(0);
  });
});
