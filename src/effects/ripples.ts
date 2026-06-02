/**
 * Pure water-ripple model. Kept free of canvas/DOM (apart from the small
 * background-tap predicate) so the expansion, decay, and lifetime math can be
 * unit-tested deterministically; RippleCanvas.tsx owns the canvas + rAF loop.
 *
 * Each tap on the empty background spawns a small cluster of concentric rings
 * with slightly offset expansion speeds and staggered starts, so they read as a
 * single splash spreading outward rather than a set of identical circles.
 */

export interface Ring {
  /** Tap centre in CSS pixels. */
  x: number;
  y: number;
  /** Seconds since the cluster spawned. */
  age: number;
  /** Seconds before this ring starts expanding (staggers the cluster). */
  delay: number;
  /** Expansion speed in px/sec. */
  speed: number;
  /** Seconds of active expansion before the ring fully fades. */
  lifetime: number;
}

/** Base expansion speed before per-ring jitter (px/sec). */
const BASE_SPEED = 180;
/** Base active lifetime before per-ring jitter (sec). */
const BASE_LIFETIME = 1.1;
/** Peak stroke opacity at the moment a ring becomes active. */
const PEAK_ALPHA = 0.5;

/**
 * Build the ring cluster for a single tap at (x, y). `rand` is injectable
 * (defaults to Math.random) so tests can feed a deterministic sequence.
 */
export function createRipple(x: number, y: number, rand: () => number = Math.random): Ring[] {
  const count = 2 + Math.round(rand()); // 2 or 3 rings per tap
  const rings: Ring[] = [];
  for (let i = 0; i < count; i++) {
    rings.push({
      x,
      y,
      age: 0,
      // Each successive ring starts a touch later than the last.
      delay: i * (0.06 + rand() * 0.05),
      // Offset expansion speeds so the rings fan apart as they grow.
      speed: BASE_SPEED * (0.85 + rand() * 0.4),
      lifetime: BASE_LIFETIME * (0.9 + rand() * 0.3),
    });
  }
  return rings;
}

/** Mutate a ring forward by `dt` seconds. */
export function advanceRing(ring: Ring, dt: number): void {
  ring.age += dt;
}

/** How long the ring has been actively expanding (0 before its delay). */
function activeTime(ring: Ring): number {
  return ring.age - ring.delay;
}

/** Current radius in CSS pixels; 0 until the ring's delay has elapsed. */
export function ringRadius(ring: Ring): number {
  return Math.max(0, activeTime(ring)) * ring.speed;
}

/** Current stroke opacity, decaying from PEAK_ALPHA to 0 across the lifetime. */
export function ringAlpha(ring: Ring): number {
  const t = activeTime(ring) / ring.lifetime;
  if (t <= 0 || t >= 1) return 0;
  return (1 - t) * PEAK_ALPHA;
}

/** True once the ring has finished its delay + full fade. */
export function isRingExpired(ring: Ring): boolean {
  return ring.age >= ring.delay + ring.lifetime;
}

// The background-tap predicate is shared with other pointer effects (e.g. the
// galaxy gravity well), so it lives in its own module; re-exported here for the
// ripple's existing consumers and tests.
export { isBackgroundTap } from './backgroundTap';
