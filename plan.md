# Shared Understanding — Personal Links Landing Page ("danny-vg")

## 1. Project foundation

- **Type:** Brand-new standalone project (separate repo & folder), unrelated to `grill-me-ui`.
- **Stack:** Vite + React + TypeScript.
- **Styling:** Tailwind CSS + a small amount of plain CSS for keyframes and canvas/effects layers. Theme switching driven by CSS variables (`--accent`, `--bg-*`).
- **Hosting:** Vercel.
- **URL:** Ship on `*.vercel.app` first; attach a custom domain later.
- **Folder/Repo name:** `danny-vg`.
- **Location on disk:** `C:\Users\DandyBear\Projects\danny-vg` (sibling of `grill-me-ui`).
- **License:** MIT. README is minimal, points at the deploy URL.

## 2. Content

- **Display name (visible under profile picture):** "Danny VG".
- **Initials in placeholder avatar:** "DV".
- **No tagline.**
- **Links:** Instagram + TikTok only at launch, with **placeholder `#` URLs** (TODO comments). Layout is designed to gracefully handle 2–8 links so additions are zero-rework.
- **Profile picture:** Styled placeholder (initials "DV" inside a circle on a subtle gradient backdrop). Real photo dropped into `/public` and swapped via a single `<img src>` later.

## 3. Layout & responsive

- **Mobile-primary, desktop-graceful.**
- **Mobile:** Full-bleed animated background; centered single-column content (profile → name → link cards).
- **Desktop:** Background fills the viewport edge-to-edge; foreground content is capped at ~480px centered column, so the design reads as a "phone on a cosmic background."
- **Safe areas:** `viewport-fit=cover` + `env(safe-area-inset-*)` padding on the bottom-corner controls so iPhone home-indicator and Android edge-to-edge devices don't clip them.

## 4. Themes (three backgrounds)

- **Default:** Cosmic galaxy. **Persisted** in localStorage so a returning visitor lands on their last-chosen theme.
- **Galaxy:** Canvas 2D — 150–250 drifting, twinkling star particles over a CSS radial-gradient nebula (deep purple/blue/black). No WebGL.
- **Matrix:** Canvas 2D — classic falling katakana/glyph columns, leading character at the head of each column drawn brighter/white-ish, fading green trail behind.
- **Rainbow:** Slow CSS-only animated conic (or layered radial) gradient, 20–30s loop. Subtle — motion just below conscious notice. Honors `prefers-reduced-motion`.
- **Rainbow readability:** Dark radial scrim overlay between gradient and foreground when rainbow is active, AND slightly stronger frosted-glass card opacity/blur on rainbow. Other themes don't need the scrim.

## 5. Theme switcher (the "non-conventional" UI)

- **Floating orb in the bottom-right corner**, fixed position with a gentle idle bob/float animation.
- **Click to cycle:** Galaxy → Matrix → Rainbow → Galaxy.
- The orb's own surface **reflects the currently active theme** (gradient on its skin).
- **Theme transition:** Crossfade over ~500ms (old background canvas/CSS fades out, new fades in) plus a brief orb pulse on click for cause-effect feedback.
- The orb is keyboard-focusable with an accent-tinted `:focus-visible` ring; `aria-label` reflects current theme.

## 6. Foreground style

- **Consistent across all three themes:** white/light text, frosted-glass cards (backdrop-blur, subtle border), so the design coheres regardless of background.
- **Per-theme variation:** a single CSS variable `--accent` flips with the theme — used for the profile picture's ring gradient, card hover/tap glow, link card icon/arrow tint, and focus rings.
  - Galaxy → cyan/purple.
  - Matrix → green.
  - Rainbow → soft white/iridescent.

## 7. Profile picture

- Circle with a thin **animated gradient accent ring** that slowly rotates (~8s cycle); ring colors derived from active theme accent.
- Inside: initials "DV" on a subtle radial gradient backdrop (swappable for a real photo file).
- Reduced-motion users see a static ring.

## 8. Link cards

- **Full-width frosted-glass pills.**
- Layout: **icon-left + label + small arrow-right indicator.**
- Tap target height ~64px (well above mobile minimums).
- Icon and arrow tint to active `--accent`.
- **Icons** sourced from the **`simple-icons`** package (official brand glyphs for Instagram/TikTok and any future additions), inline SVG, tree-shaken.
- **Navigation:** plain `<a href>` opening in the **same tab** — mobile OS deeplinks to native apps automatically when installed; "back" returns cleanly.

## 9. Interaction effects

