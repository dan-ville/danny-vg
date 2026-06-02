/**
 * Pure star-field model for the galaxy background. Kept free of canvas/DOM so
 * the drift, twinkle, and density math can be unit-tested deterministically;
 * GalaxyBackground.tsx owns the canvas plumbing and the rAF loop.
 */

export interface Star {
  /** Position in CSS pixels. */
  x: number;
  y: number;
  /** Dot radius in CSS pixels. */
  radius: number;
  /** Average opacity the twinkle oscillates around. */
  baseAlpha: number;
  /** Twinkle angular speed (radians/sec). */
  twinkleSpeed: number;
  /** Current twinkle phase (radians). */
  twinklePhase: number;
  /** Drift velocity in px/sec. */
  driftX: number;
  driftY: number;
  /**
   * Transient impulse velocity (px/sec) layered on top of the constant drift —
   * a gravity-well tap adds to it (see gravityWell.ts) and `advanceStar` damps
   * it back to zero, so the star coasts inward then resettles into its drift.
   * Optional so pre-existing star literals stay valid.
   */
  vx?: number;
  vy?: number;
  /**
   * Extra-inflow stars stream in from beyond the viewport while a well is held.
   * Unlike the persistent field they are NOT wrapped at the edges — once they
   * drift back out they're culled (galaxySim.ts), so density drains to baseline
   * after release. Persistent stars leave this undefined.
   */
  transient?: boolean;
}

const MIN_STARS = 150;
const MAX_STARS = 250;
/** One star per this many CSS px² of viewport, before clamping. */
const PX_PER_STAR = 2600;
/** Per-second decay applied to impulse velocity; ~halves it every ~0.3s. */
const IMPULSE_DAMPING = 2.2;

/** Star count scaled to viewport area and clamped to the 150–250 spec range. */
export function starCount(width: number, height: number): number {
  const byArea = Math.round((width * height) / PX_PER_STAR);
  return Math.max(MIN_STARS, Math.min(MAX_STARS, byArea));
}

/**
 * Build a fresh star field. `rand` is injectable (defaults to Math.random) so
 * tests can feed a deterministic sequence.
 */
export function createStars(
  count: number,
  width: number,
  height: number,
  rand: () => number = Math.random,
): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * width,
      y: rand() * height,
      radius: 0.4 + rand() * 1.1,
      baseAlpha: 0.2 + rand() * 0.7,
      twinkleSpeed: 0.6 + rand() * 1.8,
      twinklePhase: rand() * Math.PI * 2,
      // Gentle, mostly-horizontal drift; slow enough to read as "deep space".
      driftX: (rand() - 0.5) * 6,
      driftY: (rand() - 0.5) * 4,
      vx: 0,
      vy: 0,
    });
  }
  return stars;
}

/** How far (CSS px) beyond a viewport edge an inflow star is born. */
const EDGE_SPAWN_MARGIN = 32;

/**
 * Spawn a transient star just outside a random viewport edge, drifting inward a
 * touch faster than ambient so it reads as streaming in "from beyond". Used for
 * the gravity well's extra inflow (galaxySim.ts). `rand` is injectable for
 * deterministic tests.
 */
export function spawnStarAtEdge(width: number, height: number, rand: () => number = Math.random): Star {
  const edge = Math.floor(rand() * 4); // 0 top, 1 right, 2 bottom, 3 left
  const speed = 22 + rand() * 26; // inward drift speed (px/sec)
  const jitter = (rand() - 0.5) * 10; // slight lateral wander
  let x = 0;
  let y = 0;
  let driftX = 0;
  let driftY = 0;
  switch (edge) {
    case 0: // top edge, heading down
      x = rand() * width;
      y = -EDGE_SPAWN_MARGIN;
      driftX = jitter;
      driftY = speed;
      break;
    case 1: // right edge, heading left
      x = width + EDGE_SPAWN_MARGIN;
      y = rand() * height;
      driftX = -speed;
      driftY = jitter;
      break;
    case 2: // bottom edge, heading up
      x = rand() * width;
      y = height + EDGE_SPAWN_MARGIN;
      driftX = jitter;
      driftY = -speed;
      break;
    default: // left edge, heading right
      x = -EDGE_SPAWN_MARGIN;
      y = rand() * height;
      driftX = speed;
      driftY = jitter;
      break;
  }
  return {
    x,
    y,
    radius: 0.4 + rand() * 1.1,
    baseAlpha: 0.2 + rand() * 0.7,
    twinkleSpeed: 0.6 + rand() * 1.8,
    twinklePhase: rand() * Math.PI * 2,
    driftX,
    driftY,
    vx: 0,
    vy: 0,
    transient: true,
  };
}

/** Mutate a star forward by `dt` seconds, wrapping it across viewport edges. */
export function advanceStar(star: Star, width: number, height: number, dt: number): void {
  const vx = star.vx ?? 0;
  const vy = star.vy ?? 0;
  star.x += (star.driftX + vx) * dt;
  star.y += (star.driftY + vy) * dt;

  // Bleed the impulse off so a well's pull is temporary, not a permanent shove.
  if (vx !== 0 || vy !== 0) {
    const decay = Math.max(0, 1 - IMPULSE_DAMPING * dt);
    star.vx = vx * decay;
    star.vy = vy * decay;
  }

  star.twinklePhase += star.twinkleSpeed * dt;

  // Persistent stars wrap to fill the field forever; transient inflow stars are
  // left to exit so they can be culled once off-screen.
  if (!star.transient) {
    if (star.x < 0) star.x += width;
    else if (star.x > width) star.x -= width;
    if (star.y < 0) star.y += height;
    else if (star.y > height) star.y -= height;
  }
}

/** Current opacity of a star, twinkling between ~0.3× and 1× of its base. */
export function starAlpha(star: Star): number {
  const flicker = 0.65 + 0.35 * Math.sin(star.twinklePhase);
  return Math.max(0, Math.min(1, star.baseAlpha * flicker));
}
