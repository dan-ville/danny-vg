import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { THEME_STORAGE_KEY } from '../context/theme';
import { EffectStage } from './EffectStage';

/** Drives a theme change from inside the provider so the stage can react. */
function CycleButton() {
  const { cycleTheme } = useTheme();
  return (
    <button type="button" onClick={cycleTheme}>
      cycle
    </button>
  );
}

function renderStage() {
  return render(
    <ThemeProvider>
      <EffectStage />
      <CycleButton />
    </ThemeProvider>,
  );
}

describe('EffectStage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/'); // provider writes ?theme=; keep tests isolated
  });
  afterEach(() => localStorage.clear());

  it('renders no ripple on galaxy — the gravity well is the galaxy effect', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'galaxy');
    const { container } = renderStage();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('renders no overlay on matrix — the shockwave-decode is the matrix effect', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'matrix');
    const { container } = renderStage();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('renders no overlay on kitty — the cat pounce is the kitty effect', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'kitty');
    const { container } = renderStage();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('renders the smoke canvas on rainbow', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'rainbow');
    const { container } = renderStage();
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('mounts the smoke only once cycling reaches rainbow', async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_STORAGE_KEY, 'galaxy');
    const { container } = renderStage(); // galaxy
    expect(container.querySelector('canvas')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'cycle' })); // → matrix
    expect(container.querySelector('canvas')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'cycle' })); // → rainbow
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
