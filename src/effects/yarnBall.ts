/**
 * Pure model for the kitty theme's yarn-ball cursor. At rest the ball eases
 * toward the pointer (a touch of lag, so it reads as a physical object you're
 * nudging rather than a hard-locked cursor). When the roaming cat pounces and
 * smacks it (see catSprite.ts, wired through kittyLink.ts), it goes airborne:
 * it flies off with the smack velocity, ricochets off all four viewport edges
 * losing a little energy each bounce, spins as it rolls, and once it slows below
 * a threshold it settles and resumes chasing the pointer.
 *
 * Kept free of canvas/DOM so the easing, smack, bounce, damping, and settle math
 * can be unit-tested deterministically; ThemeCursor.tsx owns the canvas, pointer
 * tracking, and the rAF loop. Sibling of cursorTrail.ts / rainbowSmoke.ts.
 */

/** A ball of yarn. Position/velocity in CSS px; `angle` is its roll (radians). */
export interface YarnBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Roll angle, advanced by horizontal travel so the wound stripes spin. */
  angle: number;
  /** True while flying after a smack; false while it's tracking the pointer. */
  airborne: boolean;
  /**
   * Seconds left in the post-smack window during which moving the pointer does
   * NOT reclaim the ball — so a hit always gets to fling clear before the cursor
   * snatches it back. Counts down in {@link advanceYarn}.
   */
  launchGrace: number;
}

/** Drawn radius of the ball (CSS px); also the edge inset used for bouncing. */
export const YARN_RADIUS = 13;
/** Fraction of the gap to the pointer the ball closes each frame at rest. */
export const FOLLOW_EASE = 0.34;
/** Speed kept after a wall bounce (0 = dead stop, 1 = perfectly elastic). */
export const WALL_RESTITUTION = 0.82;
/** Exponential air-drag rate (per second) bleeding speed off an airborne ball. */
export const AIR_DRAG = 0.95;
/** Below this speed (px/s) a flying ball settles and goes back to the pointer. */
export const SETTLE_SPEED = 70;
/** Smack speed (px/s) the cat imparts — a hard hit that ricochets many times. */
export const SMACK_SPEED = 1700;
/** Window (s) after a smack where pointer movement can't reclaim the ball. */
export const SMACK_GRACE = 0.4;

/** A fresh ball at rest under the pointer. */
export function createYarn(x: number, y: number): YarnBall {
  return { x, y, vx: 0, vy: 0, angle: 0, airborne: false, launchGrace: 0 };
}

/**
 * Ease a resting ball toward the pointer and roll it by how far it moved, so it
 * trails the cursor with a little weight and spins in the travel direction.
 */
export function followPointer(yarn: YarnBall, targetX: number, targetY: number, ease = FOLLOW_EASE): void {
  const nx = yarn.x + (targetX - yarn.x) * ease;
  const ny = yarn.y + (targetY - yarn.y) * ease;
  yarn.angle += (nx - yarn.x) / YARN_RADIUS; // roll by horizontal travel
  yarn.x = nx;
  yarn.y = ny;
  yarn.vx = 0;
  yarn.vy = 0;
}

/** Launch the ball: take the smack velocity, go airborne, open the grace window. */
export function smackYarn(yarn: YarnBall, vx: number, vy: number): void {
  yarn.vx = vx;
  yarn.vy = vy;
  yarn.airborne = true;
  yarn.launchGrace = SMACK_GRACE;
}

/**
 * Step an airborne ball `dt` seconds: drag, integrate, bounce off the four
 * walls (reflect + lose `WALL_RESTITUTION`), roll by horizontal travel, and
 * settle (clear `airborne`) once it crawls below `SETTLE_SPEED`. No-op while the
 * ball is at rest — the cursor drives it via {@link followPointer} then.
 */
export function advanceYarn(yarn: YarnBall, dt: number, width: number, height: number): void {
  if (!yarn.airborne) return;

  if (yarn.launchGrace > 0) yarn.launchGrace = Math.max(0, yarn.launchGrace - dt);

  const drag = Math.exp(-AIR_DRAG * dt);
  yarn.vx *= drag;
  yarn.vy *= drag;

  const prevX = yarn.x;
  yarn.x += yarn.vx * dt;
  yarn.y += yarn.vy * dt;

  // Reflect off each wall, clamping back inside so it can't tunnel out.
  const minX = YARN_RADIUS;
  const maxX = Math.max(minX, width - YARN_RADIUS);
  const minY = YARN_RADIUS;
  const maxY = Math.max(minY, height - YARN_RADIUS);
  if (yarn.x < minX) {
    yarn.x = minX;
    yarn.vx = Math.abs(yarn.vx) * WALL_RESTITUTION;
  } else if (yarn.x > maxX) {
    yarn.x = maxX;
    yarn.vx = -Math.abs(yarn.vx) * WALL_RESTITUTION;
  }
  if (yarn.y < minY) {
    yarn.y = minY;
    yarn.vy = Math.abs(yarn.vy) * WALL_RESTITUTION;
  } else if (yarn.y > maxY) {
    yarn.y = maxY;
    yarn.vy = -Math.abs(yarn.vy) * WALL_RESTITUTION;
  }

  yarn.angle += (yarn.x - prevX) / YARN_RADIUS; // spin while it rolls/flies

  if (Math.hypot(yarn.vx, yarn.vy) < SETTLE_SPEED) {
    yarn.airborne = false;
    yarn.vx = 0;
    yarn.vy = 0;
  }
}
