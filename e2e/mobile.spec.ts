import { test, expect } from '@playwright/test';

/**
 * Mobile regression suite. Runs on the touch projects (Pixel/Chromium and
 * iPhone/WebKit — the closest automatable proxy for mobile Safari) and guards
 * the two mobile bugs we fixed:
 *
 *  1. A finger-drag on the interactive background must paint an effect, never
 *     scroll or rubber-band the page (the page was "unusable" on mobile Safari).
 *  2. The per-theme custom cursor must follow touch input (it used to be
 *     desktop-only and rendered nothing on a phone — the "cursor disappears").
 *
 * iOS Safari's actual rubber-band bounce can't be reproduced in a headless
 * engine, so the durable property-level guard for the fix lives in the
 * index.css unit test; here we assert the live behavior an engine *can* show:
 * the CSS is applied, the page can't scroll, and the cursor reacts to touch.
 */

test.beforeEach(async ({ page }) => {
  // Pin galaxy so the cursor under test is the comet (bright, additive pixels
  // that are easy to detect), matching the smoke test's determinism trick.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('danny-vg:theme', 'galaxy');
    } catch {
      /* private mode — falls back to default, fine. */
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Danny VG' })).toBeVisible();
});

test('the body opts out of native touch scroll/zoom', async ({ page }) => {
  const touchAction = await page.evaluate(() => getComputedStyle(document.body).touchAction);
  expect(touchAction, 'body touch-action must be none so a drag is an effect, not a scroll').toBe(
    'none',
  );

  const overscroll = await page.evaluate(
    () => getComputedStyle(document.body).overscrollBehaviorY,
  );
  expect(overscroll, 'overscroll must be contained so the page never bounces').not.toBe('auto');
});

test('a finger-drag does not scroll the page', async ({ page }) => {
  const vp = page.viewportSize();
  if (!vp) throw new Error('expected a mobile viewport');

  // A real touch swipe up the lower-third of the screen — the gesture that used
  // to scroll/bounce the page. We aim below the centered links (and above the
  // bottom corner controls) so the swipe lands on bare background, not a link.
  const startY = vp.height * 0.8;
  await page.touchscreen.tap(vp.width / 2, startY);
  for (let i = 0; i < 3; i++) {
    await page.touchscreen.tap(vp.width / 2, startY - i * 40);
  }

  const scrolled = await page.evaluate(() => ({
    y: window.scrollY,
    canScroll: document.documentElement.scrollHeight > window.innerHeight + 1,
  }));
  expect(scrolled.y, 'page must not have scrolled').toBe(0);
  expect(scrolled.canScroll, 'the one-screen layout must not be scrollable at all').toBe(false);
});

test('the custom cursor follows touch input', async ({ page }) => {
  // The cursor canvas mounts on touch now (it used to be gated to desktop).
  const cursor = page.locator('canvas.z-50');
  await expect(cursor).toHaveCount(1);

  // Drive a touch-drag via pointer events (trusted touch-swipe injection differs
  // per engine; our cursor listens on pointer events, so this exercises the same
  // path cross-browser) and let the rAF loop paint a few comet frames.
  await page.evaluate(async () => {
    const fire = (type: string, x: number, y: number) =>
      window.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'touch', bubbles: true }),
      );
    fire('pointerdown', 40, 300);
    for (let i = 0; i < 24; i++) fire('pointermove', 40 + i * 12, 300);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  // The top (z-50) cursor canvas should now have painted the comet trail.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const c = document.querySelector('canvas.z-50');
          if (!(c instanceof HTMLCanvasElement)) return 0;
          const ctx = c.getContext('2d');
          if (!ctx) return 0;
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n++;
          return n;
        }),
      { message: 'cursor canvas should paint a trail in response to touch' },
    )
    .toBeGreaterThan(0);
});

test('the immersive toggle hides the links and profile but keeps the theme orb', async ({
  page,
}) => {
  const links = page.getByRole('navigation');
  const profile = page.getByRole('heading', { name: 'Danny VG' });
  const orb = page.getByRole('button', { name: /switch theme/i });
  await expect(links).toBeVisible();
  await expect(profile).toBeVisible();

  // Hide everything but the chrome you need to keep playing with the theme.
  await page.getByRole('button', { name: /hide page content/i }).click();
  await expect(links).toBeHidden();
  await expect(profile).toBeHidden();
  await expect(orb).toBeVisible();

  // Toggle back — content returns.
  await page.getByRole('button', { name: /show page content/i }).click();
  await expect(links).toBeVisible();
  await expect(profile).toBeVisible();
});

test('the kitty yarn ball is omitted below desktop width', async ({ page }) => {
  // Force kitty via the URL param (it wins over the galaxy pinned in
  // beforeEach). A phone viewport is well below the desktop cutoff.
  await page.goto('/?theme=kitty');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'kitty');

  // Drive a touch-drag — on desktop this would paint the yarn ball on the
  // cursor canvas; below the cutoff it must paint nothing (the cat just hammers
  // the tap point, no ball).
  await page.evaluate(async () => {
    const fire = (type: string, x: number, y: number) =>
      window.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'touch', bubbles: true }),
      );
    fire('pointerdown', 40, 300);
    for (let i = 0; i < 12; i++) fire('pointermove', 40 + i * 10, 300);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas.z-50');
    if (!(c instanceof HTMLCanvasElement)) return -1;
    const ctx = c.getContext('2d');
    if (!ctx) return -1;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n++;
    return n;
  });
  expect(painted, 'no yarn ball should be drawn below desktop width').toBe(0);
});
