import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
