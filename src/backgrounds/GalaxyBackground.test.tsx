import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GalaxyBackground } from './GalaxyBackground';

describe('GalaxyBackground', () => {
  it('renders a decorative full-bleed canvas behind the foreground', () => {
    const { container } = render(<GalaxyBackground />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // Hidden from the a11y tree — it is pure decoration.
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    // Pinned to the viewport and sitting behind the z-10 foreground.
    expect(canvas!.className).toContain('fixed');
    expect(canvas!.className).toContain('inset-0');
  });

  it('mounts and unmounts cleanly even without a 2d context (jsdom)', () => {
    // jsdom returns null from getContext('2d'); the component must not throw.
    const { unmount } = render(<GalaxyBackground />);
    expect(() => unmount()).not.toThrow();
  });

  it('listens for background taps so they can spawn a gravity well', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const { unmount } = render(<GalaxyBackground />);
    const types = add.mock.calls.map((call) => call[0]);
    expect(types).toContain('pointerdown');
    unmount();
    add.mockRestore();
  });

  it('removes its background-tap listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<GalaxyBackground />);
    unmount();
    const types = remove.mock.calls.map((call) => call[0]);
    expect(types).toContain('pointerdown');
    remove.mockRestore();
  });

  it('tracks pointer move and release so the well can be dragged and let go', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const { unmount } = render(<GalaxyBackground />);
    const types = add.mock.calls.map((call) => call[0]);
    expect(types).toContain('pointermove');
    expect(types).toContain('pointerup');
    expect(types).toContain('pointercancel');
    unmount();
    add.mockRestore();
  });

  it('removes the drag/release listeners on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<GalaxyBackground />);
    unmount();
    const types = remove.mock.calls.map((call) => call[0]);
    expect(types).toContain('pointermove');
    expect(types).toContain('pointerup');
    expect(types).toContain('pointercancel');
    remove.mockRestore();
  });
});
