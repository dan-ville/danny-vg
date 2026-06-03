import { useEffect, useRef } from 'react';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useResizableCanvas } from '../hooks/useResizableCanvas';
import { useReducedMotion } from '../context/MotionContext';
import { isBackgroundTap } from '../effects/backgroundTap';
import { kittyLink } from '../effects/kittyLink';
import { advanceCat, createCat, startPounce, type Cat, type CatState } from './catSprite';
import { drawImpact, IMPACT_LIFE } from './kittySprites';
import { drawCatSheet, loadCatSheets, HAMMER_REACH, type CatSheets } from './catSheet';

/** A live dust burst spawned at a take-off / landing point, aged each frame. */
interface Impact {
  x: number;
  y: number;
  /** Seconds since it spawned; retired once it passes {@link IMPACT_LIFE}. */
  t: number;
}

/** Drop from the cat's body centre to its feet, where bursts spawn. */
const FOOT_OFFSET = 16;

/**
 * Kitty playground background: a cat that roams the light-tan floor
 * (`.kitty-bg`) on a Canvas 2D layer. The tan wash lives in CSS behind the
 * transparent canvas pixels; the canvas paints the moving cat over it.
 *
 * The pounce is this theme's tap interaction (kept here, like the galaxy gravity
 * well, because it drives the real cat): a background tap makes the cat crouch
 * and leap at the yarn-ball cursor, and on contact it smacks the ball away. The
 * cat reads the yarn's live position — and fires the smack — through
 * {@link kittyLink}, which the yarn cursor (ThemeCursor) publishes. With no
 * cursor (touch) the cat just pounces at the tap point.
 *
 * Roaming is ambient motion, so it's stilled under reduced motion; the
 * user-initiated pounce is kept (matching the orb's click pulse).
 */
export function KittyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const catRef = useRef<Cat | null>(null);
  const prevStateRef = useRef<CatState>('roam');
  const impactsRef = useRef<Impact[]>([]);
  const sheetsRef = useRef<CatSheets | null>(null);
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  useResizableCanvas(canvasRef, (ctx, width, height) => {
    ctxRef.current = ctx;
    sizeRef.current = { width, height };
    // Build the cat once we know the viewport; keep it on resize so a reflow
    // doesn't teleport it mid-roam.
    if (!catRef.current) catRef.current = createCat(width, height);
  });

  // A background tap sends the cat pouncing at the yarn (or the tap point).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!isBackgroundTap(event.target)) return;
      const cat = catRef.current;
      if (!cat) return;
      const aim = kittyLink.yarn ?? { x: event.clientX, y: event.clientY };
      startPounce(cat, aim.x, aim.y);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useAnimationLoop((dt) => {
    const ctx = ctxRef.current;
    if (!ctx) return; // jsdom / unsupported — nothing to animate.
    // Load the sprite strips once, lazily, now that we know we're in a browser.
    if (!sheetsRef.current) sheetsRef.current = loadCatSheets();
    const { width, height } = sizeRef.current;
    const cat = catRef.current;

    ctx.clearRect(0, 0, width, height);
    if (!cat) return;

    // While winding up / leaping, feed the yarn's live position as the cat's
    // *aim* — the crouch tracks it and each landing re-hops toward it, but a hop
    // already in flight travels its fixed line (no mid-air homing).
    if ((cat.state === 'crouch' || cat.state === 'pounce') && kittyLink.yarn) {
      cat.aimX = kittyLink.yarn.x;
      cat.aimY = kittyLink.yarn.y;
    }

    const { smack, impacts } = advanceCat(cat, dt, width, height, {
      roam: !reducedRef.current,
      hammerReach: HAMMER_REACH,
    });

    // Pin the yarn under the raised mallet for the whole `hit` swing so a moving
    // cursor can't drag it off the spot the hammer is about to fall on. Capture
    // it where the ball sits as the swing starts; release on the impact frame
    // (with the smack) or if the swing ends without connecting.
    const justEnteredHit = cat.state === 'hit' && prevStateRef.current !== 'hit';
    const justLeftHit = cat.state !== 'hit' && prevStateRef.current === 'hit';
    if (justEnteredHit) kittyLink.pin = kittyLink.yarn ? { ...kittyLink.yarn } : null;
    if (justLeftHit) kittyLink.pin = null;
    prevStateRef.current = cat.state;

    if (smack) {
      // The mallet connected: free the ball, fling it, and burst dust where the
      // hammer head lands (beside the cat) rather than under its feet.
      kittyLink.pin = null;
      if (kittyLink.smack) kittyLink.smack(smack.vx, smack.vy);
      const hx = cat.x + cat.facing * HAMMER_REACH.x;
      const hy = cat.y + HAMMER_REACH.y;
      impactsRef.current.push({ x: hx, y: hy, t: 0 });
    } else {
      for (const im of impacts) impactsRef.current.push({ x: im.x, y: im.y + FOOT_OFFSET, t: 0 });
    }

    // Age + draw the dust bursts on the ground, beneath the cat.
    const live: Impact[] = [];
    for (const im of impactsRef.current) {
      im.t += dt;
      if (im.t >= IMPACT_LIFE) continue;
      drawImpact(ctx, im.x, im.y, im.t);
      live.push(im);
    }
    impactsRef.current = live;

    drawCatSheet(ctx, cat, sheetsRef.current);
  });

  return <canvas ref={canvasRef} aria-hidden="true" className="kitty-bg fixed inset-0 -z-10" />;
}
