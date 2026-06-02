/**
 * Pure model for the theme-driven cursor effects. Each theme renders its own
 * desktop cursor (galaxy = comet trail, matrix = blinking terminal block,
 * rainbow = fireworks sparkler). The particle physics for the comet/sparkler
 * trails and the terminal blink phase live here, free of canvas/DOM, so they can
 * be unit-tested deterministically; ThemeCursor.tsx owns the canvas, pointer
 * tracking, and the rAF loop. Sibling of the other effect model, rainbowSmoke.ts.
 */

/** A single glowing trail/spark particle. Positions in CSS px. */
export interface CursorParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  age: number;
  life: number;
}

/** How a particle is seeded: speed/size/lifetime ranges + a hue picker. */
export interface SparkConfig {
  speedMin: number;
  speedMax: number;
  rMin: number;
  rMax: number;
  lifeMin: number;
  lifeMax: number;
  /** Returns a hue (0–360) given the injected rng. */
  hue: (rand: () => number) => number;
}

/** Galaxy comet tail: slow, small, short-lived sparks tinted cyan→violet. */
export const COMET_SPARKS: SparkConfig = {
  speedMin: 6,
  speedMax: 34,
  rMin: 1,
  rMax: 2.6,
  lifeMin: 0.3,
  lifeMax: 0.6,
  hue: (rand) => 190 + rand() * 80, // 190 (cyan) → 270 (violet)
};

/** Rainbow sparkler: fast, tiny, vivid sparks across the whole hue wheel. */
export const SPARKLER_SPARKS: SparkConfig = {
  speedMin: 40,
  speedMax: 170,
  rMin: 0.8,
  rMax: 2.2,
  lifeMin: 0.35,
  lifeMax: 0.85,
  hue: (rand) => rand() * 360,
};

/** Downward acceleration (px/s²) applied to sparkler sparks so they arc and fall. */
export const SPARKLER_GRAVITY = 460;
/** Terminal-block blink period (ms); on for the first half, off for the second. */
export const TERMINAL_BLINK_MS = 1060;

/** Seed one particle at (x, y) from `cfg`. `rand` is injectable for tests. */
export function createParticle(
  x: number,
  y: number,
  cfg: SparkConfig,
  rand: () => number = Math.random,
): CursorParticle {
  const angle = rand() * Math.PI * 2;
  const speed = cfg.speedMin + rand() * (cfg.speedMax - cfg.speedMin);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: cfg.rMin + rand() * (cfg.rMax - cfg.rMin),
    hue: cfg.hue(rand),
    age: 0,
    life: cfg.lifeMin + rand() * (cfg.lifeMax - cfg.lifeMin),
  };
}

/** Step a particle `dt` seconds: age, optional gravity, drift, and damping. */
export function advanceParticle(p: CursorParticle, dt: number, gravity = 0): void {
  p.age += dt;
  p.vy += gravity * dt;
  p.vx *= 0.98;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}

/** Opacity over life: full at birth, linearly to zero at death. */
export function particleAlpha(p: CursorParticle): number {
  return Math.max(0, 1 - p.age / p.life);
}

/** True once a particle has outlived its lifetime. */
export function isDead(p: CursorParticle): boolean {
  return p.age >= p.life;
}

/** Whether the terminal caret is in its visible (on) half of the blink cycle. */
export function blinkOn(timeMs: number, period = TERMINAL_BLINK_MS): boolean {
  return timeMs % period < period / 2;
}
