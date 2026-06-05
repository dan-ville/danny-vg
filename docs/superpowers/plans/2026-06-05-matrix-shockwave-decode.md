# Matrix Shockwave-Decode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the matrix theme's subtle vortex-twist tap interaction with a dramatic, viewport-spanning shockwave that shoves and decodes the falling rain.

**Architecture:** A new pure model `src/backgrounds/shockwave.ts` (ring propagation, ripple shove, decode intensity, charge pull — no canvas/DOM, deterministically testable) consumed by `MatrixBackground.tsx`, which owns the pointer listeners and the rAF draw loop. The ambient rain model (`matrix.ts`) is untouched. The old `vortexTwist.ts` and its test are deleted.

**Tech Stack:** TypeScript, React 19, Canvas 2D, Vitest, Vite. Tests follow the existing pure-model style in `matrix.test.ts` / `vortexTwist.test.ts` (deterministic `seq` rng, `describe`/`it`/`expect`).

---

## File Structure

- **Create** `src/backgrounds/shockwave.ts` — pure model: `Ring`, `Charge`, `ShoveEffect`, `ChargeEffect`, constants, and the functions `createRing`, `advanceRing`, `isRingDone`, `ringEffect`, `combineRings`, `chargePull`.
- **Create** `src/backgrounds/shockwave.test.ts` — unit tests for the model.
- **Modify** `src/backgrounds/MatrixBackground.tsx` — swap the vortex wiring for the shockwave (pointer handlers + draw loop).
- **Modify** `src/backgrounds/MatrixBackground.test.tsx` — drop vortex references; assert a press/release cycle drives a ring without throwing.
- **Delete** `src/backgrounds/vortexTwist.ts` and `src/backgrounds/vortexTwist.test.ts`.

---

### Task 1: Shockwave model — ring lifecycle

**Files:**
- Create: `src/backgrounds/shockwave.ts`
- Test: `src/backgrounds/shockwave.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/backgrounds/shockwave.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  createRing,
  advanceRing,
  isRingDone,
  RING_SPEED,
  BAND_THICKNESS,
  MIN_STRENGTH,
} from './shockwave';

describe('createRing', () => {
  it('starts at the press point with zero radius and the base speed', () => {
    const ring = createRing(120, 340, 0);
    expect(ring.x).toBe(120);
    expect(ring.y).toBe(340);
    expect(ring.radius).toBe(0);
    expect(ring.speed).toBe(RING_SPEED);
  });

  it('floors a zero-charge tap at MIN_STRENGTH and tops a full hold at 1', () => {
    expect(createRing(0, 0, 0).strength).toBeCloseTo(MIN_STRENGTH);
    expect(createRing(0, 0, 1).strength).toBeCloseTo(1);
  });

  it('grows strength monotonically with charge', () => {
    expect(createRing(0, 0, 0.5).strength).toBeGreaterThan(createRing(0, 0, 0).strength);
    expect(createRing(0, 0, 1).strength).toBeGreaterThan(createRing(0, 0, 0.5).strength);
  });

  it('clamps charge outside 0..1', () => {
    expect(createRing(0, 0, -2).strength).toBeCloseTo(MIN_STRENGTH);
    expect(createRing(0, 0, 5).strength).toBeCloseTo(1);
  });
});

describe('advanceRing', () => {
  it('expands the radius by speed scaled by the time delta', () => {
    const ring = createRing(0, 0, 1);
    advanceRing(ring, 0.5);
    expect(ring.radius).toBeCloseTo(RING_SPEED * 0.5);
  });
});

describe('isRingDone', () => {
  it('is false while the band still overlaps the viewport and true once it clears it', () => {
    const ring = createRing(0, 0, 1);
    ring.radius = 200;
    expect(isRingDone(ring, 1000)).toBe(false);
    ring.radius = 1000 + BAND_THICKNESS + 1;
    expect(isRingDone(ring, 1000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/backgrounds/shockwave.test.ts`
