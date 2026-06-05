import { useEffect, useRef } from 'react';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useResizableCanvas } from '../hooks/useResizableCanvas';
import { isBackgroundTap } from '../effects/backgroundTap';
import {
  advanceColumn,
  columnCount,
  createColumns,
  glyphIntensity,
  randomGlyph,
  type MatrixColumn,
} from './matrix';
import {
  advanceRing,
  combineRings,
  chargePull,
  createRing,
  isRingDone,
  CHARGE_FULL,
  MAX_RINGS,
  type Charge,
  type Ring,
} from './shockwave';

/** Glyph cell size in CSS px; also the column width and row height. */
const CELL = 16;
/** Per-frame chance a column swaps its head glyph, giving the rain its shimmer. */
const SHIMMER_CHANCE = 0.12;
/** Max per-frame chance a swept glyph re-randomizes, at full decode (the scramble). */
const DECODE_SCRAMBLE = 0.5;

/**
 * Matrix "digital rain" background: falling katakana/digit columns on a Canvas
 * 2D layer over a black base (`.matrix-bg`). The leading glyph of each column is
 * drawn white-ish, with a green trail fading behind it. Column motion and the
 * fade curve live in the pure `matrix.ts` model; this component owns the canvas,
 * the per-cell glyph grid, and the rAF loop.
 *
 * DPR-aware sizing + resize handling come from `useResizableCanvas`, which
 * rebuilds the column/grid scene for each new viewport size; the rAF loop (with
 * dt clamping + hidden-tab pause) comes from `useAnimationLoop` and reads that
 * scene through a ref.
 *
 * The matrix theme's tap interaction is the **shockwave-decode** (`shockwave.ts`):
 * pressing the empty background charges a ring (rain bends inward, brightens) and
 * releasing fires it; the expanding wavefront shoves the rain outward in a
 * pond-ripple and "decodes" the swept glyphs (flash white + scramble, then
 * settle). It lives here, in the background, because it displaces the real
 * glyphs — so `EffectStage` renders no separate overlay for matrix.
 */
export function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  // Glyph chars are stable per visible cell so the rain reads as text, not
  // noise; the shimmer (and decode scramble) mutate individual cells over time.
  // grid[col][row].
  const sceneRef = useRef<{
    width: number;
    height: number;
    rowCount: number;
    cols: MatrixColumn[];
    grid: string[][];
  }>({ width: 0, height: 0, rowCount: 0, cols: [], grid: [] });
  // Live shockwave state: the rings in flight plus the charge being held (or
  // null at rest). Kept in its own ref so a resize rebuilding the rain scene
  // never clobbers an in-flight interaction.
  const shockwaveRef = useRef<{ rings: Ring[]; charge: Charge | null }>({ rings: [], charge: null });

  useResizableCanvas(canvasRef, (ctx, width, height) => {
    ctxRef.current = ctx;
    const rowCount = Math.ceil(height / CELL);
    const cols = createColumns(columnCount(width, CELL), rowCount);
    const grid = cols.map(() => Array.from({ length: rowCount + 1 }, () => randomGlyph()));
    sceneRef.current = { width, height, rowCount, cols, grid };
  });

  // Pressing the empty background starts a charge; holding builds it; releasing
  // fires a ring whose strength scales with how long it charged. Taps that start
  // on cards/controls are ignored.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!isBackgroundTap(event.target)) return;
      shockwaveRef.current.charge = { x: event.clientX, y: event.clientY, t: 0 };
    };
    const onRelease = () => {
      const sw = shockwaveRef.current;
      if (!sw.charge) return;
      const charge = Math.min(1, sw.charge.t / CHARGE_FULL);
      sw.rings.push(createRing(sw.charge.x, sw.charge.y, charge));
      if (sw.rings.length > MAX_RINGS) sw.rings.shift();
      sw.charge = null;
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onRelease);
    window.addEventListener('pointercancel', onRelease);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
    };
  }, []);

  useAnimationLoop((dt) => {
    const ctx = ctxRef.current;
    if (!ctx) return; // jsdom / unsupported — nothing to animate.
    const { width, height, rowCount, cols, grid } = sceneRef.current;
    const sw = shockwaveRef.current;

    // Advance the charge clock (if held) and every live ring; retire rings whose
    // band has fully crossed the far corner of the viewport.
    if (sw.charge) sw.charge.t += dt;
    const reach = Math.hypot(width, height);
    for (const ring of sw.rings) advanceRing(ring, dt);
    sw.rings = sw.rings.filter((ring) => !isRingDone(ring, reach));
    const active = sw.charge !== null || sw.rings.length > 0;

    ctx.clearRect(0, 0, width, height);
    ctx.font = `${CELL}px "Courier New", ui-monospace, monospace`;
    ctx.textBaseline = 'top';

    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      advanceColumn(col, dt, rowCount);
      const headRow = Math.floor(col.head);

      // Shimmer: occasionally refresh the glyph sitting at the head.
      if (headRow >= 0 && headRow <= rowCount && Math.random() < SHIMMER_CHANCE) {
        grid[c][headRow] = randomGlyph();
      }

      for (let ti = 0; ti < col.trail; ti++) {
        const row = headRow - ti;
        if (row < 0 || row > rowCount) continue;
        const intensity = glyphIntensity(ti, col.trail);
        if (intensity <= 0) continue;

        const px = c * CELL;
        const py = row * CELL;

        if (!active) {
          // Fast path: no interaction — draw the rain exactly as at rest.
          ctx.fillStyle = ti === 0 ? 'rgba(225,255,235,0.95)' : `rgba(59,255,122,${intensity})`;
          ctx.fillText(grid[c][row] ?? randomGlyph(), px, py);
          continue;
        }

        // Outward ring shoves + the inward charge pull; brightness is whichever
        // of decode / charge-glow is stronger here.
        const shove = combineRings(sw.rings, px, py);
        let dx = shove.dx;
        let dy = shove.dy;
        let bright = shove.decode;
        if (sw.charge) {
          const pull = chargePull(sw.charge, px, py);
          dx += pull.dx;
          dy += pull.dy;
          if (pull.glow > bright) bright = pull.glow;
        }

        // Decode: swept glyphs scramble, then settle as the band moves on.
        if (bright > 0 && Math.random() < bright * DECODE_SCRAMBLE) {
          grid[c][row] = randomGlyph();
        }

        if (ti === 0) {
          ctx.fillStyle = 'rgba(225,255,235,0.95)'; // bright white-green head
        } else {
          // Blend the green trail toward white by brightness; boost alpha so a
          // dim trail glyph still flashes when the wavefront hits it.
          const r = Math.round(59 + bright * (255 - 59));
          const b = Math.round(122 + bright * (255 - 122));
          const a = Math.min(1, intensity + bright * 0.7);
          ctx.fillStyle = `rgba(${r},255,${b},${a})`;
        }
        ctx.fillText(grid[c][row] ?? randomGlyph(), px + dx, py + dy);
      }
    }
  });

  return <canvas ref={canvasRef} aria-hidden="true" className="matrix-bg fixed inset-0 -z-10" />;
}
