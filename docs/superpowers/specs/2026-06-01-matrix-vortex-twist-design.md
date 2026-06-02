# Matrix Vortex Twist — Design

**Date:** 2026-06-01
**Status:** Approved (brainstorm), pending implementation plan
**Area:** `src/backgrounds/` (matrix theme background interaction)

## Summary

Replace the matrix theme's borrowed water-ripple tap effect with a bespoke
**press-and-hold vortex** that warps the falling digital rain itself: a subtle,
ever-shifting swirl that follows the pointer and is "stirred" by dragging. The
rest of the page is untouched — profile, link cards, and corner controls stay
exactly where they are. The vortex is the matrix theme's equivalent of the
galaxy theme's gravity well: a deliberate, user-initiated interaction that bends
the live background rather than overlaying a separate effect.

This supersedes an earlier (rejected) "construct / cracked-glass" concept, which
was dropped because hiding the UI fought the rest of the page.

## Goals

- A matrix-flavored background interaction that is **calm and subtle**, on the
  order of the galaxy star drift — never a strong, distracting motion.
- **Non-repetitive:** the swirl is randomized so it never feels mechanical, and
  it keeps evolving for as long as the pointer is held/dragged.
- **Consistent with existing patterns:** pure model + canvas component, mirroring
  `gravityWell.ts` / `GalaxyBackground.tsx`.

## Non-goals

- No change to the rain model itself (`matrix.ts`), the glyph set, fall speed, or
  trail fade.
- No change to the foreground UI, theme switching, or the other themes.
- No reduced-motion gating (see Reduced motion below).
- No release "flourish" (the well's outward kick has no analog here).

## Interaction model

- **Activate:** press-and-hold on the empty background (gated by the existing
  `isBackgroundTap`, so presses on cards/controls are ignored). Matches the
  galaxy gravity well.
- **Hold:** the rain near the pointer twists into a swirl that eases in, then
  drifts/evolves continuously while held.
- **Drag:** recentres the swirl on the pointer and *stirs* it — faster drag means
  more morphing of the lobed asymmetry.
- **Release:** the swirl unwinds smoothly back to normal rain (strength eases to
  zero); the twist state is cleared once fully unwound. No outward kick.
- **Re-press:** seeds a fresh randomized roll.

## Randomization

Each press seeds a `roll` that determines the character of that swirl, and a set
of slow oscillators that evolve it over the hold:

- **Direction** — clockwise or counter-clockwise, chosen at random per press.
- **Strength & radius** — drift over time via independent slow sine oscillators,
  within a spread set by `RANDOMNESS`.
- **Lobed asymmetry** — 2–3 lobes at a random phase make the swirl organic and
  irregular rather than a perfect circle; the lobe phase rotates over time.
- **Drag-stir** — pointer speed adds to the lobe-phase rotation, so dragging
  visibly churns the swirl.

## Architecture

Mirrors the galaxy gravity well split: pure math in a model file, DOM/canvas
wiring in the background component.

### New: `src/backgrounds/vortexTwist.ts` (pure, no DOM)

Tunable defaults (validated interactively):

- `RADIUS = 150` — Gaussian falloff radius of the swirl, in CSS px.
- `TWIST = 1.3` — base peak rotation (radians) at the swirl centre.
- `RANDOMNESS = 0.45` — spread for per-press/while-held variation.
- Internal: lobe count range (2–3), strength/radius oscillator frequency ranges,
  lobe-phase drift rate, drag-stir scaling, strength ease-in/out rates.

State and functions:

- `interface VortexTwist` — `{ x, y, held, strength, prevX, prevY, magNow,
  radNow, roll }`, where `roll` holds `{ dir, lobes, phase, magFreq, magPhase,
  radFreq, radPhase, drift, t }`. `magNow` / `radNow` are the current
  (oscillator-evolved) magnitude and radius, recomputed each frame by
  `advanceTwist` and read by `warpPoint`.
- `createTwist(x, y, rng = Math.random): VortexTwist` — seed a fresh roll at the
  press point. `rng` is injected so tests are deterministic.
- `moveTwist(twist, x, y): void` — recentre on drag (records previous position
  for drag-speed).
- `advanceTwist(twist, dt): void` — ease `strength` toward `held ? 1 : 0`; advance
  `roll.t`; rotate `roll.phase` by `drift + dragStir` (drag speed derived from
  `prev` vs current centre); recompute and store `magNow` / `radNow` from the
  base defaults and the oscillators.
- `warpPoint(twist, x, y): { x, y, rot }` — rotate the point around `(twist.x,
  twist.y)` by `theta = dir * magNow * f * wob`, where `f` is the Gaussian
  distance falloff scaled by `strength`, and `wob = 1 + lobeAmp * sin(lobes *
  angle + phase)`. Returns the input unchanged (`rot = 0`) when `strength` or `f`
  is negligible (at rest, or outside the radius).

### Changed: `src/backgrounds/MatrixBackground.tsx`

- Add `twistRef: useRef<VortexTwist | null>(null)`, mirroring `wellRef`.
- `useEffect` registers window pointer listeners:
  - `pointerdown` → if `isBackgroundTap(target)`, `twistRef.current =
    createTwist(x, y)`.
  - `pointermove` → if a twist exists, `moveTwist(...)`.
  - `pointerup` / `pointercancel` → if a twist exists, set `held = false` (let it
    unwind; the loop nulls it once `strength` returns to ~0).
- In the existing rAF loop: call `advanceTwist(twist, dt)` once per frame, then
  feed each glyph's draw position through `warpPoint`. When `rot !== 0`, draw the
  glyph with `save/translate/rotate/fillText/restore`; otherwise draw as today.
- The twist lives in its own ref so a resize rebuilding the rain scene never
  clobbers an in-flight interaction (same reasoning as `wellRef`).

### Changed: `src/effects/EffectStage.tsx`

- Matrix joins galaxy in returning `null`: its interaction now lives inside the
  background, so the water ripple no longer mounts for matrix.
- **Rainbow still renders `RippleCanvas`.** Update the component's doc comment to
  reflect that only rainbow uses the ripple now.

## Reduced motion

No gating. The vortex only ever animates in response to a deliberate press, so it
follows the same precedent as the galaxy gravity well (which is not gated on
`prefers-reduced-motion`). The always-on rain is likewise unchanged.

## Testing (TDD)

Per-model test files, matching the repo convention.

`src/backgrounds/vortexTwist.test.ts`:

- `createTwist` with a stubbed `rng` seeds direction, lobes, phase, and oscillator
  params within their documented ranges.
- `advanceTwist` eases `strength` upward while `held` and downward after release;
  `roll.t` and `roll.phase` advance while held.
- Drag (a `moveTwist` then `advanceTwist`) increases the phase advance vs. a held-
  still frame (drag-stir).
- `warpPoint` returns the input unchanged at rest (`strength ≈ 0`) and for points
  well outside `RADIUS`; rotates points within the radius; flips rotation sign
  with `dir`; varies with angle (asymmetry).

`src/backgrounds/MatrixBackground.test.tsx`:

- `pointerdown` on the background creates a twist; `pointerdown` on a card/control
  does not (respects `isBackgroundTap`).
- `pointerup` releases (sets `held = false`).

## Locked defaults

`RADIUS = 150`, `TWIST = 1.3`, `RANDOMNESS = 0.45`.
