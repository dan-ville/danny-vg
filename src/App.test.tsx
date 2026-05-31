import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('shows the display name', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Danny VG' })).toBeInTheDocument();
  });

  it('renders both launch links', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /instagram/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tiktok/i })).toBeInTheDocument();
  });

  it('mounts the ripple effect layer above the background, below the foreground', () => {
    const { container } = render(<App />);
    const ripple = container.querySelector('canvas.pointer-events-none');
    expect(ripple).not.toBeNull();
    expect(ripple!.className).toContain('z-0'); // between -z-10 bg and z-10 content
  });
});
