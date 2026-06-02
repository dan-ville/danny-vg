import { describe, it, expect } from 'vitest';
import {
  createParticle,
  advanceParticle,
  particleAlpha,
  isDead,
  rotateHue,
  type SmokeParticle,
} from './rainbowSmoke';

describe('rotateHue', () => {
  it('advances the hue while held and wraps past 360', () => {
    expect(rotateHue(0, 1)).toBeCloseTo(90); // SMOKE_HUE_RATE = 90 deg/s
    expect(rotateHue(350, 1)).toBeCloseTo(80); // 440 % 360
  });
});

describe('createParticle', () => {
  it('emits near the press point with an upward launch', () => {
    const p = createParticle(100, 200, 120, () => 0.5); // rand=0.5 → centred jitter, zero vx
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
    expect(p.vy).toBeLessThan(0); // rising
    expect(p.age).toBe(0);
    expect(p.r).toBeGreaterThan(0);
  });

  it('keeps the hue within 0–360 even when jitter pushes it past an edge', () => {
    for (let n = 0; n < 50; n++) {
      const p = createParticle(0, 0, 2, Math.random); // near 0, jitter can go negative
      expect(p.hue).toBeGreaterThanOrEqual(0);
      expect(p.hue).toBeLessThan(360);
    }
  });

  it('seeds a positive lifetime', () => {
    expect(createParticle(0, 0, 0, () => 0).life).toBeGreaterThan(0);
  });
});

describe('advanceParticle', () => {
  /** A puff with known, simple state for deterministic stepping. */
  function puff(over: Partial<SmokeParticle> = {}): SmokeParticle {
    return { x: 0, y: 0, r: 10, vx: 0, vy: -100, hue: 0, age: 0, life: 3, sway: 0, swayAmp: 0, ...over };
  }

  it('rises (y decreases) and billows (r grows) over time', () => {
    const p = puff();
    advanceParticle(p, 0.1);
    expect(p.y).toBeLessThan(0); // moved up
    expect(p.r).toBeGreaterThan(10); // expanded
    expect(p.age).toBeCloseTo(0.1);
  });

  it('eases the launch speed toward the gentle terminal rise', () => {
    const p = puff({ vy: -100 });
    advanceParticle(p, 0.1);
    expect(p.vy).toBeGreaterThan(-100); // decelerating from the launch (toward -32)
    expect(p.vy).toBeLessThan(0); // but still rising
  });
});

describe('particleAlpha', () => {
  it('is zero at birth and death, positive in between', () => {
    expect(particleAlpha({ age: 0, life: 3 } as SmokeParticle)).toBeCloseTo(0);
    expect(particleAlpha({ age: 3, life: 3 } as SmokeParticle)).toBeCloseTo(0);
    expect(particleAlpha({ age: 1.5, life: 3 } as SmokeParticle)).toBeGreaterThan(0);
  });
});

describe('isDead', () => {
  it('is true only once age reaches the lifetime', () => {
    expect(isDead({ age: 1, life: 3 } as SmokeParticle)).toBe(false);
    expect(isDead({ age: 3, life: 3 } as SmokeParticle)).toBe(true);
  });
});
