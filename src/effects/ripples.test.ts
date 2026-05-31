import { describe, it, expect } from 'vitest';
import {
  createRipple,
  advanceRing,
  ringRadius,
  ringAlpha,
  isRingExpired,
  isBackgroundTap,
} from './ripples';

// Deterministic pseudo-random sequence so spawn math is repeatable.
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('createRipple', () => {
  it('spawns 2–3 concentric rings per tap', () => {
    const few = createRipple(10, 20, seq([0])); // rounds toward 2
    expect(few.length).toBeGreaterThanOrEqual(2);
    expect(few.length).toBeLessThanOrEqual(3);

    const more = createRipple(10, 20, seq([0.99])); // rounds toward 3
    expect(more.length).toBeGreaterThanOrEqual(2);
    expect(more.length).toBeLessThanOrEqual(3);
  });

  it('anchors every ring at the tap point', () => {
    const rings = createRipple(123, 456, seq([0.5]));
    for (const ring of rings) {
      expect(ring.x).toBe(123);
      expect(ring.y).toBe(456);
      expect(ring.age).toBe(0);
    }
  });

  it('gives the rings offset expansion speeds and staggered starts', () => {
    const rings = createRipple(0, 0, seq([0.1, 0.4, 0.7, 0.2, 0.9, 0.3]));
    expect(rings.length).toBeGreaterThanOrEqual(2);
    // Later rings start after earlier ones (staggered delays).
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i].delay).toBeGreaterThan(rings[i - 1].delay);
    }
    // Speeds vary between rings rather than being identical.
    const speeds = new Set(rings.map((r) => r.speed));
    expect(speeds.size).toBeGreaterThan(1);
  });

  it('gives every ring a positive speed and lifetime', () => {
    const rings = createRipple(0, 0, seq([0.3, 0.6, 0.9]));
    for (const ring of rings) {
      expect(ring.speed).toBeGreaterThan(0);
      expect(ring.lifetime).toBeGreaterThan(0);
    }
  });
});

describe('advanceRing', () => {
  it('ages the ring by the elapsed time', () => {
    const ring = { x: 0, y: 0, age: 0, delay: 0, speed: 100, lifetime: 1 };
    advanceRing(ring, 0.25);
    expect(ring.age).toBeCloseTo(0.25);
    advanceRing(ring, 0.25);
    expect(ring.age).toBeCloseTo(0.5);
  });
});

describe('ringRadius', () => {
  it('is zero until the ring delay has elapsed', () => {
    const ring = { x: 0, y: 0, age: 0.05, delay: 0.1, speed: 100, lifetime: 1 };
    expect(ringRadius(ring)).toBe(0);
  });

  it('expands at the ring speed once active', () => {
    const ring = { x: 0, y: 0, age: 0.6, delay: 0.1, speed: 100, lifetime: 1 };
    expect(ringRadius(ring)).toBeCloseTo(50); // (0.6 - 0.1) * 100
  });
});

describe('ringAlpha', () => {
  it('is zero before the ring becomes active', () => {
    const ring = { x: 0, y: 0, age: 0.05, delay: 0.1, speed: 100, lifetime: 1 };
    expect(ringAlpha(ring)).toBe(0);
  });

  it('decays from its peak toward zero across the lifetime', () => {
    const ring = { x: 0, y: 0, age: 0.1, delay: 0, speed: 100, lifetime: 1 };
    const early = ringAlpha(ring);
    ring.age = 0.8;
    const late = ringAlpha(ring);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(early);
  });

  it('is zero once the ring has fully faded', () => {
    const ring = { x: 0, y: 0, age: 1.5, delay: 0, speed: 100, lifetime: 1 };
    expect(ringAlpha(ring)).toBe(0);
  });

  it('never exceeds full opacity', () => {
    const ring = { x: 0, y: 0, age: 0.001, delay: 0, speed: 100, lifetime: 1 };
    expect(ringAlpha(ring)).toBeLessThanOrEqual(1);
  });
});

describe('isRingExpired', () => {
  it('is false while the ring is still fading', () => {
    const ring = { x: 0, y: 0, age: 0.5, delay: 0, speed: 100, lifetime: 1 };
    expect(isRingExpired(ring)).toBe(false);
  });

  it('is true once age passes delay + lifetime', () => {
    const ring = { x: 0, y: 0, age: 1.2, delay: 0.1, speed: 100, lifetime: 1 };
    expect(isRingExpired(ring)).toBe(true);
  });
});

describe('isBackgroundTap', () => {
  it('treats a tap on empty background as a ripple', () => {
    const div = document.createElement('div');
    expect(isBackgroundTap(div)).toBe(true);
  });

  it('ignores taps that land on a link', () => {
    const link = document.createElement('a');
    link.href = '#';
    document.body.appendChild(link);
    expect(isBackgroundTap(link)).toBe(false);
    document.body.removeChild(link);
  });

  it('ignores taps on an element nested inside a button', () => {
    const button = document.createElement('button');
    const span = document.createElement('span');
    button.appendChild(span);
    document.body.appendChild(button);
    expect(isBackgroundTap(span)).toBe(false);
    document.body.removeChild(button);
  });

  it('ignores taps on anything marked data-no-ripple', () => {
    const el = document.createElement('div');
    el.setAttribute('data-no-ripple', '');
    expect(isBackgroundTap(el)).toBe(false);
  });

  it('treats a non-Element target as background', () => {
    expect(isBackgroundTap(null)).toBe(true);
    expect(isBackgroundTap(window)).toBe(true);
  });
});
