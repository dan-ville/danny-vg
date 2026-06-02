/**
 * One frame of the galaxy star-field simulation under an optional gravity well.
 * Pure (no canvas/DOM) so the consume/recycle/inflow/cull bookkeeping can be
 * unit-tested deterministically; GalaxyBackground.tsx calls this each rAF tick
 * and then draws the returned stars.
 *
 * Density management — the whole point of which is to stay cheap:
 * - The persistent field keeps a CONSTANT count. A persistent star consumed at
 *   the well's core is recycled (repositioned to an edge, streaming back in),
 *   never deleted — so a long hold pulls an endless stream at zero net cost.
 * - "Extra inflow" while held is a BOUNDED budget of transient stars that ramp
 *   in from the edges; consumed transients are deleted (not recycled) and any
 *   that drift off-screen are culled, so density drains back to baseline once
 *   the well releases. A hard cap keeps the work per frame bounded.
 */

import { advanceStar, spawnStarAtEdge, starCount, type Star } from './stars';
import { applyWell, isConsumed, type Well } from './gravityWell';

/** Peak extra density while held, as a fraction of the baseline field count. */
export const HELD_EXTRA_FRAC = 0.6;
/** Seconds of holding to ramp the extra inflow from zero to its full budget. */
export const INFLOW_FILL_SECONDS = 2.5;
/** Margin (CSS px) a transient must clear beyond an edge before it's culled. */
const CULL_MARGIN = 48;

/** Reposition a consumed persistent star to an edge so it streams back in. */
function recycleToEdge(star: Star, width: number, height: number, rand: () => number): void {
  const fresh = spawnStarAtEdge(width, height, rand);
  star.x = fresh.x;
  star.y = fresh.y;
  star.driftX = fresh.driftX;
  star.driftY = fresh.driftY;
  star.vx = 0;
  star.vy = 0;
  // Keeps its persistent identity (transient stays falsy) and twinkle/size.
}

/** True once a transient star has fully cleared the viewport and can be dropped. */
function isOffscreen(star: Star, width: number, height: number): boolean {
  return (
    star.x < -CULL_MARGIN ||
    star.x > width + CULL_MARGIN ||
    star.y < -CULL_MARGIN ||
    star.y > height + CULL_MARGIN
  );
}

/**
 * Advance the field one frame and return the surviving stars. `well` is null
 * when nothing is being held. `rand` is injectable for deterministic tests.
 */
export function updateStarField(
  stars: Star[],
  well: Well | null,
  dt: number,
  width: number,
  height: number,
  rand: () => number = Math.random,
): Star[] {
  if (well && well.held) well.heldFor += dt;

  // Pull toward the well, then integrate every star's motion.
  if (well) for (const star of stars) applyWell(star, well, dt);
  for (const star of stars) advanceStar(star, width, height, dt);

  // Consume at the core (recycle persistent, delete transient) and cull drained
  // transients that have wandered off-screen.
  const survivors: Star[] = [];
  for (const star of stars) {
    if (well && isConsumed(star, well)) {
      if (star.transient) continue; // eaten — gone for good
      recycleToEdge(star, width, height, rand); // persistent — stream it back in
      survivors.push(star);
      continue;
    }
    if (star.transient && isOffscreen(star, width, height)) continue; // drained
    survivors.push(star);
  }

  // Extra inflow while held: top up transient stars toward a hold-ramped target,
  // capped so the per-frame star count stays bounded.
  if (well && well.held) {
    const extraCap = Math.round(starCount(width, height) * HELD_EXTRA_FRAC);
    const desired = Math.min(extraCap, Math.floor((extraCap * well.heldFor) / INFLOW_FILL_SECONDS));
    let transientCount = 0;
    for (const star of survivors) if (star.transient) transientCount++;
    for (let i = transientCount; i < desired; i++) survivors.push(spawnStarAtEdge(width, height, rand));
  }

  return survivors;
}
