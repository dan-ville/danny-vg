/**
 * Canvas drawing for the kitty theme's two non-cat flourishes: the pounce dust
 * burst and the yarn-ball cursor. (The cat itself is frame-animated from sprite
 * sheets in catSheet.ts.) Pulled out of the components so the look lives in one
 * place and KittyBackground / ThemeCursor stay about lifecycle + the rAF loop.
 * These take a live 2d context, so they're exercised by the component/e2e tests;
 * the physics they render lives in catSprite.ts / yarnBall.ts.
 */
import { YARN_RADIUS } from '../effects/yarnBall';

/** How long an impact dust-burst lives (s) before it's fully faded out. */
export const IMPACT_LIFE = 0.42;

/**
 * A take-off / landing impact burst at a ground point: a brief white flash, an
 * expanding ground-flattened dust ring, and specks flung outward and up. `t` is
 * the burst's age in seconds (0 → fresh); past {@link IMPACT_LIFE} it's gone.
 * Drawn at the cat's feet so a pounce reads as a hard, powerful stomp.
 */
export function drawImpact(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const k = Math.min(1, Math.max(0, t / IMPACT_LIFE)); // 0..1 normalised age
  const fade = 1 - k;
  const rx = 8 + k * 38; // ring expands outward as it ages
  const ry = rx * 0.34; // flattened to lie on the ground

  ctx.save();
  ctx.translate(x, y);

  // Expanding dust ring.
  ctx.globalAlpha = fade * 0.6;
  ctx.lineWidth = 2.5 * fade + 0.5;
  ctx.strokeStyle = 'rgba(120, 85, 45, 0.9)';
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Sharp white flash, only for the first third of the life.
  if (k < 0.35) {
    ctx.globalAlpha = (1 - k / 0.35) * 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.5, ry * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dust specks flung out along the ground and arcing up.
  const specks = 7;
  ctx.fillStyle = 'rgba(150, 110, 70, 0.9)';
  for (let i = 0; i < specks; i++) {
    const a = (i / specks) * Math.PI * 2 + i; // deterministic spread
    const dist = k * (24 + (i % 3) * 10);
    const px = Math.cos(a) * dist;
    const py = Math.sin(a) * 0.34 * dist - k * (12 + (i % 4) * 6); // arc upward
    const r = Math.max(0.4, (2.2 - k * 1.4) * (1 - (i % 3) * 0.15));
    ctx.globalAlpha = fade * 0.85;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** Yarn-ball palette (the cursor): soft pink wound with a deeper pink thread. */
export const YARN_PALETTE = {
  ball: '#ff8fc2',
  thread: '#d9518c',
  outline: '#a83a6e',
};

/**
 * The yarn-ball cursor: a simple pink ball with two crossed windings, spun by
 * `angle` so it rolls as it tracks the pointer or flies after a smack. Kept
 * deliberately plain so it stays legible as a cursor at small size.
 */
export function drawYarn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  palette = YARN_PALETTE,
): void {
  const r = YARN_RADIUS;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = palette.ball;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.outline;
  ctx.stroke();

  // Wound strands: clip to the ball, then lay several thin ellipses fanned in
  // both directions so it reads as a densely wound ball, not a couple of hoops.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = palette.thread;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  const fan = [-0.95, -0.5, -0.1, 0.35, 0.8];
  for (const tilt of fan) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.42, tilt, 0, Math.PI * 2);
    ctx.stroke();
  }
  // A few crossing strands the other way to weave it together.
  for (const tilt of [-0.7, 0.15, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.42, r * 0.95, tilt, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // A soft top-left highlight to round it off.
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.34, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();

  ctx.restore();
}
