import { useEffect, useRef } from 'react';

/**
 * Upper bound on a single frame's delta (seconds). A backgrounded or stalled
 * tab can produce a multi-second gap between frames; clamping keeps animations
 * from teleporting forward on resume (spec §11).
 */
export const DEFAULT_MAX_DT = 0.05;

/** Receives the clamped time since the previous frame, in seconds. */
export type FrameCallback = (dtSeconds: number) => void;

export interface AnimationLoopOptions {
  /** Per-frame delta cap in seconds. Defaults to {@link DEFAULT_MAX_DT}. */
  maxDt?: number;
}

/**
 * Continuous requestAnimationFrame loop shared by the always-on backgrounds
 * (galaxy, matrix). Owns dt computation + clamping and pauses itself while the
 * tab is hidden (`visibilitychange`), resuming with a fresh dt=0 frame so no
 * motion is lost or fast-forwarded. The on-demand ripple loop keeps its own
 * scheduler since it idles between taps.
 *
 * The callback is held in a ref so a new closure each render doesn't tear the
 * loop down; only `maxDt` resubscribes.
 */
export function useAnimationLoop(onFrame: FrameCallback, options: AnimationLoopOptions = {}): void {
  const { maxDt = DEFAULT_MAX_DT } = options;
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, maxDt) : 0;
      last = now;
      frameRef.current(dt);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf === 0) {
        last = 0; // resume fresh so the first frame back has dt=0
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [maxDt]);
}
