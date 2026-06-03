import { describe, expect, it } from 'vitest';
// Vite's `?raw` import gives us the stylesheet source as a string — no Node fs
// APIs (keeps the app tsconfig free of @types/node).
import css from './index.css?raw';

/**
 * Returns the flat declaration block (text between the first `{` and its `}`) for
 * an exact top-level selector. The corner-control rules have no nested braces, so
 * a first-`}` scan is sufficient and keeps the test free of a CSS parser.
 */
function ruleBlock(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `selector "${selector}" should exist in index.css`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('no text highlighting on background interaction', () => {
  it('makes the page non-selectable so a background press-drag never highlights text', () => {
    const block = ruleBlock('body');
    expect(block).toMatch(/(^|[\s;]){0,1}user-select:\s*none/);
    expect(block).toMatch(/-webkit-user-select:\s*none/); // Safari
  });

  it('suppresses the mobile tap-highlight flash and long-press callout', () => {
    const block = ruleBlock('body');
    expect(block).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
    expect(block).toMatch(/-webkit-touch-callout:\s*none/);
  });
});

describe('mobile: a finger-drag paints effects, never scrolls or bounces the page', () => {
  // Regression guard for the "page scrolls/rubber-bands when you drag on mobile
  // Safari" bug: the background is a one-screen interactive canvas, so the body
  // must opt out of native touch scrolling/zoom. touch-action:none is the
  // reliable cross-browser lever; overscroll-behavior + overflow:hidden are the
  // belt-and-suspenders for bounce / pull-to-refresh.
  it('opts the body out of touch-driven scroll and zoom', () => {
    const block = ruleBlock('body');
    expect(block).toMatch(/touch-action:\s*none/);
    expect(block).toMatch(/overscroll-behavior:\s*none/);
    expect(block).toMatch(/overflow:\s*hidden/);
  });

  it('also disables overscroll bounce on the root element', () => {
    const block = ruleBlock('html');
    expect(block).toMatch(/overscroll-behavior:\s*none/);
  });
});

describe('safe-area insets on bottom-corner controls', () => {
  it('keeps the bottom-right theme orb clear of the home indicator and right edge', () => {
    const block = ruleBlock('.theme-orb');
    expect(block).toMatch(/margin-bottom:\s*env\(safe-area-inset-bottom/);
    expect(block).toMatch(/margin-right:\s*env\(safe-area-inset-right/);
  });

  it('keeps the bottom-left motion toggle clear of the home indicator and left edge', () => {
    const block = ruleBlock('.motion-toggle');
    expect(block).toMatch(/margin-bottom:\s*env\(safe-area-inset-bottom/);
    expect(block).toMatch(/margin-left:\s*env\(safe-area-inset-left/);
  });
});
