import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VisibilityToggle } from './VisibilityToggle';

describe('VisibilityToggle', () => {
  it('renders a native button labelled for the current state', () => {
    render(<VisibilityToggle hidden={false} onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: /hide page content/i });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('flips its label and aria-pressed when hidden', () => {
    render(<VisibilityToggle hidden onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: /show page content/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('fires onToggle on click', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<VisibilityToggle hidden={false} onToggle={onToggle} />);
    await user.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
