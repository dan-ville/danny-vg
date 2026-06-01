import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CursorProvider } from '../context/CursorContext';
import { CursorPicker } from './CursorPicker';
import { CURSOR_STORAGE_KEY } from '../effects/cursor';

/** Stub matchMedia so a query that mentions `hover` reports the given capability. */
function stubHover(hoverCapable: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('hover') ? hoverCapable : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  );
}

function renderPicker() {
  return render(
    <CursorProvider>
      <CursorPicker />
    </CursorProvider>,
  );
}

describe('CursorPicker', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-cursor');
    stubHover(true); // default: desktop / hover-capable
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.removeAttribute('data-cursor');
  });

  it('renders one sprite tile per cursor on hover-capable devices', () => {
    renderPicker();
    const tiles = screen.getAllByRole('button');
    expect(tiles).toHaveLength(3);
    tiles.forEach((tile) => expect(tile.querySelector('svg')).not.toBeNull());
  });

  it('marks the active cursor tile with aria-pressed', () => {
    localStorage.setItem(CURSOR_STORAGE_KEY, 'bow');
    renderPicker();
    expect(screen.getByLabelText('Use bow cursor')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Use sword cursor')).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the active cursor when a tile is clicked', () => {
    renderPicker();
    fireEvent.click(screen.getByLabelText('Use staff cursor'));
    expect(screen.getByLabelText('Use staff cursor')).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(CURSOR_STORAGE_KEY)).toBe('staff');
  });

  it('does not render on touch (no-hover) devices', () => {
    stubHover(false);
    renderPicker();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
