import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MotionProvider } from '../context/MotionContext';
import { MOTION_STORAGE_KEY } from '../context/motion';
import { MotionToggle } from './MotionToggle';

// jsdom has no matchMedia; pin the OS to "no preference" so the toggle starts on full.
function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  }) as unknown as typeof window.matchMedia;
}

function renderToggle() {
  return render(
    <MotionProvider>
      <MotionToggle />
    </MotionProvider>,
  );
}

describe('MotionToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    stubMatchMedia(false);
    document.documentElement.removeAttribute('data-motion');
  });
  afterEach(() => {
    localStorage.clear();
    // @ts-expect-error – clear the per-test mock.
    delete window.matchMedia;
  });

  it('renders a native button with an accessible name', () => {
    renderToggle();
    const btn = screen.getByRole('button', { name: /motion/i });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('reflects the resolved motion state via aria-pressed', () => {
    renderToggle();
    // OS=no-preference → full motion → reduced state is off.
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles reduced motion on click and persists the choice', async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe('reduce');
  });
});
