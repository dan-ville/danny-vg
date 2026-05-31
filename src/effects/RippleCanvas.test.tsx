import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RippleCanvas } from './RippleCanvas';

describe('RippleCanvas', () => {
  it('renders a decorative canvas layered above the background, below the foreground', () => {
    const { container } = render(<RippleCanvas />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // Pure decoration — hidden from the a11y tree.
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    // Pinned to the viewport.
    expect(canvas!.className).toContain('fixed');
    expect(canvas!.className).toContain('inset-0');
    // Must never intercept taps meant for the cards/orb above it.
    expect(canvas!.className).toContain('pointer-events-none');
  });

  it('mounts and unmounts cleanly even without a 2d context (jsdom)', () => {
    const { unmount } = render(<RippleCanvas />);
    expect(() => unmount()).not.toThrow();
  });

  // jsdom has no PointerEvent constructor; a MouseEvent typed 'pointerdown'
  // carries the same clientX/clientY/target the listener reads.
  const tap = (clientX: number, clientY: number) =>
    window.dispatchEvent(new MouseEvent('pointerdown', { clientX, clientY, bubbles: true }));

  it('does not throw when a background tap occurs', () => {
    render(<RippleCanvas />);
    expect(() => tap(50, 60)).not.toThrow();
  });

  it('removes its global listener on unmount', () => {
    const { unmount } = render(<RippleCanvas />);
    unmount();
    // A tap after unmount must not throw (listener is gone, canvas detached).
    expect(() => tap(10, 10)).not.toThrow();
  });
});
