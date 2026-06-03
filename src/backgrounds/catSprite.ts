/**
 * Pure model for the kitty theme's roaming cat. The cat wanders the playground
 * on its own — picking random spots, padding over to them, pausing, repeating —
 * until the user clicks: then it crouches and pounces at the yarn-ball cursor.
 *
 * The pounce is a discrete ballistic *hop*, not continuous homing: it leaps to a
 * fixed spot (where the yarn was at take-off) and only re-aims when it lands. If
 * the yarn has moved, the cat hops again off the ground toward the new spot —
 * so it never curves through the air like it's flying, but it keeps chasing a
 * fleeing yarn for as long as you tease it (a still yarn it just lands on and
 * catches). Take-off and every landing emit an impact (a dust burst the
 * component renders). On a landing within paw reach it catches the yarn and
 * swings a mallet (the `hit` state), flinging the ball at the impact frame
 * before recovering.
 *
 * The pounce is the kitty theme's tap interaction, so — like the galaxy gravity
 * well and matrix vortex — it lives in the background (KittyBackground.tsx),
 * which owns the canvas, pointer listeners, and rAF loop and bridges to the yarn
 * cursor through kittyLink.ts. This file is just the state machine + motion math,
 * free of canvas/DOM so it can be unit-tested deterministically.
 */

/** The cat's behaviour states, in their natural progression. */
export type CatState = 'roam' | 'crouch' | 'pounce' | 'hit' | 'recover';

export interface Cat {
  /** Body centre in CSS px. */
  x: number;
  y: number;
  /** Velocity in px/s (drives motion + facing). */
  vx: number;
  vy: number;
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
  state: CatState;
  /** Seconds elapsed in the current state. */
  stateTime: number;
  /** Fixed destination of the current hop / wander leg in CSS px. */
  targetX: number;
  targetY: number;
  /** Live yarn position the cat re-aims at when it lands a hop. */
  aimX: number;
  aimY: number;
  /** Seconds left to sit still at a reached wander spot before picking the next. */
  wait: number;
  /** Seconds accumulated for the cyclic walk/idle frames; frozen when roam is off. */
  phase: number;
  /** Distance of the current hop at launch — drives the leap arc in drawing. */
  leapDist0: number;
  /** Smack velocity held during the `hit` swing, flung at the impact frame. */
  hitVx: number;
  hitVy: number;
}

/** What a single {@link advanceCat} step reports back to the caller. */
export interface CatStep {
  /** Set on the frame a pounce connects: the velocity to fling the yarn with. */
  smack: { vx: number; vy: number } | null;
  /** Ground points where an impact burst should spawn this frame (take-off / landings). */
  impacts: { x: number; y: number }[];
}

/** Padding from the viewport edges the cat keeps when choosing a wander spot. */
export const ROAM_MARGIN = 56;
/** Walking speed while roaming (px/s). */
export const ROAM_SPEED = 74;
/** Within this distance (px) a wander spot counts as reached. */
export const ROAM_REACH = 8;
/** Wind-up before the leap (s). */
export const CROUCH_TIME = 0.16;
/** Sit-and-recover pause after landing (s). */
export const RECOVER_TIME = 0.45;
/** Leap speed of a hop (px/s) — fast enough to cross the page in a beat. */
export const POUNCE_SPEED = 1250;
/** Paw reach: the yarn is smacked if a hop lands within this distance (px). */
export const POUNCE_HIT_RADIUS = 34;
/** Speed (px/s) the smacked yarn is launched at — a hard, fast hit. */
export const SMACK_SPEED = 1700;
/** Length of the mallet-whack `hit` animation after a catch (s). */
export const HIT_TIME = 0.75;
/** When in the swing the mallet connects — the frame the yarn is flung (s). */
export const HIT_IMPACT_TIME = 0.42;
/** Min / max seconds the cat dawdles at a reached wander spot. */
export const WAIT_MIN = 0.5;
export const WAIT_MAX = 1.9;

/** Smaller viewport dimension the cat's base size + speeds are tuned for (px) —
 * a laptop-class screen (≈720p). At or above this the cat is full size. */
const REFERENCE_MIN_SIDE = 720;
/** Floor the viewport scale can't shrink past, so the cat stays visible. */
const MIN_VIEW_SCALE = 0.5;

/**
 * Size/speed multiplier for the current viewport. The art and motion are tuned
 * for a roomy desktop; on a small phone the same px sizes make the cat dominate
 * the screen and rocket across it. We scale off the *smaller* viewport side so a
 * short landscape phone shrinks the cat just like a narrow portrait one.
 * Shrinking size *and* speed together keeps its visual pace (body-lengths per
 * second) constant — a small cat that still pads and pounces at a natural rate.
 * Clamped to [MIN, 1].
 */
export function viewScale(width: number, height: number = Infinity): number {
  return Math.min(1, Math.max(MIN_VIEW_SCALE, Math.min(width, height) / REFERENCE_MIN_SIDE));
}

const NO_IMPACT: { x: number; y: number }[] = [];
const NO_STEP: CatStep = { smack: null, impacts: NO_IMPACT };

