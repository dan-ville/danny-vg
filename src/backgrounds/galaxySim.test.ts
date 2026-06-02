import { describe, it, expect } from 'vitest';
import { updateStarField, HELD_EXTRA_FRAC, INFLOW_FILL_SECONDS } from './galaxySim';
import { createStars, starCount, type Star } from './stars';
import { createWell } from './gravityWell';

const W = 400;
const H = 400;

/** A persistent star fixed at (x, y) with no motion. */
function persistentAt(x: number, y: number): Star {
  return {
    x,
    y,
    radius: 1,
    baseAlpha: 0.8,
    twinkleSpeed: 0,
    twinklePhase: 0,
    driftX: 0,
    driftY: 0,
    vx: 0,
    vy: 0,
  };
}

/** A well parked far off-screen so it pulls/consumes nothing — isolates inflow. */
function farWell(heldFor: number) {
  const well = createWell(-5000, -5000, 100000);
  well.heldFor = heldFor;
  return well;
}

describe('updateStarField', () => {
  it('advances the hold timer while the well is held', () => {
    const well = farWell(0);
    updateStarField([persistentAt(200, 200)], well, 0.05, W, H);
    expect(well.heldFor).toBeCloseTo(0.05);
  });

  it('keeps the persistent count constant by recycling consumed stars to the edges', () => {
    const well = createWell(200, 200, 100000); // dead-centre, held
    const stars = [persistentAt(200, 200), persistentAt(200, 200), persistentAt(200, 200)];
    const out = updateStarField(stars, well, 0.001, W, H);
    expect(out).toHaveLength(3); // none lost — all recycled
    for (const s of out) {
      expect(s.transient).toBeFalsy(); // still persistent
      const offscreen = s.x < 0 || s.x > W || s.y < 0 || s.y > H;
      expect(offscreen).toBe(true); // sent back out to stream in again
    }
  });

  it('removes consumed transient stars instead of recycling them', () => {
    const well = createWell(200, 200, 100000);
    const transients: Star[] = [
      { ...persistentAt(200, 200), transient: true },
      { ...persistentAt(200, 200), transient: true },
    ];
    const out = updateStarField(transients, well, 0.001, W, H);
    expect(out).toHaveLength(0); // consumed transients are gone for good
  });

  it('spawns extra inflow while held, capped at the held fraction of the field', () => {
    const target = starCount(W, H);
    const extraCap = Math.round(target * HELD_EXTRA_FRAC);
    const stars = createStars(target, W, H);
    const well = farWell(INFLOW_FILL_SECONDS); // fully ramped
    const out = updateStarField(stars, well, 0.001, W, H);
    const transientCount = out.filter((s) => s.transient).length;
    expect(transientCount).toBe(extraCap);
    expect(out).toHaveLength(target + extraCap);
  });

  it('ramps the inflow up the longer the well is held', () => {
    const target = starCount(W, H);
    const brief = updateStarField(createStars(target, W, H), farWell(0.5), 0.001, W, H);
    const long = updateStarField(createStars(target, W, H), farWell(2.0), 0.001, W, H);
    const briefT = brief.filter((s) => s.transient).length;
    const longT = long.filter((s) => s.transient).length;
    expect(longT).toBeGreaterThan(briefT);
  });

  it('adds no inflow and keeps the field intact when there is no well', () => {
    const stars = [persistentAt(100, 100), persistentAt(300, 300)];
    const out = updateStarField(stars, null, 0.05, W, H);
    expect(out).toHaveLength(2);
    expect(out.some((s) => s.transient)).toBe(false);
  });

  it('culls transient stars that have drifted off-screen (drains after release)', () => {
    const offscreen: Star = { ...persistentAt(W + 200, 200), transient: true };
    const kept = persistentAt(100, 100);
    const out = updateStarField([offscreen, kept], null, 0.05, W, H);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(kept);
  });
});
