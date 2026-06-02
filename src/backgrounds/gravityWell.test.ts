import { describe, it, expect } from 'vitest';
import {
  createWell,
  moveWell,
  wellRadius,
  applyWell,
  isConsumed,
  releaseKick,
  WELL_BASE_RADIUS,
  WELL_CORE_RADIUS,
} from './gravityWell';
import type { Star } from './stars';

/** A bare star at (x, y) with a known-present zero velocity. */
function starAt(x: number, y: number): Star & { vx: number; vy: number } {
  return {
    x,
    y,
    radius: 1,
    baseAlpha: 0.8,
    twinkleSpeed: 1,
    twinklePhase: 0,
    driftX: 0,
    driftY: 0,
    vx: 0,
    vy: 0,
  };
}

describe('createWell', () => {
  it('anchors at the tap point, starts held and unaged, and stores its max radius', () => {
    const well = createWell(120, 340, 1000);
    expect(well.x).toBe(120);
    expect(well.y).toBe(340);
    expect(well.held).toBe(true);
    expect(well.heldFor).toBe(0);
    expect(well.maxRadius).toBe(1000);
  });
});

describe('moveWell', () => {
  it('recentres the well so it follows a drag', () => {
    const well = createWell(0, 0, 1000);
    moveWell(well, 250, 90);
    expect(well.x).toBe(250);
    expect(well.y).toBe(90);
  });
});

describe('wellRadius', () => {
  it('starts at the base radius and grows the longer it is held', () => {
    const well = createWell(0, 0, 100000);
    expect(wellRadius(well)).toBeCloseTo(WELL_BASE_RADIUS);
    well.heldFor = 1;
    const grown = wellRadius(well);
    expect(grown).toBeGreaterThan(WELL_BASE_RADIUS);
    well.heldFor = 2;
    expect(wellRadius(well)).toBeGreaterThan(grown);
  });

  it('never exceeds the well’s max radius', () => {
    const well = createWell(0, 0, 300);
    well.heldFor = 9999;
    expect(wellRadius(well)).toBe(300);
  });
});

describe('applyWell', () => {
  it('pulls a star inside the current radius toward the centre', () => {
    const well = createWell(100, 100, 100000);
    const star = starAt(100 - WELL_BASE_RADIUS * 0.5, 100);
    applyWell(star, well, 0.05);
    expect(star.vx).toBeGreaterThan(0); // pulled rightward toward centre
    expect(star.vy).toBeCloseTo(0);
  });

  it('leaves a star beyond the current radius untouched', () => {
    const well = createWell(100, 100, 100000);
    const star = starAt(100 + WELL_BASE_RADIUS + 20, 100); // just outside base radius
    applyWell(star, well, 0.05);
    expect(star.vx).toBe(0);
    expect(star.vy).toBe(0);
  });

  it('reaches farther once the radius has grown from holding', () => {
    const well = createWell(100, 100, 100000);
    const far = 100 - (WELL_BASE_RADIUS + 200);
    const before = starAt(far, 100);
    applyWell(before, well, 0.05);
    expect(before.vx).toBe(0); // out of reach at base radius

    well.heldFor = 5; // radius has grown well past base
    const after = starAt(far, 100);
    applyWell(after, well, 0.05);
    expect(after.vx).toBeGreaterThan(0); // now within reach
  });

  it('pulls a closer star harder than a farther one', () => {
    const well = createWell(100, 100, 100000);
    const near = starAt(100 - WELL_BASE_RADIUS * 0.2, 100);
    const far = starAt(100 - WELL_BASE_RADIUS * 0.8, 100);
    applyWell(near, well, 0.05);
    applyWell(far, well, 0.05);
    expect(near.vx).toBeGreaterThan(far.vx);
  });

  it('produces no NaN for a star exactly on the centre', () => {
    const well = createWell(100, 100, 100000);
    const star = starAt(100, 100);
    applyWell(star, well, 0.05);
    expect(Number.isFinite(star.vx)).toBe(true);
    expect(Number.isFinite(star.vy)).toBe(true);
  });
});

describe('isConsumed', () => {
  it('is true for a held well when the star reaches the core', () => {
    const well = createWell(100, 100, 100000);
    expect(isConsumed(starAt(100, 100), well)).toBe(true);
    expect(isConsumed(starAt(100 + WELL_CORE_RADIUS * 0.5, 100), well)).toBe(true);
  });

  it('is false outside the core radius', () => {
    const well = createWell(100, 100, 100000);
    expect(isConsumed(starAt(100 + WELL_CORE_RADIUS + 5, 100), well)).toBe(false);
  });

  it('never consumes once the well is released', () => {
    const well = createWell(100, 100, 100000);
    well.held = false;
    expect(isConsumed(starAt(100, 100), well)).toBe(false);
  });
});

describe('releaseKick', () => {
  it('pushes an in-range star outward, away from the centre', () => {
    const well = createWell(100, 100, 100000);
    const star = starAt(100 - WELL_BASE_RADIUS * 0.5, 100); // left of centre
    releaseKick(star, well);
    expect(star.vx).toBeLessThan(0); // shoved further left, away from centre
  });

  it('leaves a star beyond the radius unkicked', () => {
    const well = createWell(100, 100, 100000);
    const star = starAt(100 + WELL_BASE_RADIUS + 50, 100);
    releaseKick(star, well);
    expect(star.vx).toBe(0);
    expect(star.vy).toBe(0);
  });
});