/** No mallet offset — body centre is the strike point (default / pure tests). */
const NO_REACH = { x: 0, y: 0 };

/**
 * Where the cat must *land* so its mallet head — which falls at
 * `body + facing*reach` — comes down on the yarn at `aim`, rather than its body
 * centre. Returns that landing spot and the facing it implies (toward the yarn).
 * With a zero reach this is just the yarn itself, preserving the old centred
 * behaviour for callers/tests that don't pass a reach.
 */
function strikeTarget(
  cat: Cat,
  reach: { x: number; y: number },
): { facing: 1 | -1; x: number; y: number } {
  const facing: 1 | -1 = cat.aimX >= cat.x ? 1 : -1;
  return { facing, x: cat.aimX - facing * reach.x, y: cat.aimY - reach.y };
}

/** Pick a random wander spot inside the margins for the given viewport. */
export function pickRoamTarget(
  width: number,
  height: number,
  rand: () => number = Math.random,
): { x: number; y: number } {
  const x = ROAM_MARGIN + rand() * Math.max(0, width - 2 * ROAM_MARGIN);
  // Bias toward the lower half so the cat reads as padding along the "floor".
  const top = height * 0.32;
  const y = top + rand() * Math.max(0, height - top - ROAM_MARGIN);
  return { x, y };
}

/** Spawn a roaming cat at a random wander spot. */
export function createCat(width: number, height: number, rand: () => number = Math.random): Cat {
  const start = pickRoamTarget(width, height, rand);
  const next = pickRoamTarget(width, height, rand);
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    facing: 1,
    state: 'roam',
    stateTime: 0,
    targetX: next.x,
    targetY: next.y,
    aimX: start.x,
    aimY: start.y,
    wait: 0,
    phase: 0,
    leapDist0: 0,
    hitVx: 0,
    hitVy: 0,
  };
}

/**
 * Begin a pounce at (tx, ty). Ignored unless the cat is calmly roaming or
 * recovering — a hop already in flight isn't interrupted. Seeds both the leap
 * target and the live aim, snaps facing, and enters the crouch wind-up.
 */
export function startPounce(cat: Cat, tx: number, ty: number): void {
  if (cat.state !== 'roam' && cat.state !== 'recover') return;
  cat.targetX = tx;
  cat.targetY = ty;
  cat.aimX = tx;
  cat.aimY = ty;
  cat.facing = tx >= cat.x ? 1 : -1;
  cat.state = 'crouch';
  cat.stateTime = 0;
  cat.vx = 0;
  cat.vy = 0;
}

/** Update facing from horizontal velocity (kept steady while near-stationary). */
function faceByVelocity(cat: Cat): void {
  if (cat.vx > 1) cat.facing = 1;
  else if (cat.vx < -1) cat.facing = -1;
}

/**
 * Advance the cat `dt` seconds through its state machine, reporting any smack
 * and any impact bursts produced this frame.
 *
 * - **roam** — dawdle at the current spot while `wait` runs down, then pad
 *   toward the wander target; on arrival pick a new spot and a new pause.
 *   Skipped when `opts.roam` is false (reduced motion) — the cat just sits.
 * - **crouch** — track the yarn while winding up for {@link CROUCH_TIME}, then
 *   launch a hop toward where it is now (emitting a take-off impact).
 * - **pounce** — travel a straight ballistic line to the *fixed* hop target at
 *   {@link POUNCE_SPEED}. On landing (emitting an impact): if the yarn is within
 *   {@link POUNCE_HIT_RADIUS}, catch it and enter `hit`; else hop again toward the
 *   yarn's new spot — so it changes trajectory only on the ground, but keeps
 *   chasing.
 * - **hit** — a {@link HIT_TIME} mallet whack; the yarn is flung at
 *   {@link HIT_IMPACT_TIME} (the swing's impact frame), then it drops to recover.
 * - **recover** — sit for {@link RECOVER_TIME}, then resume roaming.
 */
