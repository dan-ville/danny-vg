import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';

// App reads the theme (background stage + orb), so it needs the provider —
// exactly as main.tsx mounts it in production.
const renderApp = () =>
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );

describe('App', () => {
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

  it('mounts the ripple effect layer above the background, below the foreground', () => {
    const { container } = renderApp();
    const ripple = container.querySelector('canvas.pointer-events-none');
    expect(ripple).not.toBeNull();
    expect(ripple!.className).toContain('z-0'); // between -z-10 bg and z-10 content
  });
});
