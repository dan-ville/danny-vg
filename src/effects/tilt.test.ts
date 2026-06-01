import { describe, it, expect } from 'vitest';
import { computeTilt } from './tilt';

const rect = { width: 200, height: 64 };

describe('computeTilt', () => {
  it('is flat at the exact center', () => {
    const t = computeTilt(100, 32, rect);
    expect(t.rotateX).toBeCloseTo(0);
    expect(t.rotateY).toBeCloseTo(0);
  });

  it('tilts right edge toward the pointer (positive rotateY on the right half)', () => {
    const t = computeTilt(200, 32, rect, 8);
    expect(t.rotateY).toBeCloseTo(8);
    expect(t.rotateX).toBeCloseTo(0);
  });

  it('tilts left half to a negative rotateY', () => {
    const t = computeTilt(0, 32, rect, 8);
    expect(t.rotateY).toBeCloseTo(-8);
  });

  it('lifts the top edge (positive rotateX) when pointer is near the top', () => {
    const t = computeTilt(100, 0, rect, 8);
    expect(t.rotateX).toBeCloseTo(8);
    expect(t.rotateY).toBeCloseTo(0);
  });

  it('drops the bottom edge (negative rotateX) when pointer is near the bottom', () => {
    const t = computeTilt(100, 64, rect, 8);
    expect(t.rotateX).toBeCloseTo(-8);
  });

  it('respects a custom max degree', () => {
    const t = computeTilt(200, 64, rect, 4);
    expect(t.rotateY).toBeCloseTo(4);
    expect(t.rotateX).toBeCloseTo(-4);
  });

  it('clamps pointers that land outside the rect to the max degree', () => {
    const t = computeTilt(400, -50, rect, 8);
    expect(t.rotateY).toBeLessThanOrEqual(8);
    expect(t.rotateX).toBeLessThanOrEqual(8);
    expect(t.rotateY).toBeCloseTo(8);
    expect(t.rotateX).toBeCloseTo(8);
  });

  it('is flat for a degenerate (zero-size) rect', () => {
    const t = computeTilt(10, 10, { width: 0, height: 0 });
    expect(t.rotateX).toBe(0);
    expect(t.rotateY).toBe(0);
  });
});
