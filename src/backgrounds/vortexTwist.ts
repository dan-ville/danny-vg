/**
 * Pure model for the Matrix "vortex twist" background interaction: a
 * press-and-hold swirl that warps the falling digital rain. Kept free of
 * canvas/DOM so the seeding, evolution, and warp math can be unit-tested
 * deterministically; MatrixBackground.tsx owns the pointer listeners and the
 * rAF loop. The galaxy gravity well (gravityWell.ts) is the sibling pattern —
 * a deliberate, user-initiated interaction that bends the live background.
 *
 * The swirl is intentionally subtle (on the order of the star drift) and never
 * identical twice: each press seeds a randomized `roll`, and slow oscillators
 * keep it drifting while held — faster dragging stirs the asymmetry harder.
 */

/** Gaussian falloff radius of the swirl, in CSS px. */
export const TWIST_RADIUS = 150;
/** Base peak rotation (radians) at the swirl centre. */
export const TWIST_STRENGTH = 1.3;
/** Spread (0..1) for per-press and while-held variation. */
export const TWIST_RANDOMNESS = 0.45;

/** How fast `strength` eases toward its target (per second). */
const ENVELOPE_RATE = 5;
/** Asymmetry lobe count is picked from these per press. */
const LOBE_CHOICES = [2, 3];
/** Drag speed (px/s) that maps to one unit of extra phase stir. */
const STIR_REFERENCE_SPEED = 120;
/** Cap on the drag-stir term so a fast flick can't spin it wildly. */
const STIR_MAX = 6;
/** Below this effective warp the point is left untouched (perf + clean rest). */
const WARP_EPSILON = 0.004;
/** Strength below which the swirl counts as fully at rest. */
const REST_STRENGTH = 0.002;

/** The per-press randomized character of a swirl, plus its live evolution. */
export interface TwistRoll {
  /** Swirl direction: +1 clockwise, -1 counter-clockwise. */
  dir: 1 | -1;
  /** Asymmetry lobe count (2 or 3). */
  lobes: number;
  /** Current lobe phase (radians); rotates over time and with drag. */
  phase: number;
  /** Lobe-phase rotation speed (radians/sec) before drag-stir. */
  drift: number;
  /** Amplitude of the lobed asymmetry. */
  lobeAmp: number;
  /** Magnitude oscillator frequency / phase. */
  magFreq: number;
  magPhase: number;
  /** Radius oscillator frequency / phase. */
  radFreq: number;
  radPhase: number;
  /** Seconds elapsed since the roll was seeded. */
  t: number;
}

/** A held (or unwinding) swirl centred on the pointer. */
export interface VortexTwist {
  /** Centre in CSS px (follows the pointer while dragging). */
  x: number;
  y: number;
  /** Previous centre, for deriving drag speed in advanceTwist. */
  prevX: number;
  prevY: number;
  /** True while the pointer is down; false the moment it's released. */
  held: boolean;
  /** Envelope 0..1: eases up while held, down once released. */
  strength: number;
  /** Live (oscillator-evolved) magnitude in radians, set by advanceTwist. */
  magNow: number;
  /** Live (oscillator-evolved) radius in px, set by advanceTwist. */
  radNow: number;
  /** Per-press randomized character. */
  roll: TwistRoll;
}

/** A glyph position after warping, with the matching glyph rotation. */
export interface WarpedPoint {
  x: number;
  y: number;
  /** Glyph rotation (radians) to match the swirl; 0 when unwarped. */
  rot: number;
}

/** Seed a fresh held swirl at the press point. `rand` is injectable for tests. */
export function createTwist(x: number, y: number, rand: () => number = Math.random): VortexTwist {
  const roll: TwistRoll = {
    dir: rand() < 0.5 ? -1 : 1,
    lobes: LOBE_CHOICES[Math.min(LOBE_CHOICES.length - 1, Math.floor(rand() * LOBE_CHOICES.length))],
    phase: rand() * Math.PI * 2,
    drift: (rand() * 2 - 1) * 0.9,
    lobeAmp: TWIST_RANDOMNESS * 0.6,
    magFreq: 0.4 + rand() * 0.7,
    magPhase: rand() * Math.PI * 2,
    radFreq: 0.25 + rand() * 0.5,
    radPhase: rand() * Math.PI * 2,
    t: 0,
  };
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    held: true,
    strength: 0,
    magNow: TWIST_STRENGTH,
    radNow: TWIST_RADIUS,
    roll,
  };
}

/** Recentre the swirl so it tracks a drag (drag speed is read by advanceTwist). */
export function moveTwist(twist: VortexTwist, x: number, y: number): void {
  twist.x = x;
  twist.y = y;
}

/**
 * Advance the envelope and evolve the roll by `dt` seconds: ease `strength`
 * toward held?1:0, rotate the lobe phase (faster while dragging), and drift the
 * live magnitude/radius via their oscillators.
 */
export function advanceTwist(twist: VortexTwist, dt: number): void {
  const target = twist.held ? 1 : 0;
  twist.strength += (target - twist.strength) * Math.min(1, dt * ENVELOPE_RATE);

  const { roll } = twist;
  roll.t += dt;

  // Drag speed (px/s) → bounded stir that churns the lobe phase.
  const dx = twist.x - twist.prevX;
  const dy = twist.y - twist.prevY;
  const speed = dt > 0 ? Math.hypot(dx, dy) / dt : 0;
  const stir = Math.min(STIR_MAX, speed / STIR_REFERENCE_SPEED);
  roll.phase += (roll.drift + stir) * dt;
  twist.prevX = twist.x;
  twist.prevY = twist.y;

  // Slow oscillators drift magnitude and radius within the randomness spread.
  twist.magNow = TWIST_STRENGTH * (1 + TWIST_RANDOMNESS * 0.85 * Math.sin(roll.t * roll.magFreq + roll.magPhase));
  twist.radNow = TWIST_RADIUS * (1 + TWIST_RANDOMNESS * 0.5 * Math.sin(roll.t * roll.radFreq + roll.radPhase));
}

/** True once a released swirl has fully unwound and can be dropped. */
export function isSettled(twist: VortexTwist): boolean {
  return !twist.held && twist.strength < 0.01;
}

/**
 * Rotate a glyph at (x, y) around the swirl centre. Rotation is strongest at the
 * centre (Gaussian falloff to `radNow`), scaled by the envelope, and given a
 * lobed asymmetry so the swirl reads as organic. Returns the point unchanged
 * (`rot: 0`) when the swirl is at rest or the point is out of reach.
 */
export function warpPoint(twist: VortexTwist, x: number, y: number): WarpedPoint {
  if (twist.strength < REST_STRENGTH) return { x, y, rot: 0 };
  const dx = x - twist.x;
  const dy = y - twist.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const r = twist.radNow;
  const f = Math.exp(-(dist * dist) / (r * r)) * twist.strength;
  if (f < WARP_EPSILON) return { x, y, rot: 0 };
  const angle = Math.atan2(dy, dx);
  const wob = 1 + twist.roll.lobeAmp * Math.sin(twist.roll.lobes * angle + twist.roll.phase);
  const theta = twist.roll.dir * twist.magNow * f * wob;
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  return {
    x: twist.x + dx * ct - dy * st,
    y: twist.y + dx * st + dy * ct,
    rot: theta,
  };
}