Expected: FAIL — cannot resolve `./shockwave` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/backgrounds/shockwave.ts`:

```ts
/**
 * Pure model for the Matrix "shockwave-decode" background interaction: a tap (or
 * charged hold) on the empty background fires an expanding ring that sweeps the
 * falling rain — physically shoving glyphs outward in a pond-ripple and
 * "decoding" them (flash white + scramble, then settle). Kept free of canvas/DOM
 * so the propagation, ripple, and decode math can be unit-tested
 * deterministically; MatrixBackground.tsx owns the pointer listeners and the rAF
 * loop. This replaces the old vortex twist as matrix's signature interaction.
 *
 * Positions are CSS px. A ring's `radius` grows at RING_SPEED; its active "band"
 * is the annulus within BAND_THICKNESS of that radius. `strength` (0..1) comes
 * from how long the press was charged and scales both the shove and the decode.
 */

/** Wavefront expansion speed, px/sec. */
export const RING_SPEED = 850;
/** Half-width of the active band around the wavefront, px. */
export const BAND_THICKNESS = 70;
/** Peak radial shove at strength 0, px (a quick tap still reads). */
export const SHOVE_BASE = 22;
/** Peak radial shove at full strength, px. */
export const SHOVE_MAX = 60;
/** Strength floor so a zero-charge tap is still visible. */
export const MIN_STRENGTH = 0.15;
/** Seconds of holding that reaches full charge. */
export const CHARGE_FULL = 1.2;
/** Reach (px) of the inward bend while charging. */
export const CHARGE_PULL_RADIUS = 160;
/** Peak inward displacement at full charge, px. */
export const CHARGE_PULL_MAX = 18;
/** Max concurrent rings; oldest is dropped past this. */
export const MAX_RINGS = 6;
/** Normalizes the ripple shape so its extremum is ~1 (tuning). */
const SHAPE_NORM = 3.3;

/** An expanding shockwave ring centred where the press was released. */
export interface Ring {
  /** Centre in CSS px. */
  x: number;
  y: number;
  /** Current wavefront radius, px; grows over time. */
  radius: number;
  /** Wavefront expansion speed, px/sec. */
  speed: number;
  /** 0..1 — scales shove magnitude and decode intensity. */
  strength: number;
}

/** A held press that is charging a ring; anchored at the press point. */
export interface Charge {
  x: number;
  y: number;
  /** Seconds held so far. */
  t: number;
}

/** A ring's effect on one glyph: radial shove vector + decode intensity. */
export interface ShoveEffect {
  dx: number;
  dy: number;
  /** 0..1 — drives whitening and glyph scramble in the component. */
  decode: number;
}

/** A charge's effect on one glyph: inward bend vector + brighten. */
export interface ChargeEffect {
  dx: number;
  dy: number;
  /** 0..1 — drives brightening in the component. */
  glow: number;
}

/** Fire a ring from the press point. `charge` (0..1) sets its strength. */
export function createRing(x: number, y: number, charge: number): Ring {
  const c = Math.max(0, Math.min(1, charge));
  return { x, y, radius: 0, speed: RING_SPEED, strength: MIN_STRENGTH + c * (1 - MIN_STRENGTH) };
}

/** Expand the wavefront by `dt` seconds. */
export function advanceRing(ring: Ring, dt: number): void {
  ring.radius += ring.speed * dt;
}

