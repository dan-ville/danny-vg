import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MatrixBackground } from './MatrixBackground';

describe('MatrixBackground', () => {
  it('renders a decorative full-bleed canvas behind the foreground', () => {
    const { container } = render(<MatrixBackground />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // Pure decoration — hidden from the a11y tree.
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    // Pinned to the viewport, sitting behind the z-10 foreground.
    expect(canvas!.className).toContain('fixed');
    expect(canvas!.className).toContain('inset-0');
    // Black rain base so the canvas reads as Matrix even before glyphs paint.
    expect(canvas!.className).toContain('matrix-bg');
  });

  it('mounts and unmounts cleanly even without a 2d context (jsdom)', () => {
    // jsdom returns null from getContext('2d'); the component must not throw.
    const { unmount } = render(<MatrixBackground />);
    expect(() => unmount()).not.toThrow();
  });
});
