import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MotionProvider, useMotion, useReducedMotion } from './MotionContext';
import { MOTION_STORAGE_KEY } from './motion';

/**
 * jsdom (our setup.ts) ships no window.matchMedia, so each test installs a
 * controllable mock. `set(matches)` flips the OS preference and dispatches a
 * `change` to every registered listener, letting us prove the provider reacts
 * to live `prefers-reduced-motion` changes.
 */
function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    // Legacy fallbacks some libs probe for; unused here but keep the shape honest.
    addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeListener: (cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    dispatchEvent: () => true,
    onchange: null,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
    },
  };
}

function Probe() {
  const { setting, reducedMotion, toggleMotion, setMotion } = useMotion();
  const hookReduced = useReducedMotion();
  return (
    <div>
      <span data-testid="setting">{setting}</span>
      <span data-testid="reduced">{String(reducedMotion)}</span>
      <span data-testid="hook">{String(hookReduced)}</span>
      <button onClick={toggleMotion}>toggle</button>
      <button onClick={() => setMotion('reduce')}>force-reduce</button>
    </div>
  );
}

const dataMotion = () => document.documentElement.getAttribute('data-motion');

describe('MotionProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-motion');
  });
  afterEach(() => {
    localStorage.clear();
    // @ts-expect-error – remove the per-test mock so nothing leaks across files.
    delete window.matchMedia;
  });

  it('defaults to system and resolves to full motion when the OS has no preference', () => {
    installMatchMedia(false);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId('setting')).toHaveTextContent('system');
    expect(screen.getByTestId('reduced')).toHaveTextContent('false');
    expect(screen.getByTestId('hook')).toHaveTextContent('false');
    expect(dataMotion()).toBe('full');
  });

  it('honours the OS prefers-reduced-motion while on the system setting', () => {
    installMatchMedia(true);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId('reduced')).toHaveTextContent('true');
    expect(dataMotion()).toBe('reduce');
  });

  it('hydrates an explicit setting from localStorage and overrides the OS', () => {
    installMatchMedia(true); // OS wants reduce…
    localStorage.setItem(MOTION_STORAGE_KEY, 'full'); // …but the user forced full.
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId('setting')).toHaveTextContent('full');
    expect(screen.getByTestId('reduced')).toHaveTextContent('false');
    expect(dataMotion()).toBe('full');
  });

  it('toggles the resolved state and persists the explicit choice', async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('setting')).toHaveTextContent('reduce');
    expect(screen.getByTestId('reduced')).toHaveTextContent('true');
    expect(dataMotion()).toBe('reduce');
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe('reduce');
  });

  it('sets a setting directly', async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'force-reduce' }));
    expect(screen.getByTestId('setting')).toHaveTextContent('reduce');
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe('reduce');
  });

  it('reacts live to an OS preference change while on the system setting', () => {
    const media = installMatchMedia(false);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId('reduced')).toHaveTextContent('false');
    act(() => media.set(true));
    expect(screen.getByTestId('reduced')).toHaveTextContent('true');
    expect(dataMotion()).toBe('reduce');
  });

  it('throws if the hooks are used outside the provider', () => {
    const Bare = () => {
      useReducedMotion();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/MotionProvider/);
  });
});
