# Matrix Shockwave-Decode — Design

**Date:** 2026-06-05
**Status:** Approved (pending spec review)

## Summary

Replace the matrix theme's current tap interaction — the subtle, local **vortex
twist** — with a more dramatic, viewport-spanning **shockwave-decode**. Pressing
the background charges a ring; releasing fires it. The expanding ring sweeps the
falling rain, physically **shoving** glyphs outward in a pond-ripple and
**decoding** them (flash white + rapid-cycle, then settle back to green). It is
inherently viewport-wide and gives matrix its own identity rather than echoing
the galaxy theme's gravity well.

## Motivation

The vortex twist was deliberately built as the sibling of the galaxy gravity
well: gentle, local (150px Gaussian falloff), press-and-hold-bends-the-field.
That restraint makes matrix feel less distinctive than the other themes. The
shockwave-decode is bigger, leans into the "code resolving" Matrix motif, and is
distinct from galaxy.

## Scope

**In scope**
- New pure model `src/backgrounds/shockwave.ts` (ring propagation, ripple shove,
  decode intensity, charge pull, multi-ring combination).
- Rewire `src/backgrounds/MatrixBackground.tsx` to drive the shockwave instead of
  the twist.
- New `src/backgrounds/shockwave.test.ts`; update `MatrixBackground.test.tsx`.
- Delete `src/backgrounds/vortexTwist.ts` and `src/backgrounds/vortexTwist.test.ts`.

**Out of scope**
- The ambient digital rain (`matrix.ts`) — falling columns, trails, shimmer —
  is unchanged.
- Other themes (galaxy, rainbow) are untouched.
- `EffectStage` still renders **no** overlay for matrix; the shockwave warps the
  real glyphs in the background, exactly as the twist did.

## Architecture

Same split the codebase already uses for backgrounds: a **pure model** (no
canvas/DOM, deterministically unit-testable, `rand` injectable) plus the
**canvas component** that owns the rAF loop, the glyph grid, and drawing.

