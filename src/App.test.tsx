import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { THEME_STORAGE_KEY } from './context/theme';
import { MotionProvider } from './context/MotionContext';

// App reads the theme (background stage + orb) and motion (toggle), so it needs
// both providers — exactly as main.tsx mounts them in production. The theme-driven
// cursor reads the theme too, but needs no provider of its own.
const renderApp = () =>
  render(
    <MotionProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </MotionProvider>,
  );

describe('App', () => {
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
  it('shows the display name', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Danny VG' })).toBeInTheDocument();
  });

  it('renders both launch links', () => {
    renderApp();
    expect(screen.getByRole('link', { name: /instagram/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tiktok/i })).toBeInTheDocument();
  });

  it('renders the theme orb switcher', () => {
    renderApp();
    expect(screen.getByRole('button', { name: /switch theme/i })).toBeInTheDocument();
  });

  it('conceals the chrome when the visibility toggle is pressed', async () => {
    const user = userEvent.setup();
    renderApp();
    const nav = screen.getByRole('navigation');
    const header = screen.getByRole('heading', { name: 'Danny VG' }).closest('header')!;
    const orb = screen.getByRole('button', { name: /switch theme/i });
    // Visible to start: nothing concealed, no aria-hidden.
    expect(nav.className).not.toContain('concealable--off');
    expect(nav).not.toHaveAttribute('aria-hidden');

    await user.click(screen.getByRole('button', { name: /hide page content/i }));

    // Links, profile header, and the theme orb all fade out; only the
    // visibility toggle remains to bring them back.
    expect(nav.className).toContain('concealable--off');
    expect(nav).toHaveAttribute('aria-hidden', 'true');
    expect(header.className).toContain('concealable--off');
    expect(orb.className).toContain('concealable--off');
    expect(screen.getByRole('button', { name: /show page content/i })).toBeInTheDocument();

    // Toggling back reveals everything again.
    await user.click(screen.getByRole('button', { name: /show page content/i }));
    expect(nav.className).not.toContain('concealable--off');
    expect(nav).not.toHaveAttribute('aria-hidden');
    expect(orb.className).not.toContain('concealable--off');
  });

  // The theme provider writes ?theme= to the URL; reset both so a leaked param
  // can't override the next test's localStorage-seeded theme.
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  // The smoke/ripple effect layer sits at z-0; the always-mounted theme cursor
  // also carries `pointer-events-none` but at z-50, so we key off z-0 to identify
  // the effect layer specifically.
  it('mounts no smoke layer on galaxy — its effect is the gravity well', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'galaxy');
    const { container } = renderApp();
    expect(container.querySelector('canvas.z-0')).toBeNull();
  });

  it('mounts the smoke effect layer at z-0 on rainbow (matrix has its own shockwave)', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'rainbow');
    const { container } = renderApp();
    const ripple = container.querySelector('canvas.z-0'); // between -z-10 bg and z-10 content
    expect(ripple).not.toBeNull();
    expect(ripple!.className).toContain('pointer-events-none');
  });
});
