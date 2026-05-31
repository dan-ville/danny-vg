import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CursorProvider, useCursor } from './CursorContext';
import { CURSOR_STORAGE_KEY } from '../effects/cursor';

function Probe() {
  const { cursor, cycleCursor, setCursor } = useCursor();
  return (
    <div>
      <span data-testid="cursor">{cursor}</span>
      <button onClick={cycleCursor}>cycle</button>
      <button onClick={() => setCursor('staff')}>set-staff</button>
    </div>
  );
}

const dataCursor = () => document.documentElement.getAttribute('data-cursor');

describe('CursorProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-cursor');
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to the sword cursor and mirrors it onto the root', () => {
    render(
      <CursorProvider>
        <Probe />
      </CursorProvider>,
    );
    expect(screen.getByTestId('cursor')).toHaveTextContent('sword');
    expect(dataCursor()).toBe('sword');
  });

  it('hydrates a persisted cursor from localStorage', () => {
    localStorage.setItem(CURSOR_STORAGE_KEY, 'bow');
    render(
      <CursorProvider>
        <Probe />
      </CursorProvider>,
    );
    expect(screen.getByTestId('cursor')).toHaveTextContent('bow');
    expect(dataCursor()).toBe('bow');
  });

  it('falls back to the default when the stored value is corrupt', () => {
    localStorage.setItem(CURSOR_STORAGE_KEY, 'trebuchet');
    render(
      <CursorProvider>
        <Probe />
      </CursorProvider>,
    );
    expect(screen.getByTestId('cursor')).toHaveTextContent('sword');
  });

  it('cycles sword -> bow -> staff -> sword and persists each step', async () => {
    const user = userEvent.setup();
    render(
      <CursorProvider>
        <Probe />
      </CursorProvider>,
    );
    const cycle = screen.getByRole('button', { name: 'cycle' });

    await user.click(cycle);
    expect(screen.getByTestId('cursor')).toHaveTextContent('bow');
    expect(dataCursor()).toBe('bow');
    expect(localStorage.getItem(CURSOR_STORAGE_KEY)).toBe('bow');

    await user.click(cycle);
    expect(screen.getByTestId('cursor')).toHaveTextContent('staff');

    await user.click(cycle);
    expect(screen.getByTestId('cursor')).toHaveTextContent('sword');
    expect(localStorage.getItem(CURSOR_STORAGE_KEY)).toBe('sword');
  });

  it('sets a cursor directly and persists it', async () => {
    const user = userEvent.setup();
    render(
      <CursorProvider>
        <Probe />
      </CursorProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'set-staff' }));
    expect(screen.getByTestId('cursor')).toHaveTextContent('staff');
    expect(dataCursor()).toBe('staff');
    expect(localStorage.getItem(CURSOR_STORAGE_KEY)).toBe('staff');
  });

  it('throws if useCursor is used outside the provider', () => {
    const Bare = () => {
      useCursor();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/CursorProvider/);
  });
});
