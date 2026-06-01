import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

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

  it('keeps the bottom-right cursor picker clear of the home indicator and right edge', () => {
    const block = ruleBlock('.cursor-picker');
    expect(block).toMatch(/margin-bottom:\s*env\(safe-area-inset-bottom/);
    expect(block).toMatch(/margin-right:\s*env\(safe-area-inset-right/);
  });
});
