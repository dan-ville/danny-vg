import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LinkCard } from './LinkCard';

const fakeIcon = { title: 'Instagram', path: 'M0 0h24v24H0z' };

describe('LinkCard', () => {
  it('renders a link to the given href with the label', () => {
    render(<LinkCard label="Instagram" href="https://instagram.com/x" icon={fakeIcon} />);
    const link = screen.getByRole('link', { name: /instagram/i });
    expect(link).toHaveAttribute('href', 'https://instagram.com/x');
  });

  it('opens in the same tab (no target=_blank)', () => {
    render(<LinkCard label="TikTok" href="#" icon={fakeIcon} />);
    const link = screen.getByRole('link', { name: /tiktok/i });
    expect(link).not.toHaveAttribute('target');
  });

  it('renders the brand icon as inline svg using the icon path', () => {
    const { container } = render(<LinkCard label="Instagram" href="#" icon={fakeIcon} />);
    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute('d', fakeIcon.path);
  });

  describe('hover tilt', () => {
    let raf: { mockRestore: () => void };

    beforeEach(() => {
      // Run rAF callbacks synchronously so tilt state settles within the test.
      raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 1;
      });
    });

    afterEach(() => {
      raf.mockRestore();
      vi.restoreAllMocks();
    });

    // jsdom's PointerEvent ignores clientX/clientY in its init dict, so define
    // them explicitly on a real bubbling event and let it flow to React.
    function pointerMoveAt(target: Element, clientX: number, clientY: number) {
      // jsdom lacks PointerEvent; a MouseEvent typed 'pointermove' still
      // triggers React's onPointerMove and carries clientX/clientY.
      const ev = new MouseEvent('pointermove', { bubbles: true, clientX, clientY });
      fireEvent(target, ev);
    }

    function withHover(matches: boolean) {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query.includes('hover') ? matches : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList);
    }

    it('applies a 3D rotate transform on pointer move when hover-capable', () => {
      withHover(true);
      render(<LinkCard label="Instagram" href="#" icon={fakeIcon} />);
      const link = screen.getByRole('link', { name: /instagram/i });
      vi.spyOn(link, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 200,
        height: 64,
        right: 200,
        bottom: 64,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      pointerMoveAt(link, 200, 0);
      expect(link.style.transform).toMatch(/rotateY\(8deg\)/);
      expect(link.style.transform).toMatch(/rotateX\(8deg\)/);

      fireEvent.pointerLeave(link);
      expect(link.style.transform).toMatch(/rotateX\(0deg\) rotateY\(0deg\)/);
    });

    it('does not tilt on touch devices (no hover capability)', () => {
      withHover(false);
      render(<LinkCard label="TikTok" href="#" icon={fakeIcon} />);
      const link = screen.getByRole('link', { name: /tiktok/i });
      pointerMoveAt(link, 50, 10);
      expect(link.style.transform).toBe('');
    });
  });
});
