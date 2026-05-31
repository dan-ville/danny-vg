import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