/** True once the band's trailing edge has passed `reach` (e.g. viewport diagonal). */
export function isRingDone(ring: Ring, reach: number): boolean {
  return ring.radius - BAND_THICKNESS > reach;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/backgrounds/shockwave.test.ts`
Expected: PASS (10 assertions across the three describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/backgrounds/shockwave.ts src/backgrounds/shockwave.test.ts
git commit -m "feat(matrix): shockwave ring lifecycle model"
```

---

### Task 2: Ripple shove + decode (`ringEffect`, `combineRings`)

**Files:**
- Modify: `src/backgrounds/shockwave.ts`
- Test: `src/backgrounds/shockwave.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/backgrounds/shockwave.test.ts`:

```ts
import { ringEffect, combineRings } from './shockwave';

/** A ring centred at the origin with a wavefront at radius 100. */
const ringAt100 = () => ({ x: 0, y: 0, radius: 100, speed: RING_SPEED, strength: 1 });

describe('ringEffect', () => {
  it('leaves a point well outside the band untouched', () => {
    // dist 300 vs radius 100 -> s = 200 >> BAND_THICKNESS.
    const e = ringEffect(ringAt100(), 300, 0);
    expect(e).toEqual({ dx: 0, dy: 0, decode: 0 });
  });

  it('shoves outward ahead of the wavefront', () => {
    // Point on +x at dist 130 (s = +30, inside the band): pushed further out (+x).
    const e = ringEffect(ringAt100(), 130, 0);
    expect(e.dx).toBeGreaterThan(0);
  });

  it('pulls back behind the wavefront', () => {
    // Point on +x at dist 70 (s = -30, inside the band): returns inward (-x).
    const e = ringEffect(ringAt100(), 70, 0);
    expect(e.dx).toBeLessThan(0);
  });

  it('peaks decode at the wavefront and fades to the band edges', () => {
    const atCrest = ringEffect(ringAt100(), 100, 0).decode; // s = 0
    const nearEdge = ringEffect(ringAt100(), 100 + (BAND_THICKNESS - 1), 0).decode;
    expect(atCrest).toBeGreaterThan(nearEdge);
    expect(atCrest).toBeGreaterThan(0);
    expect(nearEdge).toBeGreaterThanOrEqual(0);
  });

  it('never produces NaN for a point exactly on the centre', () => {
    const e = ringEffect(ringAt100(), 0, 0);
    expect(Number.isFinite(e.dx)).toBe(true);
    expect(Number.isFinite(e.dy)).toBe(true);
    expect(Number.isFinite(e.decode)).toBe(true);
  });
});

describe('combineRings', () => {
  it('sums the shoves and takes the max decode across rings', () => {
    const one = ringEffect(ringAt100(), 130, 0);
    const both = combineRings([ringAt100(), ringAt100()], 130, 0);
    expect(both.dx).toBeCloseTo(one.dx * 2);
    expect(both.decode).toBeCloseTo(one.decode); // max of two equal values
  });

  it('is inert with no rings', () => {
    expect(combineRings([], 130, 0)).toEqual({ dx: 0, dy: 0, decode: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/backgrounds/shockwave.test.ts`
Expected: FAIL — `ringEffect` / `combineRings` are not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/backgrounds/shockwave.ts`:

```ts
/**
 * One ring's effect on the glyph at (x, y). Within the band (|dist - radius| <
 * BAND_THICKNESS) the glyph is shoved radially by a pond-ripple profile —
 * outward ahead of the wavefront (s > 0), back inward behind it (s < 0), zero at
 * the crest and outside the band — with magnitude scaling from SHOVE_BASE to
 * SHOVE_MAX by strength. `decode` peaks at the crest and fades to the band edges.
 * Returns all-zero outside the band or at the exact centre.
 */
export function ringEffect(ring: Ring, x: number, y: number): ShoveEffect {
  const dx0 = x - ring.x;
  const dy0 = y - ring.y;
  const dist = Math.hypot(dx0, dy0);
  const s = dist - ring.radius; // signed distance from the wavefront
  if (dist < 1e-6 || Math.abs(s) >= BAND_THICKNESS) return { dx: 0, dy: 0, decode: 0 };

  const peak = SHOVE_BASE + ring.strength * (SHOVE_MAX - SHOVE_BASE);
  const sigma = BAND_THICKNESS / 2;
  // Odd ripple: + outward for s>0, - inward for s<0, ~0 at the crest and edges.
  const ripple = (s / BAND_THICKNESS) * Math.exp(-(s * s) / (2 * sigma * sigma)) * SHAPE_NORM;
  const mag = peak * ripple;
  const ux = dx0 / dist;
  const uy = dy0 / dist;

  const w = 1 - (s / BAND_THICKNESS) ** 2; // 1 at the crest, 0 at the band edges
  const decode = Math.max(0, w) * ring.strength;

  return { dx: ux * mag, dy: uy * mag, decode };
}

/** Combine every active ring at (x, y): sum the shoves, take the max decode. */
export function combineRings(rings: Ring[], x: number, y: number): ShoveEffect {
  let dx = 0;
  let dy = 0;
  let decode = 0;
  for (const ring of rings) {
    const e = ringEffect(ring, x, y);
    dx += e.dx;
    dy += e.dy;
    if (e.decode > decode) decode = e.decode;
  }
  return { dx, dy, decode };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/backgrounds/shockwave.test.ts`
Expected: PASS (all Task 1 + Task 2 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/backgrounds/shockwave.ts src/backgrounds/shockwave.test.ts
git commit -m "feat(matrix): ripple shove + decode for shockwave rings"
```

---

### Task 3: Charge pull (`chargePull`)

**Files:**
- Modify: `src/backgrounds/shockwave.ts`
- Test: `src/backgrounds/shockwave.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/backgrounds/shockwave.test.ts`:

```ts
import { chargePull, CHARGE_FULL, CHARGE_PULL_RADIUS } from './shockwave';

describe('chargePull', () => {
  it('bends a nearby glyph inward toward the charge centre', () => {
    // Charge at origin, point on +x: displacement should be toward the centre (-x).
    const e = chargePull({ x: 0, y: 0, t: CHARGE_FULL }, 50, 0);
    expect(e.dx).toBeLessThan(0);
  });

  it('brightens more the longer the press is charged', () => {
    const half = chargePull({ x: 0, y: 0, t: CHARGE_FULL / 2 }, 50, 0).glow;
    const full = chargePull({ x: 0, y: 0, t: CHARGE_FULL }, 50, 0).glow;
    expect(full).toBeGreaterThan(half);
  });

  it('does nothing at the instant of the press (t = 0)', () => {
    expect(chargePull({ x: 0, y: 0, t: 0 }, 50, 0)).toEqual({ dx: 0, dy: 0, glow: 0 });
  });

  it('does not reach beyond CHARGE_PULL_RADIUS', () => {
    const e = chargePull({ x: 0, y: 0, t: CHARGE_FULL }, CHARGE_PULL_RADIUS + 10, 0);
    expect(e).toEqual({ dx: 0, dy: 0, glow: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/backgrounds/shockwave.test.ts`
Expected: FAIL — `chargePull` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/backgrounds/shockwave.ts`:

```ts
/**
 * The charge's effect on the glyph at (x, y) while a press is held: a gentle
 * inward bend toward the charge centre plus a brighten, both scaling with how
 * long it has charged (t / CHARGE_FULL, clamped) and fading linearly to nothing
 * at CHARGE_PULL_RADIUS. Returns all-zero before the charge builds or out of reach.
 */
export function chargePull(charge: Charge, x: number, y: number): ChargeEffect {
  const dx0 = x - charge.x;
  const dy0 = y - charge.y;
  const dist = Math.hypot(dx0, dy0);
  const c = Math.min(1, charge.t / CHARGE_FULL);
  if (dist < 1e-6 || dist >= CHARGE_PULL_RADIUS || c <= 0) return { dx: 0, dy: 0, glow: 0 };
  const falloff = 1 - dist / CHARGE_PULL_RADIUS; // 1 at centre -> 0 at the radius
  const pull = CHARGE_PULL_MAX * c * falloff;
  const ux = dx0 / dist;
  const uy = dy0 / dist;
  // Inward = opposite the outward unit vector.
  return { dx: -ux * pull, dy: -uy * pull, glow: c * falloff };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/backgrounds/shockwave.test.ts`
Expected: PASS (Tasks 1–3, all assertions).

- [ ] **Step 5: Commit**

```bash
git add src/backgrounds/shockwave.ts src/backgrounds/shockwave.test.ts
git commit -m "feat(matrix): inward charge-pull model for shockwave"
```

---

### Task 4: Wire the shockwave into `MatrixBackground`

**Files:**
- Modify: `src/backgrounds/MatrixBackground.tsx` (full rewrite of the interaction wiring + draw loop)
- Test: `src/backgrounds/MatrixBackground.test.tsx:25-36` (replace the vortex pointer test)

- [ ] **Step 1: Update the failing test**

Replace the third `it(...)` block (lines 25–36) in `src/backgrounds/MatrixBackground.test.tsx` with:

```tsx
  it('wires up background pointer interaction without throwing', () => {
    // The shockwave listens on window: pressing charges, releasing fires a ring.
    // A full press/release cycle must run cleanly. (The shove/decode math itself
    // is covered in shockwave.test.ts.) jsdom has no PointerEvent; a plain Event
    // drives the same window listeners (target is window, which isBackgroundTap
    // treats as empty background).
    render(<MatrixBackground />);
    expect(() => {
      window.dispatchEvent(new Event('pointerdown'));
      window.dispatchEvent(new Event('pointerup'));
    }).not.toThrow();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/backgrounds/MatrixBackground.test.tsx`
Expected: FAIL — the component still imports `vortexTwist`; the test comment/behavior no longer matches the implementation (and once vortex wiring is referenced it will not align). If it still passes by coincidence, proceed — the implementation step below is what makes the behavior correct.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/backgrounds/MatrixBackground.tsx` with:

```tsx
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

      for (let t = 0; t < col.trail; t++) {
        const row = headRow - t;
        if (row < 0 || row > rowCount) continue;
        const intensity = glyphIntensity(t, col.trail);
        if (intensity <= 0) continue;

        const px = c * CELL;
        const py = row * CELL;

        if (!active) {
          // Fast path: no interaction — draw the rain exactly as at rest.
          ctx.fillStyle = t === 0 ? 'rgba(225,255,235,0.95)' : `rgba(59,255,122,${intensity})`;
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

        if (t === 0) {
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
```

- [ ] **Step 4: Run the matrix tests to verify they pass**

Run: `pnpm exec vitest run src/backgrounds/MatrixBackground.test.tsx src/backgrounds/shockwave.test.ts`
Expected: PASS — the component renders, mounts/unmounts cleanly, and the press/release cycle does not throw.

- [ ] **Step 5: Commit**

```bash
git add src/backgrounds/MatrixBackground.tsx src/backgrounds/MatrixBackground.test.tsx
git commit -m "feat(matrix): drive the rain with the shockwave-decode interaction"
```

---

### Task 5: Remove the old vortex twist

**Files:**
- Delete: `src/backgrounds/vortexTwist.ts`
- Delete: `src/backgrounds/vortexTwist.test.ts`

- [ ] **Step 1: Confirm nothing else imports vortexTwist**

Run: `git grep -n "vortexTwist\|VortexTwist\|warpPoint\|createTwist" -- src e2e`
Expected: no matches outside the two files being deleted. (If `MatrixBackground.tsx` still shows matches, the Task 4 rewrite was incomplete — fix it before deleting.)

- [ ] **Step 2: Delete the files**

```bash
git rm src/backgrounds/vortexTwist.ts src/backgrounds/vortexTwist.test.ts
```

- [ ] **Step 3: Run the full unit suite**

Run: `pnpm test`
Expected: PASS — every suite green, no reference to the deleted module.

- [ ] **Step 4: Typecheck + build**

Run: `pnpm build`
Expected: `tsc -b` reports no type errors and `vite build` completes — confirms no dangling imports or types.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(matrix): remove the superseded vortex-twist interaction"
```

---

## Manual verification (after Task 5)

Run `pnpm dev`, switch to the matrix theme, and confirm in the browser:
- A quick tap on the background fires a ring that expands edge-to-edge, shoving the rain outward as it passes and flashing swept glyphs white before they settle back to green.
- Press-and-hold bends the nearby rain inward and brightens it, then releasing fires a noticeably bigger/stronger ring.
- Firing several taps in quick succession produces overlapping rings whose effects stack.
- Tapping on a card/control does **not** fire a ring.
- Tune the constants at the top of `shockwave.ts` (and `DECODE_SCRAMBLE` in `MatrixBackground.tsx`) to taste.
```
