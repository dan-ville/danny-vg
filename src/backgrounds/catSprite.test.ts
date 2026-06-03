import { describe, it, expect } from 'vitest';
import {
  createCat,
  pickRoamTarget,
  startPounce,
  advanceCat,
  ROAM_MARGIN,
  CROUCH_TIME,
  RECOVER_TIME,
  SMACK_SPEED,
  HIT_TIME,
  HIT_IMPACT_TIME,
  viewScale,
} from './catSprite';

const W = 800;
const H = 600;

describe('pickRoamTarget', () => {
  it('keeps the spot inside the horizontal margins', () => {
    const left = pickRoamTarget(W, H, () => 0);
    const right = pickRoamTarget(W, H, () => 1);
    expect(left.x).toBeCloseTo(ROAM_MARGIN);
    expect(right.x).toBeCloseTo(W - ROAM_MARGIN);
  });

  it('biases vertically toward the lower floor area', () => {
    const top = pickRoamTarget(W, H, () => 0);
    expect(top.y).toBeCloseTo(H * 0.32); // never up at the very top
    const bottom = pickRoamTarget(W, H, () => 1);
    expect(bottom.y).toBeLessThanOrEqual(H - ROAM_MARGIN + 0.001);
  });
});

describe('viewScale', () => {
  it('is 1 on a laptop-class screen and shrinks toward a floor on a phone', () => {
    expect(viewScale(1280, 800)).toBe(1); // roomy desktop
    expect(viewScale(720, 1280)).toBe(1); // exactly the reference min side
    expect(viewScale(390, 844)).toBeCloseTo(0.5417); // portrait phone → 390/720
    expect(viewScale(300, 844)).toBe(0.5); // very narrow → clamped to the floor
    expect(viewScale(540, 1200)).toBeCloseTo(0.75); // 540/720, between floor and 1
  });

  it('scales off the smaller side, so a short landscape phone shrinks too', () => {
    expect(viewScale(844, 390)).toBeCloseTo(0.5417); // landscape phone — height is the tight side
    expect(viewScale(600, 1000)).toBe(viewScale(1000, 600)); // orientation-agnostic
  });
});

describe('advanceCat — viewport scale', () => {
  it('slows roaming proportionally on a smaller viewport', () => {
    const mk = () => {
      const cat = createCat(W, H, () => 0.5);
      cat.x = 100;
      cat.y = 300;
      cat.targetX = 700; // far enough that a step never reaches it
      cat.targetY = 300;
      cat.wait = 0;
      return cat;
    };
    const full = mk();
    advanceCat(full, 0.1, W, H, { rand: () => 0.5, scale: 1 });
    const half = mk();
    advanceCat(half, 0.1, W, H, { rand: () => 0.5, scale: 0.5 });
    expect(half.x - 100).toBeCloseTo((full.x - 100) * 0.5);
  });

  it('scales the smack launch velocity with the cat size', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.x = 100;
    cat.y = 300;
    cat.state = 'pounce';
    cat.stateTime = 0;
    cat.targetX = 125; // a short hop landing dead-on the yarn
    cat.targetY = 300;
    cat.aimX = 125;
    cat.aimY = 300;
    advanceCat(cat, 0.05, W, H, { scale: 0.5 }); // 31px step closes the 25px gap → catch
    expect(cat.state).toBe('hit');
    advanceCat(cat, HIT_IMPACT_TIME - 0.06, W, H, { scale: 0.5 });
    const hit = advanceCat(cat, 0.06, W, H, { scale: 0.5 }); // frame the mallet connects
    expect(hit.smack!.vx).toBeCloseTo(SMACK_SPEED * 0.5); // launch halved with the cat
  });
});

describe('createCat', () => {
  it('spawns a roaming cat inside the viewport', () => {
    const cat = createCat(W, H, () => 0.5);
    expect(cat.state).toBe('roam');
    expect(cat.x).toBeGreaterThanOrEqual(ROAM_MARGIN);
    expect(cat.x).toBeLessThanOrEqual(W - ROAM_MARGIN);
  });
});

describe('startPounce', () => {
  it('crouches and faces the target when roaming', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.x = 100;
    startPounce(cat, 400, 200);
    expect(cat.state).toBe('crouch');
    expect(cat.targetX).toBe(400);
    expect(cat.facing).toBe(1); // target is to the right
  });

  it('faces left for a target on the left', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.x = 400;
    startPounce(cat, 50, 200);
    expect(cat.facing).toBe(-1);
  });

  it('does not interrupt a pounce already in flight', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.state = 'pounce';
    startPounce(cat, 10, 10);
    expect(cat.state).toBe('pounce'); // unchanged
  });
});

