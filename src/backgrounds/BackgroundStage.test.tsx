import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { THEME_STORAGE_KEY } from '../context/theme';
import { BackgroundStage } from './BackgroundStage';

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
      <BackgroundStage />
      <CycleButton />
    </ThemeProvider>,
  );
}

describe('BackgroundStage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('renders only the galaxy background by default', () => {
    const { container } = renderStage();
    expect(container.querySelector('.galaxy-bg')).not.toBeNull();
    expect(container.querySelector('.matrix-bg')).toBeNull();
    expect(container.querySelector('.rainbow-bg')).toBeNull();
  });

  it('renders the persisted theme background on mount', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'rainbow');
    const { container } = renderStage();
    expect(container.querySelector('.rainbow-bg')).not.toBeNull();
    expect(container.querySelector('.galaxy-bg')).toBeNull();
  });

  it('crossfades on theme change — outgoing and incoming layers briefly coexist', async () => {
    const user = userEvent.setup();
    const { container } = renderStage();
    await user.click(screen.getByRole('button', { name: 'cycle' }));
    // The old galaxy layer lingers (fading) while the new matrix layer fades in.
    expect(container.querySelector('.galaxy-bg')).not.toBeNull();
    expect(container.querySelector('.matrix-bg')).not.toBeNull();
    // The incoming top layer carries the crossfade-in animation hook.
    expect(container.querySelector('.bg-crossfade-enter .matrix-bg')).not.toBeNull();
  });

  it('keeps every background layer out of the a11y tree', () => {
    const { container } = renderStage();
    const stage = container.firstElementChild as HTMLElement;
    expect(stage).toHaveAttribute('aria-hidden', 'true');
  });
});
