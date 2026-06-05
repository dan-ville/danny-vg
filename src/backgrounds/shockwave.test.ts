import { describe, it, expect } from 'vitest';
import {
  createRing,
  advanceRing,
  isRingDone,
  RING_SPEED,
  BAND_HALF_WIDTH,
  MIN_STRENGTH,
  ringEffect,
  combineRings,
  chargePull,
  CHARGE_FULL,
  CHARGE_PULL_RADIUS,
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

/** A ring centred at the origin with a wavefront at radius 100. */
const ringAt100 = () => ({ x: 0, y: 0, radius: 100, speed: RING_SPEED, strength: 1 });

describe('ringEffect', () => {
  it('leaves a point well outside the band untouched', () => {
    // dist 300 vs radius 100 -> s = 200 >> BAND_HALF_WIDTH.
    const e = ringEffect(ringAt100(), 300, 0);
    expect(e).toEqual({ dx: 0, dy: 0, decode: 0 });
  });

  it('shoves outward ahead of the wavefront', () => {
    // Point on +x at dist 130 (s = +30, inside the band): pushed further out (+x).
    const e = ringEffect(ringAt100(), 130, 0);
    expect(e.dx).toBeGreaterThan(0);
  });

  it('pulls back behind the wavefront', () => {
    // Point on +x at dist 70 (s = -30, inside the band): returns inward (-x).
    const e = ringEffect(ringAt100(), 70, 0);
    expect(e.dx).toBeLessThan(0);
  });

  it('peaks decode at the wavefront and fades to the band edges', () => {
    const atCrest = ringEffect(ringAt100(), 100, 0).decode; // s = 0
    const nearEdge = ringEffect(ringAt100(), 100 + (BAND_HALF_WIDTH - 1), 0).decode;
    expect(atCrest).toBeGreaterThan(nearEdge);
    expect(atCrest).toBeGreaterThan(0);
    expect(nearEdge).toBeGreaterThanOrEqual(0);
  });

  it('never produces NaN for a point exactly on the centre', () => {
    const e = ringEffect(ringAt100(), 0, 0);
    expect(Number.isFinite(e.dx)).toBe(true);
    expect(Number.isFinite(e.dy)).toBe(true);
    expect(Number.isFinite(e.decode)).toBe(true);
  });

  it('fades the shove smoothly to near-zero at the band edges (no snap)', () => {
    const justInside = ringEffect(ringAt100(), 100 + BAND_HALF_WIDTH - 1, 0);
    const justOutside = ringEffect(ringAt100(), 100 + BAND_HALF_WIDTH + 1, 0);
    expect(Math.abs(justInside.dx)).toBeLessThan(2); // smoothly tapered, not ~27px
    expect(justOutside.dx).toBe(0);
  });
});

describe('combineRings', () => {
  it('sums the shoves and takes the max decode across rings', () => {
    const one = ringEffect(ringAt100(), 130, 0);
    const both = combineRings([ringAt100(), ringAt100()], 130, 0);
    expect(both.dx).toBeCloseTo(one.dx * 2);
    expect(both.decode).toBeCloseTo(one.decode); // max of two equal values
  });

  it('is inert with no rings', () => {
    expect(combineRings([], 130, 0)).toEqual({ dx: 0, dy: 0, decode: 0 });
  });
});

describe('chargePull', () => {
  it('bends a nearby glyph inward toward the charge centre', () => {
    // Charge at origin, point on +x: displacement should be toward the centre (-x).
    const e = chargePull({ x: 0, y: 0, t: CHARGE_FULL }, 50, 0);
    expect(e.dx).toBeLessThan(0);
  });

  it('brightens more the longer the press is charged', () => {
    const half = chargePull({ x: 0, y: 0, t: CHARGE_FULL / 2 }, 50, 0).glow;
    const full = chargePull({ x: 0, y: 0, t: CHARGE_FULL }, 50, 0).glow;
    expect(full).toBeGreaterThan(half);
  });

  it('does nothing at the instant of the press (t = 0)', () => {
    expect(chargePull({ x: 0, y: 0, t: 0 }, 50, 0)).toEqual({ dx: 0, dy: 0, glow: 0 });
  });

  it('does not reach beyond CHARGE_PULL_RADIUS', () => {
    const e = chargePull({ x: 0, y: 0, t: CHARGE_FULL }, CHARGE_PULL_RADIUS + 10, 0);
    expect(e).toEqual({ dx: 0, dy: 0, glow: 0 });
  });
});
