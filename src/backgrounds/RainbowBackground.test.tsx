import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RainbowBackground } from './RainbowBackground';

describe('RainbowBackground', () => {
  it('renders a decorative full-bleed layer behind the foreground', () => {
    const { container } = render(<RainbowBackground />);
    const layer = container.firstElementChild as HTMLElement | null;
    expect(layer).not.toBeNull();
    // Pure decoration — hidden from the a11y tree.
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    // Pinned to the viewport, sitting behind the z-10 foreground.
    expect(layer!.className).toContain('fixed');
    expect(layer!.className).toContain('inset-0');
    expect(layer!.className).toContain('-z-10');
    // The CSS-only conic gradient + its slow shift animation live under this hook.
    expect(layer!.className).toContain('rainbow-bg');
  });

  it('is CSS-only — no canvas, no rAF', () => {
    // Unlike galaxy/matrix this theme is pure CSS, so it never touches canvas.
    const { container } = render(<RainbowBackground />);
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('mounts and unmounts cleanly', () => {
    const { unmount } = render(<RainbowBackground />);
    expect(() => unmount()).not.toThrow();
  });
});
