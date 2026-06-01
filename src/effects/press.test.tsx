import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTapGlow } from './press';

describe('useTapGlow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flashes an accent glow on pointer down then clears it after the glow window', () => {
    const { result } = renderHook(() => useTapGlow(true, 150));
    expect(result.current.pressed).toBe(false);
    expect(result.current.style.boxShadow).toBeUndefined();

    act(() => result.current.onPointerDown());
    expect(result.current.pressed).toBe(true);
    expect(result.current.style.boxShadow).toContain('var(--accent)');

    act(() => vi.advanceTimersByTime(150));
    expect(result.current.pressed).toBe(false);
    expect(result.current.style.boxShadow).toBeUndefined();
  });

  it('eases the glow out via a box-shadow transition while enabled', () => {
    const { result } = renderHook(() => useTapGlow(true, 150));
    expect(result.current.style.transition).toContain('box-shadow');
  });

  it('restarts the glow window when tapped again before it expires', () => {
    const { result } = renderHook(() => useTapGlow(true, 150));
    act(() => result.current.onPointerDown());
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.onPointerDown()); // re-tap resets the timer
    act(() => vi.advanceTimersByTime(100));
    // Without the reset the first window (150ms) would already have elapsed.
    expect(result.current.pressed).toBe(true);
    act(() => vi.advanceTimersByTime(50));
    expect(result.current.pressed).toBe(false);
  });

  it('is inert on hover-capable devices (disabled) — no glow, no-op handler', () => {
    const { result } = renderHook(() => useTapGlow(false, 150));
    act(() => result.current.onPointerDown());
    expect(result.current.pressed).toBe(false);
    expect(result.current.style).toEqual({});
  });
});
