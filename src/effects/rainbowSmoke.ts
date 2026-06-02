/**
 * Pure model for the rainbow theme's "smoke bomb" tap effect: press/hold spawns
 * rising, billowing puffs of colored smoke, and the hue sweeps continuously
 * while held so a drag paints a rainbow plume. Kept free of canvas/DOM so the
 * particle physics and palette math can be unit-tested deterministically;
 * RainbowSmoke.tsx owns the canvas, pointer listeners, and the rAF loop. Sibling
 * of `ripples.ts` (the model behind the other overlay effect).
 */

/** A single smoke puff. Positions/sizes are in CSS px; angles in radians. */
export interface SmokeParticle {
  x: number;
  y: number;
  /** Current radius; grows as the puff billows outward. */
  r: number;
  vx: number;
  vy: number;
  /** Hue (0–360) this puff was emitted at. */
  hue: number;
  /** Seconds since emission. */
  age: number;
  /** Total lifetime in seconds. */
  life: number;
  /** Phase offset so each puff sways independently. */
  sway: number;
  /** Horizontal sway acceleration amplitude. */
  swayAmp: number;
}

/** Degrees/second the emission hue sweeps while the pointer is held. */
export const SMOKE_HUE_RATE = 90;
/** Hard cap on live particles, so a long drag can't unbound the array. */
export const SMOKE_MAX = 280;
/** Puffs spawned on a fresh press (a visible initial burst). */
export const SMOKE_BURST = 7;
/** Puffs spawned per frame while the pointer stays held (the plume). */
export const SMOKE_STREAM = 2;

/** Rise speed (px/s, negative = up) the launch eases toward after the kick. */
const RISE_TERMINAL = -32;
/** Per-second rate vy eases toward {@link RISE_TERMINAL}. */
const RISE_EASE = 0.6;
/** Radius growth in px/s (how fast a puff billows). */
const BILLOW = 62;
/** Sway oscillation frequency (rad/s). */
const SWAY_FREQ = 1.6;
/** Per-frame horizontal damping so sway doesn't run away. */
const VX_DAMP = 0.985;
/** Peak opacity at the middle of a puff's life. */
const ALPHA_PEAK = 0.42;

/** Advance the emission hue while held; wraps at 360. */
export function rotateHue(hue: number, dt: number): number {
  return (hue + dt * SMOKE_HUE_RATE) % 360;
}

/** Emit one puff at (x, y) around `hue`. `rand` is injectable for tests. */
export function createParticle(
  x: number,
  y: number,
  hue: number,
  rand: () => number = Math.random,
): SmokeParticle {
  return {
    x: x + (rand() * 2 - 1) * 10,
    y: y + (rand() * 2 - 1) * 10,
    r: 14 + rand() * 18,
    vx: (rand() * 2 - 1) * 30,
    vy: -95 - rand() * 75, // strong upward launch
    hue: (((hue + (rand() * 2 - 1) * 12) % 360) + 360) % 360,
    age: 0,
    life: 2.6 + rand() * 1.8,
    sway: rand() * Math.PI * 2,
    swayAmp: 24 + rand() * 32,
  };
}

/** Step one puff forward `dt` seconds: rise (easing), sway, drift, and billow. */
export function advanceParticle(p: SmokeParticle, dt: number): void {
  p.age += dt;
  p.vy += (RISE_TERMINAL - p.vy) * Math.min(1, dt * RISE_EASE);
  p.vx += Math.sin(p.age * SWAY_FREQ + p.sway) * p.swayAmp * dt;
  p.vx *= VX_DAMP;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.r += BILLOW * dt;
}

/** Opacity over the puff's life: fades in, peaks mid-life, fades out. */
export function particleAlpha(p: SmokeParticle): number {
  const t = Math.min(1, p.age / p.life);
  return Math.sin(t * Math.PI) * ALPHA_PEAK;
}

/** True once a puff has outlived its lifetime and can be culled. */
export function isDead(p: SmokeParticle): boolean {
  return p.age >= p.life;
}
