import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProfileHeader } from './ProfileHeader';

describe('ProfileHeader', () => {
  it('renders the display name as a heading', () => {
    render(<ProfileHeader name="Danny VG" initials="DV" />);
    expect(screen.getByRole('heading', { name: 'Danny VG' })).toBeInTheDocument();
  });

  it('renders the initials inside the avatar', () => {
    render(<ProfileHeader name="Danny VG" initials="DV" />);
    expect(screen.getByText('DV')).toBeInTheDocument();
  });
});
