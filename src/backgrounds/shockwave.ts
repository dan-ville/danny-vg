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
 * is the annulus within BAND_HALF_WIDTH of that radius. `strength` (0..1) comes
 * from how long the press was charged and scales both the shove and the decode.
 */

/** Wavefront expansion speed, px/sec. Slower = the sweep is easier to follow. */
export const RING_SPEED = 650;
/** Half-width of the active band around the wavefront, px (band spans ±this).
 *  Wider = more of the screen reacts to a single ring at once. */
export const BAND_HALF_WIDTH = 110;
/** Peak radial shove at strength 0, px (a quick tap still reads). */
export const SHOVE_BASE = 22;
/** Peak radial shove at full strength, px. */
export const SHOVE_MAX = 60;
/** Strength floor for a zero-charge tap. A plain click still pushes; the drama
 *  comes from holding, which both gathers the rain and grows this toward 1. */
export const MIN_STRENGTH = 0.4;
/** Seconds of holding that reaches full gather/charge. Short + eased (below) so
 *  the grab bites almost immediately, then keeps tightening. */
export const CHARGE_FULL = 0.8;
/** Reach (px) of the inward gather while charging. */
export const CHARGE_PULL_RADIUS = 300;
/** Fraction of the way to the cursor a glyph is yanked at full gather. Near 1 so
 *  the rain collapses onto the cursor instead of drifting past. */
export const CHARGE_PULL_FRAC = 0.95;
/** Inner share of the radius that gets the *full* pull (flat core); past it the
 *  pull eases to zero at the rim. Keeps the whole zone grabby, not just centre. */
export const CHARGE_PULL_CORE = 0.6;
/** Seconds the release recoil takes to unwind the knot outward to rest. */
export const RECOIL_TIME = 0.22;
/** How hard the recoil overshoots outward before settling (× the gather). */
const RECOIL_OVERSHOOT = 0.6;
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

/** A press that gathers the rain into a knot, then recoils on release.
 *  Anchored at the press point for its whole life. */
export interface Charge {
  /** Press point in CSS px. */
  x: number;
  /** Press point in CSS px. */
  y: number;
  /** Seconds held so far (frozen at release — this is the gather level). */
  t: number;
  /** True while the pointer is down (gathering); false during the recoil fling. */
  held: boolean;
  /** Seconds since release; 0 while held, counts up through RECOIL_TIME. */
  release: number;
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
  // Parabolic window: 1 at the crest, smoothly 0 at the band edges. Shared by the
  // shove and the decode so both fade to zero at |s| = BAND_HALF_WIDTH with no jump.
  const w = Math.max(0, 1 - (s / BAND_HALF_WIDTH) ** 2);
  // Odd ripple: + outward for s>0, - inward for s<0, ~0 at the crest; windowed by w.
  const ripple = (s / BAND_HALF_WIDTH) * Math.exp(-(s * s) / (2 * sigma * sigma)) * SHAPE_NORM;
  const mag = peak * ripple * w;
  const ux = dx0 / dist;
  const uy = dy0 / dist;

  const decode = w * ring.strength;

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

/**
 * The charge's effect on the glyph at (x, y). Displacement is a *fraction* of the
 * glyph's offset from the cursor, so the rain visibly collapses toward it rather
 * than nudging — the gather is distance-proportional, scaled by an eased hold
 * time and a flat-core distance window (full pull out to CHARGE_PULL_CORE of the
 * radius, then eased to zero at the rim) so the whole zone grabs, not just centre.
 *
 * While `held`, the fraction is inward (positive), yanking glyphs toward the
 * cursor. After release, it unwinds over RECOIL_TIME: the inward pull eases to
 * zero with a brief outward overshoot (the slingshot fling), so the knot springs
 * back out rather than snapping. Brightness (`glow`) tracks the gather and fades
 * with the recoil. Returns all-zero before the charge builds or out of reach.
 */
export function chargePull(charge: Charge, x: number, y: number): ChargeEffect {
  const dx0 = x - charge.x;
  const dy0 = y - charge.y;
  const dist = Math.hypot(dx0, dy0);
  const c = Math.min(1, charge.t / CHARGE_FULL);
  if (dist < 1e-6 || dist >= CHARGE_PULL_RADIUS || c <= 0) return { dx: 0, dy: 0, glow: 0 };
  // Ease-out so the grab bites hard early instead of creeping up linearly.
  const g = 1 - (1 - c) * (1 - c);
  // Flat-core window: full pull out to CHARGE_PULL_CORE·radius, then eased to the rim.
  const core = CHARGE_PULL_RADIUS * CHARGE_PULL_CORE;
  const window = dist <= core ? 1 : 1 - (dist - core) / (CHARGE_PULL_RADIUS - core);
  const gather = CHARGE_PULL_FRAC * g * window; // inward fraction at full gather

  let frac: number;
  let glow: number;
  if (charge.held) {
    frac = gather;
    glow = g * window;
  } else {
    // Recoil: ease the inward pull to zero with a short outward overshoot.
    const p = Math.min(1, charge.release / RECOIL_TIME);
    frac = gather * (1 - p) - RECOIL_OVERSHOOT * gather * Math.sin(p * Math.PI);
    glow = g * window * (1 - p);
  }
  // Positive frac pulls toward the cursor; negative pushes outward.
  return { dx: -dx0 * frac, dy: -dy0 * frac, glow };
}
