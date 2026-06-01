import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CursorProvider } from '../context/CursorContext';
import { FantasyCursor } from './FantasyCursor';
import { CURSOR_STORAGE_KEY } from './cursor';

// Controlled requestAnimationFrame so frames flush deterministically in jsdom.
let frameCallbacks: FrameRequestCallback[] = [];

function flushFrame() {
  const pending = frameCallbacks;
  frameCallbacks = [];
  act(() => {
    pending.forEach((cb) => cb(0));
  });
}

/** Stub matchMedia so a query that mentions `hover` reports the given capability. */
function stubHover(hoverCapable: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('hover') ? hoverCapable : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  );
}

function renderCursor() {
  return render(
    <CursorProvider>
      <FantasyCursor />
    </CursorProvider>,
  );
}

describe('FantasyCursor', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-cursor');
    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    stubHover(true); // default: desktop / hover-capable
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.removeAttribute('data-cursor');
  });

  it('renders an SVG sprite for the active cursor on hover-capable devices', () => {
    renderCursor();
    const el = screen.getByTestId('fantasy-cursor');
    expect(el).toHaveAttribute('data-cursor', 'sword');
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('paints the sprite matching the persisted cursor', () => {
    localStorage.setItem(CURSOR_STORAGE_KEY, 'staff');
    renderCursor();
    expect(screen.getByTestId('fantasy-cursor')).toHaveAttribute('data-cursor', 'staff');
  });

  it('follows the pointer by applying a translate3d transform', () => {
    renderCursor();
    const el = screen.getByTestId('fantasy-cursor');

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 140, clientY: 90 }));
    });
    flushFrame();

    // First frame snaps directly onto the pointer position.
    expect(el.style.transform).toContain('translate3d(140px, 90px, 0)');
  });

  it('does not render on touch (no-hover) devices', () => {
    stubHover(false);
    renderCursor();
    expect(screen.queryByTestId('fantasy-cursor')).toBeNull();
  });

  it('removes its pointer listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderCursor();
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
  });
});
