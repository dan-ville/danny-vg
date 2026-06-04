import { Eye, EyeOff } from 'lucide-react';

export interface VisibilityToggleProps {
  /** True when the page chrome (profile, links, motion toggle) is hidden. */
  hidden: boolean;
  onToggle: () => void;
}

/**
 * Mobile-only immersive switch: a fixed bottom-right disc, the frosted sibling
 * of the bottom-left MotionToggle. Tapping it hides everything but the theme orb
 * so the visitor can play with the live background unobstructed; tapping again
 * brings the page back. Hidden entirely at `lg:` — desktop has the room to keep
 * the links visible and reserves the bottom-right corner for the theme orb.
 */
export function VisibilityToggle({ hidden, onToggle }: VisibilityToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={hidden ? 'Show page content' : 'Hide page content'}
      title={hidden ? 'Show content' : 'Hide content'}
      className="visibility-toggle motion-toggle fixed bottom-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
    >
      {hidden ? (
        <EyeOff aria-hidden="true" className="h-5 w-5" />
      ) : (
        <Eye aria-hidden="true" className="h-5 w-5" />
      )}
    </button>
  );
}