export function advanceCat(
  cat: Cat,
  dt: number,
  width: number,
  height: number,
  opts: {
    roam?: boolean;
    rand?: () => number;
    hammerReach?: { x: number; y: number };
    /** Viewport scale (see {@link viewScale}) — shrinks speeds + reach to match
     * a smaller on-screen cat. Defaults to 1 (desktop / pure tests). */
    scale?: number;
  } = {},
): CatStep {
  const { roam = true, rand = Math.random, hammerReach: reach = NO_REACH, scale = 1 } = opts;
  // Scale travel + catch distances with the cat's on-screen size so its motion
  // reads the same on every viewport (see viewScale).
  const roamSpeed = ROAM_SPEED * scale;
  const pounceSpeed = POUNCE_SPEED * scale;
  const smackSpeed = SMACK_SPEED * scale;
  const hitRadius = POUNCE_HIT_RADIUS * scale;
  cat.stateTime += dt;
  // `phase` drives the cyclic walk/idle frames; freeze it when roaming is off
  // (reduced motion) so the cat holds still rather than idle-bobbing. The pounce
  // animation is scrubbed by leap progress, not phase, so it still plays.
  if (roam) cat.phase += dt;

  switch (cat.state) {
    case 'roam': {
      if (!roam) {
        cat.vx = 0;
        cat.vy = 0;
        return NO_STEP;
      }
      if (cat.wait > 0) {
        cat.wait -= dt;
        cat.vx = 0;
        cat.vy = 0;
        return NO_STEP;
      }
      const dx = cat.targetX - cat.x;
      const dy = cat.targetY - cat.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= ROAM_REACH) {
        const next = pickRoamTarget(width, height, rand);
        cat.targetX = next.x;
        cat.targetY = next.y;
        cat.wait = WAIT_MIN + rand() * (WAIT_MAX - WAIT_MIN);
        cat.vx = 0;
        cat.vy = 0;
        return NO_STEP;
      }
      const step = Math.min(dist, roamSpeed * dt);
      cat.vx = (dx / dist) * roamSpeed;
      cat.vy = (dy / dist) * roamSpeed;
      cat.x += (dx / dist) * step;
      cat.y += (dy / dist) * step;
      faceByVelocity(cat);
      return NO_STEP;
    }

    case 'crouch': {
      cat.vx = 0;
      cat.vy = 0;
      // Track the yarn while winding up, but aim the hop a mallet's-reach to the
      // side so the hammer arc — not the body — comes down on the ball.
      const t = strikeTarget(cat, reach);
      cat.facing = t.facing;
      cat.targetX = t.x;
      cat.targetY = t.y;
      if (cat.stateTime >= CROUCH_TIME) {
        cat.leapDist0 = Math.hypot(cat.targetX - cat.x, cat.targetY - cat.y);
        cat.state = 'pounce';
        cat.stateTime = 0;
        return { smack: null, impacts: [{ x: cat.x, y: cat.y }] }; // take-off burst
      }
      return NO_STEP;
    }

    case 'pounce': {
      // Straight ballistic travel to the FIXED hop target — no mid-air homing.
      const dx = cat.targetX - cat.x;
      const dy = cat.targetY - cat.y;
      const dist = Math.hypot(dx, dy);
      cat.facing = dx >= 0 ? 1 : -1;
      const step = pounceSpeed * dt;

      if (step < dist) {
        const inv = 1 / dist;
        cat.vx = dx * inv * pounceSpeed;
        cat.vy = dy * inv * pounceSpeed;
        cat.x += dx * inv * step;
        cat.y += dy * inv * step;
        return NO_STEP;
      }

      // Reached the hop target this frame — land.
      cat.x = cat.targetX;
      cat.y = cat.targetY;
      cat.vx = 0;
      cat.vy = 0;
      const impacts = [{ x: cat.x, y: cat.y }];

      // Catch on the *hammer-impact point* (body + facing*reach), not the body —
      // the cat lands beside the yarn so the mallet, not the cat, hits the ball.
      const hx = cat.x + cat.facing * reach.x;
      const hy = cat.y + reach.y;
      const adist = Math.hypot(cat.aimX - hx, cat.aimY - hy);
      if (adist <= hitRadius) {
        // Caught it: stash the fling velocity (along the swing) and play the
        // mallet whack. The yarn isn't launched yet — that happens at the
        // swing's impact frame.
        cat.hitVx = cat.facing * smackSpeed;
        cat.hitVy = 0;
        cat.state = 'hit';
        cat.stateTime = 0;
        return { smack: null, impacts };
      }

      // Hammer fell short of the yarn — re-hop to a fresh strike spot beside its
      // new position and keep chasing.
      const t = strikeTarget(cat, reach);
      cat.facing = t.facing;
      cat.targetX = t.x;
      cat.targetY = t.y;
      cat.leapDist0 = Math.hypot(cat.targetX - cat.x, cat.targetY - cat.y);
      cat.stateTime = 0;
      return { smack: null, impacts };
    }

    case 'hit': {
      // A landed pounce became a mallet swing. Hold still facing the ball, fling
      // it on the single frame the mallet connects, then drop into recover.
      cat.vx = 0;
      cat.vy = 0;
      cat.facing = cat.aimX >= cat.x ? 1 : -1;
      const justConnected =
        cat.stateTime >= HIT_IMPACT_TIME && cat.stateTime - dt < HIT_IMPACT_TIME;
      if (cat.stateTime >= HIT_TIME) {
        cat.state = 'recover';
        cat.stateTime = 0;
      }
      if (justConnected) {
        return { smack: { vx: cat.hitVx, vy: cat.hitVy }, impacts: [{ x: cat.x, y: cat.y }] };
      }
      return NO_STEP;
    }

    case 'recover': {
      cat.vx = 0;
      cat.vy = 0;
      if (cat.stateTime >= RECOVER_TIME) {
        const next = pickRoamTarget(width, height, rand);
        cat.targetX = next.x;
        cat.targetY = next.y;
        cat.wait = WAIT_MIN + rand() * (WAIT_MAX - WAIT_MIN);
        cat.state = 'roam';
        cat.stateTime = 0;
      }
      return NO_STEP;
    }
  }
}
