import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the M4 smoke test. Boots the Vite dev server on a fixed
 * port and drives a real Chromium against it. Specs live in e2e/ (excluded from
 * the Vitest run in vite.config.ts so the two runners never collide).
 */
const PORT = 5179;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    // Desktop smoke runs everything except the mobile-only suite.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile\.spec\.ts/,
    },
    // Mobile suite: Chromium (Pixel) and WebKit (iPhone, the closest proxy for
    // mobile Safari) — both touch + mobile-viewport. These run only mobile.spec.
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
