import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Playwright specs live in e2e/ and run under their own runner; keep Vitest
    // (jsdom) from trying to collect them.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