- **Water ripples on tap/click — empty background only.** Concentric translucent rings (2–3 per tap, slightly offset expansion speeds and opacity decay), tinted to active `--accent`.
- **Ripple canvas layering:** above the background canvas, **below** the foreground (profile/cards/orb). Rings appear to spread beneath the floating cards.
- **Card press feedback (mobile):** tap press-down + brief accent-color glow flash, snappy (~150ms). No `target="_blank"`, no permissions.
- **Card hover feedback (desktop):** subtle tilt (mouse-position-based 3D rotation).
- **Custom cursor sprites (desktop only):** 3 inline SVG sprites — sword, bow, magic staff — drawn by me to match the futuristic vibe, tinted to active `--accent`. Hidden on touch devices via `@media (hover: hover)`.
- **Cursor picker (desktop only):** mini 3-sprite icon strip in the bottom-right cluster next to the theme orb. Active sprite shows a subtle ring; click to switch.

## 10. Motion / accessibility

- **Respects `prefers-reduced-motion: reduce`:** disables continuous loops (drifting stars, matrix rain, rainbow shift, orb bob, profile-ring rotation). Keeps user-initiated motion (ripples on tap, theme crossfade, tap press-down/glow flash, hover card tilt). Static fallbacks for each theme.
- **Manual "reduce motion" toggle** as a small, slightly translucent icon button in the **bottom-left** corner, persisted in localStorage alongside the theme.
- **Full keyboard a11y:** native `<button>` elements for orb / motion toggle / cursor picker, `aria-label`s reflect current state, `:focus-visible` accent rings.
- **Tab order:** link 1 → link 2 → motion toggle → cursor picker (desktop) → theme orb.
- **`<noscript>` fallback:** name + the two links as plain `<a>` tags + one-line note. Inherits the inline dark body bg.

## 11. Performance

- **Inline `<style>` in `index.html`** sets `body { background: #0a0118; }` (galaxy base color) to eliminate white-flash on initial paint. No skeleton.
- **DPR-aware canvas sizing**, capped at 2.0. Shared `useResizableCanvas` hook applied to all three backgrounds + the ripple canvas; handles resize/orientation change.
- **Pause `requestAnimationFrame` loops on `document.visibilitychange`** when tab is hidden; resume on visible.

## 12. SEO / shareability

- **Open Graph tags** (`og:title`, `og:description`, `og:image`, plus Twitter card equivalents).
- **Static OG image:** generate once (1200×630 PNG showing "Danny VG" over a static galaxy theme), commit to `/public/og.png`. No dynamic OG generation.
- **Favicon:** SVG monogram "DV" (transparent background, accent-tinted) + 180×180 PNG `apple-touch-icon` + 32×32 `favicon.ico`. Standard link tags in `<head>`.
- **No analytics** for v1 (no Vercel Analytics, no Plausible, no cookie banner).

## 13. Typography

- **Name:** Space Grotesk (Google Fonts, variable).
- **Everything else:** Inter (Google Fonts, variable).
- Loaded as `font-display: swap`; total font weight ~30kb.

## 14. State management

- **React Context** for the two long-lived state values: active theme + motion preference. Canvas-loop components read latest values via refs inside their `requestAnimationFrame` closures. No Zustand / no event bus.

## 15. Project structure

```
src/
  App.tsx
  components/        # ProfileHeader, LinkCard, ThemeOrb, CursorPicker, MotionToggle
  backgrounds/       # GalaxyBackground.tsx, MatrixBackground.tsx, RainbowBackground.tsx
  effects/           # RippleCanvas.tsx, FantasyCursor.tsx
  context/           # ThemeContext, MotionContext
  hooks/             # useReducedMotion, useResizableCanvas, etc.
```

## 16. Testing

- **One Playwright smoke test** per deploy: load the page, assert profile name + both link `href`s are present, click the orb three times and screenshot after each theme switch.
- No unit tests, no full visual regression for v1.

## 17. Build & ship plan (4 incremental milestones, deploy after each)

1. **M1 — Foundation:** Scaffold Vite + React + TS + Tailwind. Profile + two link cards (placeholder URLs). Galaxy background only. Favicon + OG image + dark body bg + `<noscript>` fallback. Deploy to Vercel.
2. **M2 — Water ripples:** Ripple canvas layered above background / below foreground. Background-only tap detection. Per-tap concentric ring spawning, theme-tinted.
3. **M3 — Themes:** Matrix + Rainbow backgrounds. Theme orb (bottom-right, idle bob). Crossfade transition + orb pulse. Per-theme accent variable + rainbow-only scrim. localStorage persistence.
4. **M4 — Polish:** `prefers-reduced-motion` handling + manual motion toggle (bottom-left, translucent). Desktop cursor sprites + picker strip (next to orb, desktop-only). Card hover tilt (desktop), tap press-down + glow (mobile). DPR-aware canvas hook, visibilitychange pause, full keyboard a11y, safe-area-inset padding. Playwright smoke test.
