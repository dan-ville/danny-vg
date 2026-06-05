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
/** Half-width of the active band around the wavefront, px (band spans ±this). */
export const BAND_HALF_WIDTH = 70;
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
  /** Press point in CSS px. */
  x: number;
  /** Press point in CSS px. */
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
  return ring.radius - BAND_HALF_WIDTH > reach;
}

/**
 * One ring's effect on the glyph at (x, y). Within the band (|dist - radius| <
 * BAND_HALF_WIDTH) the glyph is shoved radially by a pond-ripple profile —
 * outward ahead of the wavefront (s > 0), back inward behind it (s < 0), zero at
 * the crest and outside the band — with magnitude scaling from SHOVE_BASE to
 * SHOVE_MAX by strength. `decode` peaks at the crest and fades to the band edges.
 * Returns all-zero outside the band or at the exact centre.
 */
export function ringEffect(ring: Ring, x: number, y: number): ShoveEffect {
  const dx0 = x - ring.x;
  const dy0 = y - ring.y;
  const dist = Math.hypot(dx0, dy0);
  const s = dist - ring.radius; // signed distance from the wavefront
  if (dist < 1e-6 || Math.abs(s) >= BAND_HALF_WIDTH) return { dx: 0, dy: 0, decode: 0 };

  const peak = SHOVE_BASE + ring.strength * (SHOVE_MAX - SHOVE_BASE);
  const sigma = BAND_HALF_WIDTH / 2;
  // Odd ripple: + outward for s>0, - inward for s<0, ~0 at the crest and edges.
  const ripple = (s / BAND_HALF_WIDTH) * Math.exp(-(s * s) / (2 * sigma * sigma)) * SHAPE_NORM;
  const mag = peak * ripple;
  const ux = dx0 / dist;
  const uy = dy0 / dist;

  const w = 1 - (s / BAND_HALF_WIDTH) ** 2; // 1 at the crest, 0 at the band edges
  const decode = Math.max(0, w) * ring.strength;

  return { dx: ux * mag, dy: uy * mag, decode };
}

/** Combine every active ring at (x, y): sum the shoves, take the max decode. */
export function combineRings(rings: Ring[], x: number, y: number): ShoveEffect {
  let dx = 0;
  let dy = 0;
  let decode = 0;
  for (const ring of rings) {
    const e = ringEffect(ring, x, y);
    dx += e.dx;
    dy += e.dy;
    if (e.decode > decode) decode = e.decode;
  }
  return { dx, dy, decode };
}
