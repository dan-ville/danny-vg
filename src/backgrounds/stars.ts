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
}

const MIN_STARS = 150;
const MAX_STARS = 250;
/** One star per this many CSS px² of viewport, before clamping. */
const PX_PER_STAR = 2600;

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
    });
  }
  return stars;
}

/** Mutate a star forward by `dt` seconds, wrapping it across viewport edges. */
export function advanceStar(star: Star, width: number, height: number, dt: number): void {
  star.x += star.driftX * dt;
  star.y += star.driftY * dt;
  star.twinklePhase += star.twinkleSpeed * dt;

  if (star.x < 0) star.x += width;
  else if (star.x > width) star.x -= width;
  if (star.y < 0) star.y += height;
  else if (star.y > height) star.y -= height;
}

/** Current opacity of a star, twinkling between ~0.3× and 1× of its base. */
export function starAlpha(star: Star): number {
  const flicker = 0.65 + 0.35 * Math.sin(star.twinklePhase);
  return Math.max(0, Math.min(1, star.baseAlpha * flicker));
}
