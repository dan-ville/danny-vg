import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { THEME_STORAGE_KEY } from './context/theme';
import { MotionProvider } from './context/MotionContext';
import { CursorProvider } from './context/CursorContext';

// App reads the theme (background stage + orb), motion (toggle), and cursor
// (fantasy cursor), so it needs all three providers — exactly as main.tsx mounts
// them in production.
const renderApp = () =>
  render(
    <MotionProvider>
      <ThemeProvider>
        <CursorProvider>
          <App />
        </CursorProvider>
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

  afterEach(() => localStorage.clear());

  it('mounts no ripple on the default galaxy theme — its effect is the gravity well', () => {
    const { container } = renderApp();
    expect(container.querySelector('canvas.pointer-events-none')).toBeNull();
  });

  it('mounts the ripple effect layer at z-0 on a non-galaxy theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'matrix');
    const { container } = renderApp();
    const ripple = container.querySelector('canvas.pointer-events-none');
    expect(ripple).not.toBeNull();
    expect(ripple!.className).toContain('z-0'); // between -z-10 bg and z-10 content
  });
});
