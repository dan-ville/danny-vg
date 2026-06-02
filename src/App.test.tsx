import { render, screen } from '@testing-library/react';
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

  afterEach(() => localStorage.clear());

  it('mounts no ripple on the default galaxy theme — its effect is the gravity well', () => {
    const { container } = renderApp();
    expect(container.querySelector('canvas.pointer-events-none')).toBeNull();
  });

  it('mounts the smoke effect layer at z-0 on rainbow (matrix has its own vortex)', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'rainbow');
    const { container } = renderApp();
    const ripple = container.querySelector('canvas.pointer-events-none');
    expect(ripple).not.toBeNull();
    expect(ripple!.className).toContain('z-0'); // between -z-10 bg and z-10 content
  });
});
