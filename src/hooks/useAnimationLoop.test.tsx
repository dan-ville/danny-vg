import { render, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAX_DT, useAnimationLoop, type FrameCallback } from './useAnimationLoop';

function Harness({ onFrame }: { onFrame: FrameCallback }) {
  useAnimationLoop(onFrame);
  return null;
}

let pending: Map<number, FrameRequestCallback>;
let nextId: number;

/** Run every currently-scheduled frame at timestamp `now`; reschedules land in the next batch. */
function step(now: number) {
  const batch = [...pending.values()];
  pending.clear();
  act(() => {
    for (const cb of batch) cb(now);
  });
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('useAnimationLoop', () => {
  beforeEach(() => {
    pending = new Map();
    nextId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      pending.delete(id);
    });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts the loop on mount and passes dt=0 on the first frame', () => {
    const onFrame = vi.fn();
    render(<Harness onFrame={onFrame} />);

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    step(1000);
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenLastCalledWith(0);
  });

  it('computes dt in seconds between frames', () => {
    const onFrame = vi.fn();
    render(<Harness onFrame={onFrame} />);

    step(1000); // first: dt 0
    step(1016); // +16ms
    expect(onFrame).toHaveBeenLastCalledWith(0.016);
  });

  it('clamps dt so a long gap does not snap animations forward', () => {
    const onFrame = vi.fn();
    render(<Harness onFrame={onFrame} />);

    step(1000); // dt 0
    step(2000); // +1000ms -> clamped
    expect(onFrame).toHaveBeenLastCalledWith(DEFAULT_MAX_DT);
  });

  it('pauses the loop while the tab is hidden and resumes (dt=0) when visible', () => {
    const onFrame = vi.fn();
    render(<Harness onFrame={onFrame} />);
    step(1000);
    onFrame.mockClear();

    setHidden(true);
    expect(pending.size).toBe(0); // pending frame cancelled
    step(5000); // nothing scheduled — no-op
    expect(onFrame).not.toHaveBeenCalled();

    setHidden(false);
    expect(pending.size).toBe(1); // loop restarted
    step(9000); // resume frame: dt reset to 0, no teleport
    expect(onFrame).toHaveBeenLastCalledWith(0);
  });

  it('cancels the frame and detaches the visibility listener on unmount', () => {
    const onFrame = vi.fn();
    const { unmount } = render(<Harness onFrame={onFrame} />);
    unmount();

    expect(pending.size).toBe(0);
    onFrame.mockClear();
    setHidden(false); // listener gone — must not restart
    expect(pending.size).toBe(0);
    expect(onFrame).not.toHaveBeenCalled();
  });
});
