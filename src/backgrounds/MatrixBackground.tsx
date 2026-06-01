import { useRef } from 'react';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useResizableCanvas } from '../hooks/useResizableCanvas';
import {
  advanceColumn,
  columnCount,
  createColumns,
  glyphIntensity,
  randomGlyph,
  type MatrixColumn,
} from './matrix';

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
 * DPR-aware sizing + resize handling come from `useResizableCanvas`, which
 * rebuilds the column/grid scene for each new viewport size; the rAF loop (with
 * dt clamping + hidden-tab pause) comes from `useAnimationLoop` and reads that
 * scene through a ref.
 */
export function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  // Glyph chars are stable per visible cell so the rain reads as text, not
  // noise; the shimmer mutates individual cells over time. grid[col][row].
  const sceneRef = useRef<{
    width: number;
    height: number;
    rowCount: number;
    cols: MatrixColumn[];
    grid: string[][];
  }>({ width: 0, height: 0, rowCount: 0, cols: [], grid: [] });

  useResizableCanvas(canvasRef, (ctx, width, height) => {
    ctxRef.current = ctx;
    const rowCount = Math.ceil(height / CELL);
    const cols = createColumns(columnCount(width, CELL), rowCount);
    const grid = cols.map(() => Array.from({ length: rowCount + 1 }, () => randomGlyph()));
    sceneRef.current = { width, height, rowCount, cols, grid };
  });

  useAnimationLoop((dt) => {
    const ctx = ctxRef.current;
    if (!ctx) return; // jsdom / unsupported — nothing to animate.
    const { width, height, rowCount, cols, grid } = sceneRef.current;
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
  });

  return <canvas ref={canvasRef} aria-hidden="true" className="matrix-bg fixed inset-0 -z-10" />;
}
