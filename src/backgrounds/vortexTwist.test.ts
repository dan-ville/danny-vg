import { describe, it, expect } from 'vitest';
import {
  createTwist,
  moveTwist,
  advanceTwist,
  warpPoint,
  isSettled,
  TWIST_RADIUS,
  TWIST_STRENGTH,
} from './vortexTwist';

/** A deterministic rng that walks a fixed sequence, repeating the last value. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('createTwist', () => {
  it('anchors at the press point, starts held but unwound, and parks live values at the defaults', () => {
    const twist = createTwist(120, 340, () => 0);
    expect(twist.x).toBe(120);
    expect(twist.y).toBe(340);
    expect(twist.prevX).toBe(120);
    expect(twist.prevY).toBe(340);
    expect(twist.held).toBe(true);
    expect(twist.strength).toBe(0);
    expect(twist.magNow).toBe(TWIST_STRENGTH);
    expect(twist.radNow).toBe(TWIST_RADIUS);
  });

  it('seeds every roll field inside its documented range', () => {
    // Fresh random sequence per call exercises each branch.
    for (let n = 0; n < 50; n++) {
      const twist = createTwist(0, 0, Math.random);
      const { roll } = twist;
      expect([1, -1]).toContain(roll.dir);
      expect([2, 3]).toContain(roll.lobes);
      expect(roll.phase).toBeGreaterThanOrEqual(0);
      expect(roll.phase).toBeLessThanOrEqual(Math.PI * 2);
      expect(roll.drift).toBeGreaterThanOrEqual(-0.9);
      expect(roll.drift).toBeLessThanOrEqual(0.9);
      expect(roll.magFreq).toBeGreaterThanOrEqual(0.4);
      expect(roll.magFreq).toBeLessThanOrEqual(1.1);
      expect(roll.radFreq).toBeGreaterThanOrEqual(0.25);
      expect(roll.radFreq).toBeLessThanOrEqual(0.75);
      expect(roll.t).toBe(0);
    }
  });

  it('rolls counter-clockwise when the first draw is below 0.5 and clockwise above', () => {
    expect(createTwist(0, 0, seq([0.2])).roll.dir).toBe(-1);
    expect(createTwist(0, 0, seq([0.9])).roll.dir).toBe(1);
  });
});

describe('moveTwist', () => {
  it('recentres the swirl without disturbing the previous centre', () => {
    const twist = createTwist(0, 0, () => 0);
    moveTwist(twist, 250, 90);
    expect(twist.x).toBe(250);
    expect(twist.y).toBe(90);
    expect(twist.prevX).toBe(0); // prev only advances in advanceTwist
    expect(twist.prevY).toBe(0);
  });
});

describe('advanceTwist', () => {
  it('eases strength up while held and back down once released', () => {
    const twist = createTwist(0, 0, () => 0);
    advanceTwist(twist, 0.1);
    const rising = twist.strength;
    expect(rising).toBeGreaterThan(0);
    expect(rising).toBeLessThanOrEqual(1);

    twist.held = false;
    advanceTwist(twist, 0.1);
    expect(twist.strength).toBeLessThan(rising);
  });

  it('advances the roll clock', () => {
    const twist = createTwist(0, 0, () => 0);
    advanceTwist(twist, 0.25);
    expect(twist.roll.t).toBeCloseTo(0.25);
  });

  it('stirs the lobe phase harder when the pointer is dragging fast', () => {
    const still = createTwist(0, 0, () => 0);
    advanceTwist(still, 0.1); // never moved

    const dragged = createTwist(0, 0, () => 0);
    moveTwist(dragged, 200, 0); // fast drag before the same step
    advanceTwist(dragged, 0.1);

    expect(dragged.roll.phase).toBeGreaterThan(still.roll.phase);
  });

  it('keeps the live magnitude and radius within the randomness spread', () => {
    const twist = createTwist(0, 0, Math.random);
    for (let i = 0; i < 20; i++) advanceTwist(twist, 0.1);
    expect(twist.magNow).toBeGreaterThan(TWIST_STRENGTH * 0.5);
    expect(twist.magNow).toBeLessThan(TWIST_STRENGTH * 1.5);
    expect(twist.radNow).toBeGreaterThan(TWIST_RADIUS * 0.5);
    expect(twist.radNow).toBeLessThan(TWIST_RADIUS * 1.5);
  });
});

describe('isSettled', () => {
  it('is false while held and true once a release has unwound', () => {
    const twist = createTwist(0, 0, () => 0);
    twist.strength = 1;
    expect(isSettled(twist)).toBe(false); // held
    twist.held = false;
    expect(isSettled(twist)).toBe(false); // still wound up
    twist.strength = 0.005;
    expect(isSettled(twist)).toBe(true); // released and unwound
  });
});

describe('warpPoint', () => {
  /** A twist wound fully open at the origin, so warps are observable. */
  function openTwist(rand: () => number = () => 0) {
    const twist = createTwist(0, 0, rand);
    twist.strength = 1;
    twist.magNow = TWIST_STRENGTH;
    twist.radNow = TWIST_RADIUS;
    return twist;
  }

  it('leaves a point untouched while the swirl is at rest', () => {
    const twist = createTwist(0, 0, () => 0); // strength 0
    const w = warpPoint(twist, 30, 0);
    expect(w).toEqual({ x: 30, y: 0, rot: 0 });
  });

  it('leaves a point well outside the radius untouched', () => {
    const twist = openTwist();
    const w = warpPoint(twist, TWIST_RADIUS * 6, 0);
    expect(w.rot).toBe(0);
    expect(w.x).toBe(TWIST_RADIUS * 6);
    expect(w.y).toBe(0);
  });

  it('rotates a point inside the radius around the centre', () => {
    const twist = openTwist();
    const w = warpPoint(twist, 30, 0);
    expect(w.rot).not.toBe(0);
    // Rotated off the x-axis it started on.
    expect(Math.abs(w.y)).toBeGreaterThan(0.001);
  });

  it('flips rotation direction with the roll direction', () => {
    const ccw = openTwist(seq([0.2])); // dir -1
    const cw = openTwist(seq([0.9])); // dir +1
    const a = warpPoint(ccw, 30, 0).rot;
    const b = warpPoint(cw, 30, 0).rot;
    expect(Math.sign(a)).toBe(-1);
    expect(Math.sign(b)).toBe(1);
  });

  it('varies the twist with angle (lobed asymmetry)', () => {
    const twist = openTwist();
    const d = 30 / Math.SQRT2; // a point at the same distance but a 45° angle
    const east = warpPoint(twist, 30, 0).rot;
    const diagonal = warpPoint(twist, d, d).rot;
    expect(east).not.toBeCloseTo(diagonal);
  });

  it('never produces NaN for a point exactly on the centre', () => {
    const twist = openTwist();
    const w = warpPoint(twist, 0, 0);
    expect(Number.isFinite(w.x)).toBe(true);
    expect(Number.isFinite(w.y)).toBe(true);
    expect(Number.isFinite(w.rot)).toBe(true);
  });
});
