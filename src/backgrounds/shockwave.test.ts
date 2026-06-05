import { describe, it, expect } from 'vitest';
import {
  createRing,
  advanceRing,
  isRingDone,
  RING_SPEED,
  BAND_HALF_WIDTH,
  MIN_STRENGTH,
} from './shockwave';

describe('createRing', () => {
  it('starts at the press point with zero radius and the base speed', () => {
    const ring = createRing(120, 340, 0);
    expect(ring.x).toBe(120);
    expect(ring.y).toBe(340);
    expect(ring.radius).toBe(0);
    expect(ring.speed).toBe(RING_SPEED);
  });

  it('floors a zero-charge tap at MIN_STRENGTH and tops a full hold at 1', () => {
    expect(createRing(0, 0, 0).strength).toBeCloseTo(MIN_STRENGTH);
    expect(createRing(0, 0, 1).strength).toBeCloseTo(1);
  });

  it('grows strength monotonically with charge', () => {
    expect(createRing(0, 0, 0.5).strength).toBeGreaterThan(createRing(0, 0, 0).strength);
    expect(createRing(0, 0, 1).strength).toBeGreaterThan(createRing(0, 0, 0.5).strength);
  });

  it('clamps charge outside 0..1', () => {
    expect(createRing(0, 0, -2).strength).toBeCloseTo(MIN_STRENGTH);
    expect(createRing(0, 0, 5).strength).toBeCloseTo(1);
  });
});

describe('advanceRing', () => {
  it('expands the radius by speed scaled by the time delta', () => {
    const ring = createRing(0, 0, 1);
    advanceRing(ring, 0.5);
    expect(ring.radius).toBeCloseTo(RING_SPEED * 0.5);
  });

  it('leaves the radius unchanged for a zero time delta', () => {
    const ring = createRing(0, 0, 1);
    advanceRing(ring, 0);
    expect(ring.radius).toBe(0);
  });

  it('accumulates radius across successive calls', () => {
    const ring = createRing(0, 0, 1);
    advanceRing(ring, 0.1);
    advanceRing(ring, 0.1);
    expect(ring.radius).toBeCloseTo(RING_SPEED * 0.2);
  });
});

describe('isRingDone', () => {
  it('is false while the band still overlaps the viewport and true once it clears it', () => {
    const ring = createRing(0, 0, 1);
    ring.radius = 200;
    expect(isRingDone(ring, 1000)).toBe(false);
    ring.radius = 1000 + BAND_HALF_WIDTH + 1;
    expect(isRingDone(ring, 1000)).toBe(true);
  });
});
