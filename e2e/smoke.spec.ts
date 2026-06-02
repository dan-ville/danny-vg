import { test, expect, type ConsoleMessage } from '@playwright/test';

/**
 * M4 smoke test: the whole app actually boots and its signature interactions
 * work in a real browser — content renders, the layered canvases mount, the
 * theme orb cycles galaxy → matrix → rainbow → galaxy, and the motion toggle
 * flips the document's resolved motion state. Guards the wiring that jsdom unit
 * tests can't exercise (real canvas, real CSS, real event loop).
 */
test('the link page boots, renders content, and switches themes/motion', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');

  // Foreground content.
  await expect(page.getByRole('heading', { name: 'Danny VG' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Instagram' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'TikTok' })).toBeVisible();

  // Default theme is the persisted/galaxy default on first load.
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'galaxy');

  // The background canvas mounts. On galaxy the tap effect is the gravity well
  // (inside the background), so no separate ripple layer is present here; the
  // ripple only mounts on matrix/rainbow.
  await expect(page.locator('canvas')).not.toHaveCount(0);

  // Regression guard for the "every theme looks identically plain" bug: the dark
  // base color must live on <html> ONLY. If <body> also carries an opaque
  // background, it paints OVER the fixed z-index:-10 background canvas and hides
  // the galaxy/matrix/rainbow layer entirely — the canvas still draws into its
  // buffer (so a mount/draw check passes) but nothing reaches the screen.
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg, 'body must be transparent so the z-index:-10 background canvas is visible').toBe(
    'rgba(0, 0, 0, 0)',
  );

  // ...and the background canvas must actually paint (not merely mount). The
  // first <canvas> in the DOM is the background layer; the ripple layer is idle.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const c = document.querySelector('canvas');
          if (!(c instanceof HTMLCanvasElement)) return 0;
          const ctx = c.getContext('2d');
          if (!ctx) return 0;
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n++;
          return n;
        }),
      { message: 'background canvas should have drawn pixels on screen' },
    )
    .toBeGreaterThan(0);

  // Theme orb cycles galaxy → matrix → rainbow → galaxy. The orb idle-bobs
  // forever by design, so it never passes Playwright's "stable" actionability
  // gate — force past it; visibility/enabled are already asserted above.
  const orb = page.getByRole('button', { name: /switch theme/i });
  await expect(orb).toBeVisible();
  await orb.click({ force: true });
  await expect(root).toHaveAttribute('data-theme', 'matrix');
  await orb.click({ force: true });
  await expect(root).toHaveAttribute('data-theme', 'rainbow');
  await orb.click({ force: true });
  await expect(root).toHaveAttribute('data-theme', 'galaxy');

  // Motion toggle flips the resolved motion state on the document root.
  await expect(root).toHaveAttribute('data-motion', /full|reduce/);
  const before = await root.getAttribute('data-motion');
  await page.getByRole('button', { name: /motion/i }).click();
  await expect(root).not.toHaveAttribute('data-motion', before ?? '');

  expect(errors, `no console/page errors:\n${errors.join('\n')}`).toEqual([]);
});
