import { siInstagram, siTiktok } from 'simple-icons';
import type { BrandIcon } from '../components/LinkCard';

export interface LinkItem {
  label: string;
  href: string;
  icon: BrandIcon;
}

/**
 * Launch links. Layout handles 2–8 items with zero rework — add entries here.
 * TODO(danny): replace placeholder `#` URLs with real profile URLs.
 */
export const links: LinkItem[] = [
  { label: 'Instagram', href: '#', icon: siInstagram },
  { label: 'TikTok', href: '#', icon: siTiktok },
];
