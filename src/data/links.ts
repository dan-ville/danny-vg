import { siInstagram, siTiktok } from 'simple-icons';
import type { BrandIcon } from '../components/LinkCard';

export interface LinkItem {
  label: string;
  href: string;
  icon: BrandIcon;
}

/**
 * Launch links. Layout handles 2–8 items with zero rework — add entries here.
 */
export const links: LinkItem[] = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/dvnnyvg/",
    icon: siInstagram,
  },
  { label: "TikTok", href: "https://www.tiktok.com/@dvnnyvg", icon: siTiktok },
]
