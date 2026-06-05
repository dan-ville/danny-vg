/**
 * Pure model for the Matrix "shockwave-decode" background interaction: a tap (or
 * charged hold) on the empty background fires an expanding ring that sweeps the
 * falling rain — physically shoving glyphs outward in a pond-ripple and
 * "decoding" them (flash white + scramble, then settle). Kept free of canvas/DOM
 * so the propagation, ripple, and decode math can be unit-tested
 * deterministically; MatrixBackground.tsx owns the pointer listeners and the rAF
 * loop. This replaces the old vortex twist as matrix's signature interaction.
 *
 * Positions are CSS px. A ring's `radius` grows at RING_SPEED; its active "band"
 * is the annulus within BAND_THICKNESS of that radius. `strength` (0..1) comes
 * from how long the press was charged and scales both the shove and the decode.
 */

/** Wavefront expansion speed, px/sec. */
export const RING_SPEED = 850;
/** Half-width of the active band around the wavefront, px. */
export const BAND_THICKNESS = 70;
/** Peak radial shove at strength 0, px (a quick tap still reads). */
export const SHOVE_BASE = 22;
/** Peak radial shove at full strength, px. */
export const SHOVE_MAX = 60;
/** Strength floor so a zero-charge tap is still visible. */
export const MIN_STRENGTH = 0.15;
/** Seconds of holding that reaches full charge. */
export const CHARGE_FULL = 1.2;
/** Reach (px) of the inward bend while charging. */
export const CHARGE_PULL_RADIUS = 160;
/** Peak inward displacement at full charge, px. */
export const CHARGE_PULL_MAX = 18;
/** Max concurrent rings; oldest is dropped past this. */
export const MAX_RINGS = 6;
/** Normalizes the ripple shape so its extremum is ~1 (tuning). */
const SHAPE_NORM = 3.3;

/** An expanding shockwave ring centred where the press was released. */
export interface Ring {
  /** Centre in CSS px. */
  x: number;
  y: number;
  /** Current wavefront radius, px; grows over time. */
  radius: number;
  /** Wavefront expansion speed, px/sec. */
  speed: number;
  /** 0..1 — scales shove magnitude and decode intensity. */
  strength: number;
}

/** A held press that is charging a ring; anchored at the press point. */
export interface Charge {
  x: number;
  y: number;
  /** Seconds held so far. */
  t: number;
}

/** A ring's effect on one glyph: radial shove vector + decode intensity. */
export interface ShoveEffect {
  dx: number;
  dy: number;
  /** 0..1 — drives whitening and glyph scramble in the component. */
  decode: number;
}

/** A charge's effect on one glyph: inward bend vector + brighten. */
export interface ChargeEffect {
  dx: number;
  dy: number;
  /** 0..1 — drives brightening in the component. */
  glow: number;
}

/** Fire a ring from the press point. `charge` (0..1) sets its strength. */
export function createRing(x: number, y: number, charge: number): Ring {
  const c = Math.max(0, Math.min(1, charge));
  return { x, y, radius: 0, speed: RING_SPEED, strength: MIN_STRENGTH + c * (1 - MIN_STRENGTH) };
}

/** Expand the wavefront by `dt` seconds. */
export function advanceRing(ring: Ring, dt: number): void {
  ring.radius += ring.speed * dt;
}

/** True once the band's trailing edge has passed `reach` (e.g. viewport diagonal). */
export function isRingDone(ring: Ring, reach: number): boolean {
  return ring.radius - BAND_THICKNESS > reach;
}
