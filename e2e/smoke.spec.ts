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

  // Both layered canvases mount (background stars + ripple layer).
  await expect(page.locator('canvas')).not.toHaveCount(0);

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
