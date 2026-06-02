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
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('renders no ripple on galaxy — the gravity well is the galaxy effect', () => {
    const { container } = renderStage(); // default theme is galaxy
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('renders the ripple canvas on a non-galaxy theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'matrix');
    const { container } = renderStage();
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('mounts the ripple when cycling away from galaxy', async () => {
    const user = userEvent.setup();
    const { container } = renderStage(); // galaxy → matrix
    expect(container.querySelector('canvas')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'cycle' }));
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
