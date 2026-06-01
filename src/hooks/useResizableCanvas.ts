import { useEffect, useRef, type RefObject } from 'react';

/** DPR cap from the spec (§11) — keeps the backing buffer reasonable on retina/4K. */
export const MAX_DPR = 2;

/**
 * Called once on mount and on every resize with the live 2d context, the
 * current CSS-pixel dimensions, and the clamped device-pixel ratio. Callers use
 * it to rebuild size-derived state (stars, columns, glyph grid) for the new box.
 */
export type ResizeHandler = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
) => void;

export interface ResizableCanvasOptions {
  /** Upper bound applied to devicePixelRatio. Defaults to {@link MAX_DPR}. */
  maxDpr?: number;
}

/**
 * DPR-aware canvas sizing shared by all three backgrounds + the ripple canvas
 * (spec §11). Sizes the backing buffer to CSS-pixels × clamped devicePixelRatio,
 * pins the CSS box to the viewport, applies a DPR transform so callers draw in
 * CSS px, and re-runs on resize / orientation change.
 *
 * The rAF loop stays with each component — the ripple canvas runs on-demand
 * while the backgrounds run continuously, so the loop is not the hook's concern.
 * No-ops without a 2d context (jsdom / unsupported) so components stay mountable.
 */
export function useResizableCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onResize: ResizeHandler,
  options: ResizableCanvasOptions = {},
): void {
  const { maxDpr = MAX_DPR } = options;
  // Hold the latest handler in a ref so a fresh closure each render doesn't tear
  // down and rebuild the resize listener.
  const handlerRef = useRef(onResize);
  handlerRef.current = onResize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported — nothing to size.

    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      handlerRef.current(ctx, width, height, dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [canvasRef, maxDpr]);
}
