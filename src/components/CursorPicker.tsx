import { CURSORS, useCursor } from '../context/CursorContext';
import { CURSOR_SPRITES, useHoverCapable } from '../effects/cursorSprites';

/**
 * Desktop-only cursor chooser: a three-tile strip in the bottom-right cluster,
 * just left of the ThemeOrb. Each tile paints one fantasy sprite (sword/bow/staff)
 * tinted to the active `--accent`; clicking it jumps the live FantasyCursor to that
 * sprite via CursorContext (persisted in localStorage). The active tile carries an
 * accent ring and `aria-pressed`. Mounts only on hover-capable devices — the
 * sprite cursor itself never exists on touch, so a picker for it would be useless.
 * It sits before the orb in DOM order so the keyboard tab order reads
 * link 1 → link 2 → motion toggle → cursor picker → theme orb.
 */
export function CursorPicker() {
  const { cursor, setCursor } = useCursor();
  const enabled = useHoverCapable();

  if (!enabled) return null;

  return (
    <div
      role="group"
      aria-label="Cursor sprite"
      className="cursor-picker fixed bottom-6 right-20 z-20 flex items-center gap-1"
    >
      {CURSORS.map((type) => {
        const active = type === cursor;
        return (
          <button
            key={type}
            type="button"
            onClick={() => setCursor(type)}
            aria-label={`Use ${type} cursor`}
            aria-pressed={active}
            className={`cursor-picker__tile${active ? ' cursor-picker__tile--active' : ''}`}
          >
            {CURSOR_SPRITES[type]}
          </button>
        );
      })}
    </div>
  );
}