- `shockwave.ts` — pure model (this design's new logic).
- `MatrixBackground.tsx` — pointer listeners, rAF loop, per-glyph draw with the
  model applied. Mirrors how it previously consumed `vortexTwist.ts`.

## Gesture

- **Press** on the empty background (`isBackgroundTap`) starts a **charge** at
  that point. While held, nearby rain bends gently **inward** and brightens,
  building over `CHARGE_FULL` seconds toward full charge (clamped at 1).
- **Release** (pointerup/cancel) fires one **ring** from the press point. Its
  `strength` scales with charge: a quick tap (≈0 charge) → a standard ring; a
  full hold → a bigger/thicker/stronger one. A minimum strength guarantees a tap
  is always visible.
- Multiple rings coexist; their shoves **sum** and their decode takes the **max**
  where they overlap. Concurrent rings are capped at `MAX_RINGS` (~6), dropping
  the oldest when exceeded.
- The charge is **anchored at the press point** — dragging does not move it
  (keeps v1 simple). Pointer move is only used to ignore taps that begin on
  cards/controls (already handled by `isBackgroundTap` at pointerdown).

## The wavefront — shove + decode

A ring has a current `radius` that grows at `RING_SPEED`. Its **band** is the
annulus `|dist - radius| < thickness`. For a glyph at distance `dist` from the
ring center, define the signed offset `s = dist - radius` within the band:

- **Shove (ripple):** displace the glyph **radially** by a pond-ripple profile
  of `s` — pushed outward as the leading edge approaches, pulled back as the
  trailing edge passes, zero at band center and outside the band. Peak
  displacement = `SHOVE_BASE + strength * (SHOVE_MAX - SHOVE_BASE)`. Implemented
  as a smooth odd function of `s` (e.g. `s/thickness` through a
  derivative-of-Gaussian / sine envelope) so it returns cleanly to rest.
- **Decode:** an intensity `decode ∈ [0,1]` peaking at the band center and
  falling to 0 at the band edges. In the component this drives (a) blending the
  glyph color toward white and (b) a high per-frame chance to re-randomize that
  cell's glyph, so swept glyphs flash and scramble, then settle back to green as
  the band moves on.

Everything is zero outside the band, so untouched regions render on the existing
fast path.

## Model API — `shockwave.ts`

```
interface Ring { x: number; y: number; radius: number; speed: number; strength: number }
interface Charge { x: number; y: number; t: number }

createRing(x, y, charge: number): Ring            // strength from charge (min floor for taps)
advanceRing(ring: Ring, dt: number): void          // radius += speed * dt
isRingDone(ring: Ring, reach: number): boolean     // band fully past the far corner

// Per-point effect for one ring; zero outside the band.
ringEffect(ring: Ring, x, y): { dx: number; dy: number; decode: number }

// Inward bend + brighten while charging; scales with charge.t.
chargePull(charge: Charge, x, y): { dx: number; dy: number; glow: number }

// Combine active rings for a point: sum shoves, max decode.
combineRings(rings: Ring[], x, y): { dx: number; dy: number; decode: number }
```

Tunable constants (live in `shockwave.ts`, dialed in the running app):

- `RING_SPEED` ≈ 850 px/s
- `BAND_THICKNESS` ≈ 70 px
- `SHOVE_BASE` ≈ 22 px (tap), `SHOVE_MAX` ≈ 60 px (full charge)
- `CHARGE_FULL` ≈ 1.2 s
- `DECODE_SETTLE` ≈ 0.25 s (governs the re-randomize/return feel)
- `MAX_RINGS` = 6
- `MIN_STRENGTH` — floor so a zero-charge tap still reads

## Component wiring — `MatrixBackground.tsx`

- Replace `twistRef` with `shockwaveRef = { rings: Ring[]; charge: Charge | null }`
  (kept in a ref so resize-driven scene rebuilds never clobber an in-flight
  interaction — same reasoning as the twist).
- `pointerdown` (background tap) → start `charge` at the point.
- `pointermove` → no-op for the charge (anchored).
- `pointerup` / `pointercancel` → `createRing` from the charge, push it (respecting
  `MAX_RINGS`), clear the charge.
- rAF loop:
  - If charging, advance `charge.t += dt`.
  - `advanceRing` each ring; drop rings where `isRingDone` (reach = viewport
    diagonal).
  - For each glyph: combine `chargePull` (if charging) + `combineRings` → final
    `dx, dy, decode, glow`. Draw at the displaced position; blend fill color
    toward white by `decode` and brighten by `glow`; with probability scaled by
    `decode` swap the grid cell to `randomGlyph()`.
  - Preserve the current fast path: when no charge and no rings, draw exactly as
    today.

## Testing

Mirror the existing pure-model test style (`matrix.test.ts`, `vortexTwist.test.ts`).

`shockwave.test.ts`:
- `createRing`: charge → strength mapping (tap floor vs full charge); higher
  charge yields higher strength.
- `advanceRing`: radius grows by `speed * dt`.
- `isRingDone`: false until band fully clears `reach`, true after.
- `ringEffect`: zero outside the band; shove is outward (positive radial) at the
  leading edge and returns (opposite sign) at the trailing edge; decode peaks at
  band center and is zero at edges.
- `combineRings`: shoves sum, decode is the max across overlapping rings.
- `chargePull`: displacement points **inward** (toward center); `glow` grows
  with `charge.t`.

`MatrixBackground.test.tsx` (update existing):
- Keep the canvas-render and clean mount/unmount assertions.
- Replace the vortex-twist pointer test: a press/(hold)/release cycle drives a
  ring without throwing (note in the comment that the shove/decode math is
  covered in `shockwave.test.ts`).

## Risks / Notes

- **Performance:** per-glyph work only runs while a charge or ring is active, and
  rings are capped at 6. The glyph count is `columns × rows`; combined with ≤6
  rings this is comparable to the per-glyph `warpPoint` the twist already did.
- **prefers-reduced-motion:** the shockwave is strictly user-initiated (no
  ambient motion added), so it stays enabled; the ambient rain's existing
  behavior is unchanged.
- **Cleanup:** removing `vortexTwist.ts` / `vortexTwist.test.ts` and the
  component's twist wiring is part of this work — no dead code left behind.
