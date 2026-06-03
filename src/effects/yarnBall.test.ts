import { describe, it, expect } from 'vitest';
import {
  createYarn,
  followPointer,
  smackYarn,
  advanceYarn,
  SETTLE_SPEED,
  SMACK_SPEED,
  SMACK_GRACE,
  YARN_RADIUS,
} from './yarnBall';

describe('createYarn', () => {
  it('starts at rest under the pointer with no velocity', () => {
    const yarn = createYarn(120, 80);
    expect(yarn.x).toBe(120);
    expect(yarn.y).toBe(80);
    expect(yarn.vx).toBe(0);
    expect(yarn.vy).toBe(0);
    expect(yarn.airborne).toBe(false);
  });
});

describe('followPointer', () => {
  it('eases toward the pointer without overshooting and keeps velocity zero', () => {
    const yarn = createYarn(0, 0);
    followPointer(yarn, 100, 0);
    expect(yarn.x).toBeGreaterThan(0);
    expect(yarn.x).toBeLessThan(100); // eased, not snapped
    expect(yarn.vx).toBe(0);
    expect(yarn.vy).toBe(0);
  });

  it('rolls the ball in the direction it travels', () => {
    const yarn = createYarn(0, 0);
    followPointer(yarn, 100, 0);
    expect(yarn.angle).toBeGreaterThan(0); // rolled clockwise moving right
  });

  it('converges on the pointer over repeated frames', () => {
    const yarn = createYarn(0, 0);
    for (let i = 0; i < 60; i++) followPointer(yarn, 200, 50);
    expect(yarn.x).toBeCloseTo(200, 0);
    expect(yarn.y).toBeCloseTo(50, 0);
  });
});

describe('smackYarn', () => {
  it('launches the ball with the given velocity and marks it airborne', () => {
    const yarn = createYarn(50, 50);
    smackYarn(yarn, 600, -300);
    expect(yarn.vx).toBe(600);
    expect(yarn.vy).toBe(-300);
    expect(yarn.airborne).toBe(true);
  });

  it('opens the post-smack grace window that bars an instant reclaim', () => {
    const yarn = createYarn(50, 50);
    smackYarn(yarn, 600, 0);
    expect(yarn.launchGrace).toBe(SMACK_GRACE);
    // The grace counts down as the ball flies, then expires.
    advanceYarn(yarn, SMACK_GRACE / 2, 800, 600);
    expect(yarn.launchGrace).toBeGreaterThan(0);
    advanceYarn(yarn, SMACK_GRACE, 800, 600);
    expect(yarn.launchGrace).toBe(0);
  });
});

describe('advanceYarn', () => {
  it('does nothing while the ball is at rest', () => {
    const yarn = createYarn(40, 40);
    advanceYarn(yarn, 0.1, 800, 600);
    expect(yarn.x).toBe(40);
    expect(yarn.y).toBe(40);
    expect(yarn.airborne).toBe(false);
  });

  it('flies and loses speed to drag', () => {
    const yarn = createYarn(400, 300);
    smackYarn(yarn, SMACK_SPEED, 0);
    advanceYarn(yarn, 0.1, 800, 600);
    expect(yarn.x).toBeGreaterThan(400); // moved right
    expect(yarn.vx).toBeGreaterThan(0);
    expect(yarn.vx).toBeLessThan(SMACK_SPEED); // drag bled some speed off
  });

  it('bounces off the right wall, reflecting and clamping inside', () => {
    const width = 200;
    const yarn = createYarn(width - YARN_RADIUS - 1, 100);
    smackYarn(yarn, 800, 0);
    advanceYarn(yarn, 0.05, width, 600);
    expect(yarn.x).toBeLessThanOrEqual(width - YARN_RADIUS); // didn't tunnel out
    expect(yarn.vx).toBeLessThan(0); // now heading back left
  });

  it('bounces off the top wall', () => {
    const yarn = createYarn(100, YARN_RADIUS + 1);
    smackYarn(yarn, 0, -800);
    advanceYarn(yarn, 0.05, 800, 600);
    expect(yarn.y).toBeGreaterThanOrEqual(YARN_RADIUS);
    expect(yarn.vy).toBeGreaterThan(0); // reflected downward
  });

  it('settles back to rest once it slows below the threshold', () => {
    const yarn = createYarn(400, 300);
    smackYarn(yarn, SETTLE_SPEED * 0.5, 0); // already below the settle speed
    advanceYarn(yarn, 0.016, 800, 600);
    expect(yarn.airborne).toBe(false);
    expect(yarn.vx).toBe(0);
    expect(yarn.vy).toBe(0);
  });

  it('eventually settles after a full-strength smack', () => {
    const yarn = createYarn(400, 300);
    smackYarn(yarn, SMACK_SPEED, SMACK_SPEED * 0.3);
    for (let i = 0; i < 600 && yarn.airborne; i++) advanceYarn(yarn, 0.016, 800, 600);
    expect(yarn.airborne).toBe(false);
  });
});
