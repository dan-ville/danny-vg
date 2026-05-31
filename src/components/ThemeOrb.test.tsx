import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext';
import { THEME_STORAGE_KEY } from '../context/theme';
import { ThemeOrb } from './ThemeOrb';

function renderOrb() {
  return render(
    <ThemeProvider>
      <ThemeOrb />
    </ThemeProvider>,
  );
}

describe('ThemeOrb', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('exposes a native button whose accessible name reflects the active theme', () => {
    renderOrb();
    const orb = screen.getByRole('button', { name: /galaxy/i });
    expect(orb.tagName).toBe('BUTTON');
    expect(orb).toHaveAttribute('type', 'button');
  });

  it('cycles galaxy → matrix → rainbow → galaxy on click', async () => {
    const user = userEvent.setup();
    renderOrb();
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: /matrix/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: /rainbow/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: /galaxy/i })).toBeInTheDocument();
  });

  it('persists the chosen theme to localStorage', async () => {
    const user = userEvent.setup();
    renderOrb();
    await user.click(screen.getByRole('button'));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('matrix');
  });
});
