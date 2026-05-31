/**
 * Rainbow background: a slow, CSS-only animated conic gradient (~24s loop) over
 * the dark base. Unlike galaxy/matrix there is no canvas and no rAF — the whole
 * effect is a single full-bleed layer whose `rainbow-bg` class owns the gradient
 * and its lazy rotation. The motion sits just below conscious notice and is
 * disabled entirely under `prefers-reduced-motion` (see index.css).
 *
 * Readability under the iridescent wash (dark scrim + stronger card frost) is
 * driven by `data-theme="rainbow"` on the root and lives in CSS, not here.
 */
export function RainbowBackground() {
  return (
    <div aria-hidden="true" className="rainbow-bg fixed inset-0 -z-10">
      {/* Dark radial scrim between the iridescent wash and the foreground for text contrast. */}
      <div className="rainbow-scrim absolute inset-0" />
    </div>
  );
}
