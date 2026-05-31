import { describe, it, expect } from 'vitest';
import { createStars, advanceStar, starCount, starAlpha } from './stars';

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
