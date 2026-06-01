import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_DPR, useResizableCanvas, type ResizeHandler } from './useResizableCanvas';

/**
 * Drives the hook with a plain canvas ref. `getContext` is stubbed on the
 * prototype in beforeEach so the effect sees a 2d context (jsdom returns null).
 */
function Harness({ onResize }: { onResize: ResizeHandler }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useResizableCanvas(ref, onResize);
  return <canvas ref={ref} />;
}

const setViewport = (w: number, h: number) => {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
};

describe('useResizableCanvas', () => {
  let ctx: { setTransform: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    ctx = { setTransform: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    setViewport(800, 600);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sizes the backing buffer to CSS px × clamped DPR and reports CSS dimensions', () => {
    const onResize = vi.fn();
    const { container } = render(<Harness onResize={onResize} />);
    const canvas = container.querySelector('canvas')!;

    // devicePixelRatio 3 is clamped to MAX_DPR (2).
    expect(MAX_DPR).toBe(2);
    expect(canvas.width).toBe(1600); // 800 * 2
    expect(canvas.height).toBe(1200); // 600 * 2
    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('600px');
    // Drawing is done in CSS px via the DPR transform.
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    // Handler receives the live context + current CSS dimensions + clamped DPR.
    expect(onResize).toHaveBeenCalledWith(ctx, 800, 600, 2);
  });

  it('re-runs the handler on window resize / orientation change', () => {
    const onResize = vi.fn();
    render(<Harness onResize={onResize} />);
    onResize.mockClear();

    setViewport(1024, 400);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(onResize).toHaveBeenCalledWith(ctx, 1024, 400, 2);
  });

  it('removes its resize listener on unmount', () => {
    const onResize = vi.fn();
    const { unmount } = render(<Harness onResize={onResize} />);
    unmount();
    onResize.mockClear();

    setViewport(500, 500);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('no-ops without a 2d context (jsdom / unsupported)', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onResize = vi.fn();
    expect(() => render(<Harness onResize={onResize} />)).not.toThrow();
    expect(onResize).not.toHaveBeenCalled();
  });
});
