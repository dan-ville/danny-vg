import { describe, it, expect } from 'vitest';
import { createStars, advanceStar, starCount, starAlpha, spawnStarAtEdge } from './stars';

describe('starCount', () => {
  it('clamps density to the 150–250 range', () => {
    expect(starCount(1, 1)).toBe(150); // tiny viewport floors at the minimum
    expect(starCount(10000, 10000)).toBe(250); // huge viewport caps at the maximum
  });

  it('scales with viewport area between the bounds', () => {
    const count = starCount(390, 844); // typical phone
    expect(count).toBeGreaterThanOrEqual(150);
    expect(count).toBeLessThanOrEqual(250);
  });
});

describe('createStars', () => {
  // Deterministic pseudo-random sequence so the test is repeatable.
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('creates the requested number of stars', () => {
    const stars = createStars(200, 390, 844, seq([0.5]));
    expect(stars).toHaveLength(200);
  });

  it('places every star inside the viewport bounds', () => {
    const stars = createStars(50, 390, 844, seq([0, 0.25, 0.5, 0.75, 0.99]));
    for (const star of stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(390);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(844);
    }
  });

  it('gives each star a positive radius and a base alpha within [0,1]', () => {
    const stars = createStars(30, 390, 844, seq([0.1, 0.6, 0.3, 0.9]));
    for (const star of stars) {
      expect(star.radius).toBeGreaterThan(0);
      expect(star.baseAlpha).toBeGreaterThan(0);
      expect(star.baseAlpha).toBeLessThanOrEqual(1);
    }
  });

  it('starts every star with zero impulse velocity', () => {
    const stars = createStars(10, 390, 844, seq([0.5]));
    for (const star of stars) {
      expect(star.vx).toBe(0);
      expect(star.vy).toBe(0);
    }
  });
});

describe('advanceStar', () => {
  it('drifts the star by its velocity scaled by the time delta', () => {
    const star = {
      x: 100,
      y: 100,
      radius: 1,
      baseAlpha: 0.8,
      twinkleSpeed: 1,
      twinklePhase: 0,
      driftX: 10, // px/sec
      driftY: -5,
    };
    advanceStar(star, 390, 844, 0.5); // half a second
    expect(star.x).toBeCloseTo(105);
    expect(star.y).toBeCloseTo(97.5);
  });

  it('advances the twinkle phase over time', () => {
    const star = {
      x: 0,
      y: 0,
      radius: 1,
      baseAlpha: 0.8,
      twinkleSpeed: 2,
      twinklePhase: 0,
      driftX: 0,
      driftY: 0,
    };
    advanceStar(star, 390, 844, 1);
    expect(star.twinklePhase).toBeCloseTo(2);
  });

  it('wraps a star that drifts off the right edge back to the left', () => {
    const star = {
      x: 389,
      y: 100,
      radius: 1,
      baseAlpha: 0.8,
      twinkleSpeed: 1,
      twinklePhase: 0,
      driftX: 100,
      driftY: 0,
    };
    advanceStar(star, 390, 844, 1); // x would be 489 → wraps
    expect(star.x).toBeLessThan(390);
  });

  it('moves the star by its impulse velocity on top of its drift', () => {
    const star = {
      x: 100,
      y: 100,
      radius: 1,
      baseAlpha: 0.8,
      twinkleSpeed: 1,
      twinklePhase: 0,
      driftX: 10,
      driftY: 0,
      vx: 40, // inward impulse from a gravity well
      vy: -20,
    };
    advanceStar(star, 390, 844, 0.5);
    expect(star.x).toBeCloseTo(125); // (10 + 40) * 0.5
    expect(star.y).toBeCloseTo(90); // (0 + -20) * 0.5
  });

  it('damps the impulse velocity toward zero over time', () => {
    const star = {
      x: 100,
      y: 100,
      radius: 1,
      baseAlpha: 0.8,
      twinkleSpeed: 1,
      twinklePhase: 0,
      driftX: 0,
      driftY: 0,
      vx: 100,
      vy: -100,
    };
    advanceStar(star, 390, 844, 0.05);
    expect(Math.abs(star.vx!)).toBeLessThan(100);
    expect(Math.abs(star.vy!)).toBeLessThan(100);
  });

  it('does not wrap a transient star — it leaves the viewport so it can be culled', () => {
    const star = {
      x: 389,
      y: 100,
      radius: 1,
      baseAlpha: 0.8,
      twinkleSpeed: 1,
      twinklePhase: 0,
      driftX: 100,
      driftY: 0,
      transient: true,
    };
    advanceStar(star, 390, 844, 1); // x → 489
    expect(star.x).toBeGreaterThan(390); // stayed out of bounds, no wrap
  });

  it('wraps a star that drifts off the top edge back to the bottom', () => {
    const star = {
      x: 100,
      y: 1,
      radius: 1,
      baseAlpha: 0.8,
      twinkleSpeed: 1,
      twinklePhase: 0,
      driftX: 0,
      driftY: -100,
    };
    advanceStar(star, 390, 844, 1); // y would be -99 → wraps
    expect(star.y).toBeGreaterThan(0);
  });
});

describe('spawnStarAtEdge', () => {
  // Force a specific edge: the first rand() picks the edge (floor(r*4)).
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('spawns the star outside the viewport on every edge, drifting inward', () => {
    const W = 390;
    const H = 844;
    const cx = W / 2;
    const cy = H / 2;
    for (const edgePick of [0, 0.25, 0.5, 0.75]) {
      const star = spawnStarAtEdge(W, H, seq([edgePick, 0.5]));
      const outside = star.x < 0 || star.x > W || star.y < 0 || star.y > H;
      expect(outside).toBe(true);
      // Drift carries it back toward the interior.
      const inward = (cx - star.x) * star.driftX + (cy - star.y) * star.driftY;
      expect(inward).toBeGreaterThan(0);
    }
  });

  it('marks edge-spawned stars transient so they are culled, not wrapped', () => {
    const star = spawnStarAtEdge(390, 844, seq([0.1, 0.5]));
    expect(star.transient).toBe(true);
  });
});

describe('starAlpha', () => {
  it('oscillates around the base alpha as the phase advances', () => {
    const star = {
      x: 0,
      y: 0,
      radius: 1,
      baseAlpha: 0.5,
      twinkleSpeed: 1,
      twinklePhase: 0,
      driftX: 0,
      driftY: 0,
    };
    const a0 = starAlpha(star);
    star.twinklePhase = Math.PI / 2; // quarter cycle later — sin peaks
    const a1 = starAlpha(star);
    expect(a0).not.toBeCloseTo(a1);
    expect(a0).toBeGreaterThanOrEqual(0);
    expect(a0).toBeLessThanOrEqual(1);
    expect(a1).toBeGreaterThanOrEqual(0);
    expect(a1).toBeLessThanOrEqual(1);
  });
});
