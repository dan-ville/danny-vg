import { useHoverCapable } from '../effects/cursorSprites';
import { useTilt } from '../effects/tilt';
import { useTapGlow } from '../effects/press';

export interface BrandIcon {
  /** Human-readable brand name, e.g. "Instagram". */
  title: string;
  /** SVG path `d` attribute (24x24 viewBox), as shipped by simple-icons. */
  path: string;
}

export interface LinkCardProps {
  label: string;
  href: string;
  icon: BrandIcon;
}

/**
 * Full-width frosted-glass pill: brand icon (left), label, arrow (right).
 * Plain same-tab navigation so mobile OS deeplinks to native apps and
 * back-navigation returns cleanly. Icon + arrow tint to the active --accent.
 */
export function LinkCard({ label, href, icon }: LinkCardProps) {
  const hoverCapable = useHoverCapable();
  const tilt = useTilt(hoverCapable);
  // Desktop hovers tilt; touch taps glow — the two never run on the same device.
  const glow = useTapGlow(!hoverCapable);
  return (
    <a
      href={href}
      aria-label={label}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      onPointerDown={glow.onPointerDown}
      style={{ ...tilt.style, ...glow.style, transformStyle: 'preserve-3d', willChange: 'transform' }}
      className="link-card flex h-16 w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 backdrop-blur-md transition active:scale-[0.98]"
    >
      <svg
        role="img"
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6 shrink-0"
        style={{ fill: 'var(--accent)' }}
      >
        <path d={icon.path} />
      </svg>
      <span className="flex-1 text-base font-medium">{label}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0"
        style={{ stroke: 'var(--accent)' }}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </a>
  );
}
