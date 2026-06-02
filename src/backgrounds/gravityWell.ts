/**
 * Pure gravity-well model for the galaxy background. Pressing the empty
 * background spawns a *held* well that tugs nearby drifting stars inward; the
 * longer it's held the wider its reach grows (up to a per-well cap), and stars
 * that reach its core are consumed (see galaxySim.ts, which recycles them in
 * from the edges). Dragging recentres the well so the stars follow; releasing
 * kicks the survivors outward so they scatter and resettle into normal drift.
 *
 * Kept free of canvas/DOM so the force, growth, consumption, and release math
 * can be unit-tested deterministically; GalaxyBackground.tsx owns the pointer
 * listeners and the rAF loop.
 */

import type { Star } from './stars';

/** Reach (CSS px) the instant a well is born, before any hold-growth. */
export const WELL_BASE_RADIUS = 160;
/** How fast the reach expands while held (px per second). */
export const WELL_GROWTH_RATE = 280;
/** Stars within this distance (CSS px) of a held well's centre are consumed. */
export const WELL_CORE_RADIUS = 16;
/** Peak inward acceleration at the centre (px/sec²) before linear falloff. */
const WELL_STRENGTH = 1700;
/** Peak outward speed (px/sec) imparted to survivors when the well releases. */
const WELL_RELEASE_SPEED = 300;

export interface Well {
  /** Current centre in CSS pixels (follows the pointer while dragging). */
  x: number;
  y: number;
  /** True while the pointer is down; false the moment it's released. */
  held: boolean;
  /** Seconds the well has been held — drives the growing reach. */
  heldFor: number;
  /** Upper bound on the reach (typically the viewport diagonal). */
  maxRadius: number;
}

/** Spawn a held well anchored at the press point. */
export function createWell(x: number, y: number, maxRadius: number): Well {
  return { x, y, held: true, heldFor: 0, maxRadius };
}

/** Recentre the well so it tracks a drag. */
export function moveWell(well: Well, x: number, y: number): void {
  well.x = x;
  well.y = y;
}

/** Current reach: grows linearly with hold time, clamped to the well's max. */
export function wellRadius(well: Well): number {
  return Math.min(well.maxRadius, WELL_BASE_RADIUS + WELL_GROWTH_RATE * well.heldFor);
}

/**
 * Add this frame's inward impulse to a star's velocity. The pull is strongest
 * at the centre and falls linearly to zero at the *current* reach (so it's
 * bounded and grows as the well is held). Stars beyond the reach are untouched.
 */
export function applyWell(star: Star, well: Well, dt: number): void {
  const r = wellRadius(well);
  const dx = well.x - star.x;
  const dy = well.y - star.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= r) return;

  const accel = WELL_STRENGTH * (1 - dist / r); // 1 at centre → 0 at the reach
  const inv = dist > 0 ? 1 / dist : 0; // unit vector toward centre; 0 dead-centre
  star.vx = (star.vx ?? 0) + dx * inv * accel * dt;
  star.vy = (star.vy ?? 0) + dy * inv * accel * dt;
}

/** True when a held well has drawn a star all the way into its core. */
export function isConsumed(star: Star, well: Well): boolean {
  if (!well.held) return false;
  return Math.hypot(well.x - star.x, well.y - star.y) <= WELL_CORE_RADIUS;
}

/**
 * On release, shove an in-range star outward (away from the centre), hardest
 * near the middle, so the gathered cloud scatters before damping settles it
 * back into normal drift. Stars beyond the reach are left alone.
 */
export function releaseKick(star: Star, well: Well): void {
  const r = wellRadius(well);
  const dx = star.x - well.x; // pointing away from the centre
  const dy = star.y - well.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= r) return;

  const speed = WELL_RELEASE_SPEED * (1 - dist / r);
  const inv = dist > 0 ? 1 / dist : 0;
  star.vx = (star.vx ?? 0) + dx * inv * speed;
  star.vy = (star.vy ?? 0) + dy * inv * speed;
}
