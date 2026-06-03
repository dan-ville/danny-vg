import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';
import { THEME_ACCENTS, THEME_STORAGE_KEY } from './theme';

function Probe() {
  const { theme, cycleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={cycleTheme}>cycle</button>
      <button onClick={() => setTheme('rainbow')}>rainbow</button>
    </div>
  );
}

const accentVar = () => document.documentElement.style.getPropertyValue('--accent').trim();
const dataTheme = () => document.documentElement.getAttribute('data-theme');

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/'); // the provider writes ?theme=; reset between tests
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-2');
  });
  afterEach(() => localStorage.clear());

  it('starts on the default (rainbow) and applies its accent + data-theme to the root', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('rainbow');
    expect(dataTheme()).toBe('rainbow');
    expect(accentVar()).toBe(THEME_ACCENTS.rainbow.accent);
  });

  it('lets a ?theme= URL param override localStorage and reflects it in the address bar', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'galaxy'); // stored choice...
    window.history.replaceState(null, '', '/?theme=kitty'); // ...overridden by the link
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('kitty');
    expect(dataTheme()).toBe('kitty');
    expect(window.location.search).toBe('?theme=kitty');
  });

  it('hydrates the initial theme from localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'matrix');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('matrix');
    expect(dataTheme()).toBe('matrix');
  });

  it('cycles the theme, updating the root vars and persisting the choice', async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_STORAGE_KEY, 'galaxy'); // start from a known point in the cycle
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'cycle' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('matrix');
    expect(dataTheme()).toBe('matrix');
    expect(accentVar()).toBe(THEME_ACCENTS.matrix.accent);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('matrix');
    expect(window.location.search).toBe('?theme=matrix'); // address bar stays shareable
  });

  it('sets a theme directly', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'rainbow' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('rainbow');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('rainbow');
  });

  it('throws if useTheme is used outside the provider', () => {
    const Bare = () => {
      useTheme();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/ThemeProvider/);
  });
});