describe('advanceCat — roam', () => {
  it('pads toward its wander target', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.wait = 0;
    cat.x = 100;
    cat.y = 300;
    cat.targetX = 400;
    cat.targetY = 300;
    advanceCat(cat, 0.1, W, H, { rand: () => 0.5 });
    expect(cat.x).toBeGreaterThan(100); // moved toward the target
    expect(cat.facing).toBe(1);
  });

  it('holds still while a wander pause is running down', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.wait = 1;
    cat.x = 100;
    cat.targetX = 400;
    advanceCat(cat, 0.1, W, H, { rand: () => 0.5 });
    expect(cat.x).toBe(100); // dawdling, not moving
    expect(cat.wait).toBeCloseTo(0.9);
  });

  it('sits still when roaming is disabled (reduced motion)', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.wait = 0;
    cat.x = 100;
    cat.targetX = 400;
    advanceCat(cat, 0.1, W, H, { roam: false, rand: () => 0.5 });
    expect(cat.x).toBe(100);
    expect(cat.vx).toBe(0);
  });
});

describe('advanceCat — pounce lifecycle', () => {
  it('launches the leap after the crouch wind-up, recording the launch distance', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.x = 100;
    cat.y = 300;
    startPounce(cat, 400, 300);
    const step = advanceCat(cat, CROUCH_TIME + 0.01, W, H);
    expect(cat.state).toBe('pounce');
    expect(step.smack).toBeNull();
    expect(cat.leapDist0).toBeCloseTo(300); // 400 - 100
  });

  it('emits a take-off burst when the crouch launches the leap', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.x = 100;
    cat.y = 300;
    startPounce(cat, 400, 300);
    const step = advanceCat(cat, CROUCH_TIME + 0.01, W, H);
    expect(cat.state).toBe('pounce');
    expect(step.impacts).toEqual([{ x: 100, y: 300 }]); // dust at the take-off spot
  });

  it('catches the yarn on contact, then swings the mallet to fling it', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.x = 100;
    cat.y = 300;
    cat.state = 'pounce';
    cat.stateTime = 0;
    cat.targetX = 125; // a short hop to the right...
    cat.targetY = 300;
    cat.aimX = 125; // ...landing dead-on the yarn
    cat.aimY = 300;
    const land = advanceCat(cat, 0.05, W, H); // 62.5px step closes the 25px gap → lands
    expect(cat.state).toBe('hit'); // caught it — now the mallet swing
    expect(land.smack).toBeNull(); // not flung yet
    expect(land.impacts.length).toBeGreaterThan(0); // landing burst

    // Step up to just before the mallet connects — still no fling.
    const before = advanceCat(cat, HIT_IMPACT_TIME - 0.06, W, H);
    expect(before.smack).toBeNull();
    // The frame the mallet connects flings the yarn along the leap heading.
    const hit = advanceCat(cat, 0.06, W, H);
    expect(hit.smack).not.toBeNull();
    expect(hit.smack!.vx).toBeCloseTo(SMACK_SPEED); // straight right
    expect(hit.smack!.vy).toBeCloseTo(0);
    expect(hit.impacts.length).toBeGreaterThan(0); // impact burst at the whack

    // After the swing finishes it drops into recover.
    advanceCat(cat, HIT_TIME, W, H);
    expect(cat.state).toBe('recover');
  });

  it('lands a mallet-reach beside the yarn so the hammer — not the body — hits it', () => {
    const reach = { x: 138, y: 15 };
    const cat = createCat(W, H, () => 0.5);
    cat.x = 100;
    cat.y = 300;
    startPounce(cat, 500, 300); // yarn straight to the right
    // The wind-up aims the hop at a spot a mallet-reach short of the yarn.
    advanceCat(cat, CROUCH_TIME + 0.01, W, H, { hammerReach: reach });
    expect(cat.state).toBe('pounce');
    expect(cat.targetX).toBeCloseTo(500 - reach.x); // 362 — beside the ball
    expect(cat.targetY).toBeCloseTo(300 - reach.y); // 285
    // Long enough to land the hop at that spot.
    const land = advanceCat(cat, 0.3, W, H, { hammerReach: reach });
    expect(cat.x).toBeCloseTo(500 - reach.x, 0); // body stops beside the yarn...
    expect(cat.state).toBe('hit'); // ...but the hammer point reached it → caught
    expect(land.smack).toBeNull(); // flung later, on the impact frame
  });

  it('re-hops to a fresh strike spot beside the yarn when the hammer falls short', () => {
    const reach = { x: 138, y: 15 };
    const cat = createCat(W, H, () => 0.5);
    cat.x = 100;
    cat.y = 300;
    cat.state = 'pounce';
    cat.stateTime = 0;
    cat.targetX = 125;
    cat.targetY = 300;
    cat.aimX = 600; // yarn well beyond the hammer's reach from the landing
    cat.aimY = 300;
    const step = advanceCat(cat, 0.05, W, H, { hammerReach: reach }); // lands at 125
    expect(step.smack).toBeNull(); // hammer point (125+138=263) still short of 600
    expect(cat.state).toBe('pounce'); // hops again rather than catching
    expect(cat.targetX).toBeCloseTo(600 - reach.x); // re-aimed a reach short of the yarn
  });

  it('travels to the fixed hop target, ignoring the yarn moving mid-flight', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.x = 100;
    cat.y = 300;
    cat.state = 'pounce';
    cat.stateTime = 0;
    cat.targetX = 300; // fixed hop target straight to the right
    cat.targetY = 300;
    cat.aimX = 300;
    cat.aimY = 300;
    advanceCat(cat, 0.05, W, H); // partial travel — doesn't reach the target
    expect(cat.state).toBe('pounce'); // still in flight
    // The yarn jumps far behind and above the cat mid-leap...
    cat.aimX = 100;
    cat.aimY = 50;
    advanceCat(cat, 0.05, W, H);
    expect(cat.vx).toBeGreaterThan(0); // ...still heading right toward the FIXED target
    expect(cat.y).toBeCloseTo(300); // straight line, not curving toward the moved yarn
  });

  it('re-aims with a fresh hop on landing when the yarn slipped out of reach', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.x = 100;
    cat.y = 300;
    cat.state = 'pounce';
    cat.stateTime = 0;
    cat.targetX = 125;
    cat.targetY = 300;
    cat.aimX = 500; // yarn is now far from where the hop will land
    cat.aimY = 300;
    const step = advanceCat(cat, 0.05, W, H); // lands at the fixed target...
    expect(step.smack).toBeNull(); // ...but the yarn is out of paw reach
    expect(step.impacts.length).toBeGreaterThan(0); // landing burst still fires
    expect(cat.state).toBe('pounce'); // hops again rather than recovering
    expect(cat.targetX).toBe(500); // re-aimed at the yarn's new spot
  });

  it('keeps re-hopping toward a fleeing yarn instead of giving up', () => {
    const wide = 80_000; // wide enough that hops never reach a wall
    const cat = createCat(wide, H, () => 0.5);
    cat.x = 100;
    cat.y = 300;
    cat.state = 'pounce';
    cat.stateTime = 0;
    // The yarn always stays 500px ahead, so every landing misses by a mile.
    for (let i = 0; i < 30; i++) {
      cat.targetX = cat.x + 50;
      cat.targetY = cat.y;
      cat.aimX = cat.x + 500;
      cat.aimY = cat.y;
      advanceCat(cat, 0.05, wide, H); // 62.5px step lands the 50px hop
      expect(cat.state).toBe('pounce'); // still chasing — it never gives up
    }
  });

  it('leaps to the yarn from anywhere on the page — no fixed hop distance', () => {
    const farW = 2400;
    const cat = createCat(farW, H, () => 0.5);
    cat.x = 60;
    cat.y = 120;
    cat.state = 'pounce';
    cat.stateTime = 0;
    cat.leapDist0 = 2000;
    cat.targetX = 2000; // way across a wide viewport
    cat.targetY = 120;
    cat.aimX = 2000; // yarn waiting at the far target
    cat.aimY = 120;
    // Enough wall-clock for the leap to close the whole gap and connect.
    advanceCat(cat, 2, farW, H);
    expect(cat.x).toBeCloseTo(2000, 0); // actually reached the far target
    expect(cat.state).toBe('hit'); // caught the yarn at the far spot
    // The mallet swing then flings it and the cat recovers.
    const hit = advanceCat(cat, HIT_IMPACT_TIME, farW, H);
    expect(hit.smack).not.toBeNull();
    advanceCat(cat, HIT_TIME, farW, H);
    expect(cat.state).toBe('recover');
  });

  it('returns to roaming after the recover pause', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.state = 'recover';
    cat.stateTime = 0;
    advanceCat(cat, RECOVER_TIME + 0.01, W, H, { rand: () => 0.5 });
    expect(cat.state).toBe('roam');
  });

  it('resumes moving immediately after recovering — no idle dawdle', () => {
    const cat = createCat(W, H, () => 0.5);
    cat.state = 'recover';
    cat.stateTime = 0;
    // Sit the cat far from the spot rand=0.5 picks (≈400,368) so it has
    // somewhere to walk to.
    cat.x = 100;
    cat.y = 100;
    // Finish the recover beat: it enters roam with no wait queued...
    advanceCat(cat, RECOVER_TIME + 0.01, W, H, { rand: () => 0.5 });
    expect(cat.state).toBe('roam');
    expect(cat.wait).toBe(0);
    // ...so the very next frame it's already padding toward its next spot.
    const before = { x: cat.x, y: cat.y };
    advanceCat(cat, 0.05, W, H, { rand: () => 0.5 });
    expect(Math.hypot(cat.x - before.x, cat.y - before.y)).toBeGreaterThan(0);
  });
});
