import { useEffect, useRef } from 'react';
import {
  advanceColumn,
  columnCount,
  createColumns,
  glyphIntensity,
  randomGlyph,
  type MatrixColumn,
} from './matrix';

/** DPR cap from the spec — keeps the buffer reasonable on retina/4K. */
const MAX_DPR = 2;
/** Glyph cell size in CSS px; also the column width and row height. */
const CELL = 16;
/** Per-frame chance a column swaps its head glyph, giving the rain its shimmer. */
const SHIMMER_CHANCE = 0.12;

/**
 * Matrix "digital rain" background: falling katakana/digit columns on a Canvas
 * 2D layer over a black base (`.matrix-bg`). The leading glyph of each column
 * is drawn white-ish, with a green trail fading behind it. Column motion and
 * the fade curve live in the pure `matrix.ts` model; this component owns the
 * canvas, the per-cell glyph grid, and the rAF loop.
 *
 * A shared resizable-canvas hook + visibilitychange pause + reduced-motion
 * handling arrive in M4; this version owns its own resize listener and loop.
 */
export function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported — nothing to animate.

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let cols: MatrixColumn[] = [];
    // Glyph chars are stable per visible cell so the rain reads as text, not
    // noise; the shimmer mutates individual cells over time. grid[col][row].
    let grid: string[][] = [];
    let width = 0;
    let height = 0;
    let rowCount = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rowCount = Math.ceil(height / CELL);
      cols = createColumns(columnCount(width, CELL), rowCount);
      grid = cols.map(() => Array.from({ length: rowCount + 1 }, () => randomGlyph()));
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't teleport the rain on resume.
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

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

        for (let t = 0; t < col.trail; t++) {
          const row = headRow - t;
          if (row < 0 || row > rowCount) continue;
          const intensity = glyphIntensity(t, col.trail);
          if (intensity <= 0) continue;
          const glyph = grid[c][row] ?? randomGlyph();
          if (t === 0) {
            ctx.fillStyle = 'rgba(225,255,235,0.95)'; // bright white-green head
          } else {
            ctx.fillStyle = `rgba(59,255,122,${intensity})`; // fading green trail
          }
          ctx.fillText(glyph, c * CELL, row * CELL);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="matrix-bg fixed inset-0 -z-10" />;
}
