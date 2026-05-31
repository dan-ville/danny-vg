/**
 * Pure model for the Matrix "digital rain" background: column motion, glyph
 * selection, and trail-fade math. Kept free of canvas/DOM so it can be
 * unit-tested deterministically; MatrixBackground.tsx owns the canvas, the
 * per-cell glyph grid, and the rAF loop. Positions are measured in *rows*
 * (cell-height units), not pixels, so the model is resolution-independent.
 */

/** Half-width katakana + digits — the classic falling-rain glyph set. */
export const GLYPHS =
  'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';

/** Pick a glyph. `rand` is injectable (defaults to Math.random) for testing. */
export function randomGlyph(rand: () => number = Math.random): string {
  // Math.min guards the rand()===1 edge so we never index past the string.
  return GLYPHS[Math.min(GLYPHS.length - 1, Math.floor(rand() * GLYPHS.length))];
}

/** A single falling column. Glyph characters live in the component's grid. */
export interface MatrixColumn {
  /** Row index of the leading (brightest) glyph; floats, may be negative. */
  head: number;
  /** Fall speed in rows per second. */
  speed: number;
  /** Number of trailing glyphs behind the head before it fades to nothing. */
  trail: number;
}

const MIN_SPEED = 6; // rows/sec
const MAX_SPEED = 22;
const MIN_TRAIL = 6; // rows
const MAX_TRAIL = 22;

/** How many columns fit across the viewport, at least one. */
export function columnCount(width: number, cellSize: number): number {
  return Math.max(1, Math.floor(width / cellSize));
}

/** Randomized column, started somewhere above the top so it rains in. */
function spawnColumn(rowCount: number, rand: () => number): MatrixColumn {
  return {
    head: -rand() * rowCount, // staggered above the screen (<= 0)
    speed: MIN_SPEED + rand() * (MAX_SPEED - MIN_SPEED),
    trail: Math.round(MIN_TRAIL + rand() * (MAX_TRAIL - MIN_TRAIL)),
  };
}

/** Build a fresh set of columns, each staggered above the viewport. */
export function createColumns(
  count: number,
  rowCount: number,
  rand: () => number = Math.random,
): MatrixColumn[] {
  const cols: MatrixColumn[] = [];
  for (let i = 0; i < count; i++) cols.push(spawnColumn(rowCount, rand));
  return cols;
}

/**
 * Fall the column by `dt` seconds. Once the tail of the trail clears the
 * bottom of the screen the column is recycled to a fresh randomized one above
 * the top, so the rain never stops.
 */
export function advanceColumn(
  col: MatrixColumn,
  dt: number,
  rowCount: number,
  rand: () => number = Math.random,
): void {
  col.head += col.speed * dt;
  // The dimmest glyph sits `trail` rows above the head; recycle once even it
  // has passed the bottom edge.
  if (col.head - col.trail > rowCount) {
    Object.assign(col, spawnColumn(rowCount, rand));
  }
}

/**
 * Brightness of a glyph `rowsFromHead` rows above the head (0 = head itself).
 * 1 at the head, linearly fading to 0 at the end of the trail; 0 above the
 * head or beyond the trail.
 */
export function glyphIntensity(rowsFromHead: number, trail: number): number {
  if (rowsFromHead < 0 || rowsFromHead >= trail) return 0;
  return 1 - rowsFromHead / trail;
}
