/**
 * Tiny bridge between the kitty theme's two canvas layers, which can't share a
 * React ref because they live on opposite sides of the page: the yarn ball is
 * the cursor (ThemeCursor, top layer) while the cat roams in the background
 * (KittyBackground, bottom layer). The cursor publishes the yarn's live position
 * and a `smack` callback here; the cat reads `yarn` to aim its pounce and calls
 * `smack` on contact to fling the ball.
 *
 * A module singleton (not context) keeps the per-frame canvas loops off React's
 * render path, matching how the other effects keep their hot state in refs. The
 * cursor owns the lifecycle: it sets both fields while the kitty cursor is live
 * and clears them (back to null) when it unmounts or the theme changes, so the
 * cat safely falls back to the raw tap point and never smacks a ball that isn't
 * there (e.g. on touch, where no cursor mounts).
 */
export interface KittyLink {
  /** The yarn ball's current centre in CSS px, or null when no cursor is live. */
  yarn: { x: number; y: number } | null;
  /** Fling the yarn with this velocity (px/s); null when no cursor is live. */
  smack: ((vx: number, vy: number) => void) | null;
  /**
   * When set, the yarn is held pinned here — the cat has trapped it under its
   * raised mallet, so a moving cursor can't drag it out from under the swing.
   * The cat sets it on entering the `hit` state and clears it on the impact
   * frame (right before flinging the ball). Null whenever the ball is free.
   */
  pin: { x: number; y: number } | null;
}

export const kittyLink: KittyLink = { yarn: null, smack: null, pin: null };
