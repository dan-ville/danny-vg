import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MotionProvider } from '../context/MotionContext';
import { KittyBackground } from './KittyBackground';

// KittyBackground reads the resolved motion preference, so it needs MotionProvider.
const renderBg = () =>
  render(
    <MotionProvider>
      <KittyBackground />
    </MotionProvider>,
  );

describe('KittyBackground', () => {
  // MotionProvider probes prefers-reduced-motion; jsdom ships no matchMedia.
  beforeAll(() => {
    if (typeof window.matchMedia !== 'function') {
      window.matchMedia = (() => ({
        matches: false,
        media: '',
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
        onchange: null,
      })) as unknown as typeof window.matchMedia;
    }
  });

  it('renders a decorative full-bleed canvas behind the foreground', () => {
    const { container } = renderBg();
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas!.className).toContain('kitty-bg');
    expect(canvas!.className).toContain('fixed');
    expect(canvas!.className).toContain('inset-0');
  });

  it('mounts and unmounts cleanly even without a 2d context (jsdom)', () => {
    const { unmount } = renderBg();
    expect(() => unmount()).not.toThrow();
  });

  it('listens for background taps so a click can trigger a pounce', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const { unmount } = renderBg();
    const types = add.mock.calls.map((call) => call[0]);
    expect(types).toContain('pointerdown');
    unmount();
    add.mockRestore();
  });

  it('removes its pounce listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderBg();
    unmount();
    const types = remove.mock.calls.map((call) => call[0]);
    expect(types).toContain('pointerdown');
    remove.mockRestore();
  });
});
