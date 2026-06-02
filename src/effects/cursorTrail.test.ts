import { describe, it, expect } from 'vitest';
import {
  createParticle,
  advanceParticle,
  particleAlpha,
  isDead,
  blinkOn,
  COMET_SPARKS,
  SPARKLER_SPARKS,
  TERMINAL_BLINK_MS,
  type CursorParticle,
} from './cursorTrail';

describe('createParticle', () => {
  it('seeds at the origin with size/lifetime inside the config ranges', () => {
    const p = createParticle(40, 60, SPARKLER_SPARKS, () => 0);
    expect(p.x).toBe(40);
    expect(p.y).toBe(60);
    expect(p.r).toBeGreaterThanOrEqual(SPARKLER_SPARKS.rMin);
    expect(p.r).toBeLessThanOrEqual(SPARKLER_SPARKS.rMax);
    expect(p.life).toBeGreaterThanOrEqual(SPARKLER_SPARKS.lifeMin);
    expect(p.age).toBe(0);
  });

  it('keeps the comet hue in the cyan→violet band', () => {
    for (let n = 0; n < 40; n++) {
      const p = createParticle(0, 0, COMET_SPARKS, Math.random);
      expect(p.hue).toBeGreaterThanOrEqual(190);
      expect(p.hue).toBeLessThanOrEqual(270);
    }
  });
});

describe('advanceParticle', () => {
  function particle(over: Partial<CursorParticle> = {}): CursorParticle {
    return { x: 0, y: 0, vx: 10, vy: 0, r: 2, hue: 200, age: 0, life: 0.5, ...over };
  }

  it('ages and drifts along its velocity', () => {
    const p = particle();
    advanceParticle(p, 0.1);
    expect(p.age).toBeCloseTo(0.1);
    expect(p.x).toBeGreaterThan(0);
  });

  it('accelerates downward when gravity is applied', () => {
    const p = particle({ vy: 0 });
    advanceParticle(p, 0.1, 460);
    expect(p.vy).toBeGreaterThan(0); // pulled down
  });
});

describe('particleAlpha / isDead', () => {
  it('fades from 1 to 0 across the lifetime', () => {
    expect(particleAlpha({ age: 0, life: 1 } as CursorParticle)).toBeCloseTo(1);
    expect(particleAlpha({ age: 1, life: 1 } as CursorParticle)).toBeCloseTo(0);
  });

  it('is dead only once age reaches life', () => {
    expect(isDead({ age: 0.4, life: 0.5 } as CursorParticle)).toBe(false);
    expect(isDead({ age: 0.5, life: 0.5 } as CursorParticle)).toBe(true);
  });
});

describe('blinkOn', () => {
  it('is on for the first half of the period and off for the second', () => {
    expect(blinkOn(0)).toBe(true);
    expect(blinkOn(TERMINAL_BLINK_MS / 4)).toBe(true);
    expect(blinkOn(TERMINAL_BLINK_MS * 0.75)).toBe(false);
    expect(blinkOn(TERMINAL_BLINK_MS)).toBe(true); // wraps
  });
});
