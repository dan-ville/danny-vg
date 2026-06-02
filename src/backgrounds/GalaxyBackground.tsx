import { useEffect, useRef } from 'react';
import { useAnimationLoop } from '../hooks/useAnimationLoop';
import { useResizableCanvas } from '../hooks/useResizableCanvas';
import { isBackgroundTap } from '../effects/backgroundTap';
import { createWell, moveWell, releaseKick, type Well } from './gravityWell';
import { updateStarField } from './galaxySim';
import { createStars, starAlpha, starCount, type Star } from './stars';

/**
 * Cosmic galaxy background: drifting, twinkling star particles drawn on a
 * Canvas 2D layer over the CSS radial-gradient nebula (`.galaxy-bg`). The
 * nebula lives in CSS so it paints instantly; the canvas only adds stars.
 *
 * DPR-aware sizing + resize handling come from `useResizableCanvas`; the rAF
 * loop (with dt clamping + hidden-tab pause) comes from `useAnimationLoop`.
 * The star field is rebuilt for each new viewport size via the resize handler
 * and read by the loop through a ref.
 */
export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sceneRef = useRef<{ width: number; height: number; stars: Star[] }>({
    width: 0,
    height: 0,
    stars: [],
  });
  // The active gravity well (or null at rest). Kept in its own ref so a resize
  // rebuilding the star scene never clobbers an in-flight tap.
  const wellRef = useRef<Well | null>(null);

  useResizableCanvas(canvasRef, (ctx, width, height) => {
    ctxRef.current = ctx;
    sceneRef.current = { width, height, stars: createStars(starCount(width, height), width, height) };
  });

  // Pressing the empty background spawns a held well; dragging recentres it so
  // the stars follow; releasing kicks the gathered stars outward to scatter.
  // Taps that start on cards/controls are ignored.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!isBackgroundTap(event.target)) return;
      const { width, height } = sceneRef.current;
      // Cap the reach at the viewport diagonal so a long hold pulls everything.
      wellRef.current = createWell(event.clientX, event.clientY, Math.hypot(width, height));
    };
    const onPointerMove = (event: PointerEvent) => {
      if (wellRef.current) moveWell(wellRef.current, event.clientX, event.clientY);
    };
    const onRelease = () => {
      const well = wellRef.current;
      if (!well) return;
      // One outward shove to the survivors before the well lets go; damping in
      // advanceStar then eases them back into normal drift.
      for (const star of sceneRef.current.stars) releaseKick(star, well);
      wellRef.current = null;
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onRelease);
    window.addEventListener('pointercancel', onRelease);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
    };
  }, []);

  useAnimationLoop((dt) => {
    const ctx = ctxRef.current;
    if (!ctx) return; // jsdom / unsupported — nothing to animate.
    const { width, height } = sceneRef.current;

    // Advance the field under the well (pull, consume, recycle, inflow, cull).
    const stars = updateStarField(sceneRef.current.stars, wellRef.current, dt, width, height);
    sceneRef.current.stars = stars;

    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      ctx.globalAlpha = starAlpha(star);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  return <canvas ref={canvasRef} aria-hidden="true" className="galaxy-bg fixed inset-0 -z-10" />;
}
