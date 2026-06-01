import { describe, it, expect } from 'vitest';
import {
  fmtElapsed,
  oneLine,
  shortPath,
  describeTool,
  formatEvent,
  parseState,
} from './ralph-format.mjs';

describe('fmtElapsed', () => {
  it('formats sub-minute durations as 0:SS with a zero-padded seconds field', () => {
    expect(fmtElapsed(0)).toBe('0:00');
    expect(fmtElapsed(3000)).toBe('0:03');
    expect(fmtElapsed(59_000)).toBe('0:59');
  });

  it('rolls over into minutes and keeps counting past ten minutes', () => {
    expect(fmtElapsed(65_000)).toBe('1:05');
    expect(fmtElapsed(600_000)).toBe('10:00');
  });

  it('floors fractional seconds rather than rounding up', () => {
    expect(fmtElapsed(3999)).toBe('0:03');
  });
});

describe('oneLine', () => {
  it('collapses runs of whitespace (including newlines/tabs) to single spaces and trims', () => {
    expect(oneLine('a\n  b\tc  ', 50)).toBe('a b c');
  });

  it('truncates with an ellipsis when longer than max, counting the ellipsis in the budget', () => {
    expect(oneLine('abcdef', 4)).toBe('abc…');
  });

  it('leaves short strings untouched and tolerates empty/missing input', () => {
    expect(oneLine('short', 80)).toBe('short');
    expect(oneLine('', 80)).toBe('');
    expect(oneLine(undefined, 80)).toBe('');
  });
});

describe('shortPath', () => {
  const root = '/repo';

  it('returns a repo-relative posix path for files under the root', () => {
    expect(shortPath('/repo/src/LinkCard.tsx', root)).toBe('src/LinkCard.tsx');
  });

  it('normalizes Windows backslashes before comparing to the root', () => {
    expect(shortPath('C:\\repo\\src\\b.ts', 'C:\\repo')).toBe('src/b.ts');
  });

  it('falls back to the basename for paths outside the root', () => {
    expect(shortPath('/other/place/x.ts', root)).toBe('x.ts');
  });

  it('tolerates a trailing slash on the root and missing input', () => {
    expect(shortPath('/repo/a.ts', '/repo/')).toBe('a.ts');
    expect(shortPath(undefined, root)).toBe('');
  });
});

describe('describeTool', () => {
  const root = '/repo';

  it('maps file tools to a short verb plus a shortened path', () => {
    expect(describeTool('Read', { file_path: '/repo/src/a.ts' }, root)).toEqual({
      verb: 'read',
      detail: 'src/a.ts',
    });
    expect(describeTool('Edit', { file_path: '/repo/src/a.ts' }, root)).toEqual({
      verb: 'edit',
      detail: 'src/a.ts',
    });
    expect(describeTool('Write', { file_path: '/repo/new.ts' }, root)).toEqual({
      verb: 'write',
      detail: 'new.ts',
    });
  });

  it('collapses a multi-line Bash command onto one truncated line', () => {
    expect(describeTool('Bash', { command: 'vitest run\n' }, root)).toEqual({
      verb: 'bash',
      detail: 'vitest run',
    });
  });

  it('summarizes search and todo tools', () => {
    expect(describeTool('Grep', { pattern: 'foo' }, root)).toEqual({ verb: 'grep', detail: 'foo' });
    expect(describeTool('TodoWrite', { todos: [1, 2, 3] }, root)).toEqual({
      verb: 'todo',
      detail: '3 items',
    });
  });

  it('lower-cases unknown tool names and leaves the detail blank', () => {
    expect(describeTool('Frobnicate', {}, root)).toEqual({ verb: 'frobnicate', detail: '' });
  });
});

describe('formatEvent', () => {
  const root = '/repo';

  it('expands an assistant turn into one line per text/tool_use block, in order', () => {
    const evt = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Adding the glow effect.' },
          { type: 'tool_use', name: 'Edit', input: { file_path: '/repo/src/tap-glow.ts' } },
        ],
      },
    };
    expect(formatEvent(evt, root)).toEqual([
      { verb: 'note', detail: 'Adding the glow effect.' },
      { verb: 'edit', detail: 'src/tap-glow.ts' },
    ]);
  });

  it('skips empty/whitespace-only text blocks', () => {
    const evt = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: '   \n ' }] },
    };
    expect(formatEvent(evt, root)).toEqual([]);
  });

  it('stays quiet for tool results, system, and successful result events', () => {
    expect(formatEvent({ type: 'user', message: { content: [{ type: 'tool_result' }] } }, root)).toEqual([]);
    expect(formatEvent({ type: 'system', subtype: 'init' }, root)).toEqual([]);
    expect(formatEvent({ type: 'result', subtype: 'success', is_error: false, result: 'done' }, root)).toEqual([]);
  });

  it('surfaces an error result as a single error line', () => {
    const out = formatEvent(
      { type: 'result', subtype: 'error_max_turns', is_error: true, result: 'hit the turn limit' },
      root,
    );
    expect(out).toEqual([{ verb: 'error', detail: 'hit the turn limit' }]);
  });
});

describe('parseState', () => {
  it('reads the done flag, status summary, and humanTodos from a complete state', () => {
    const raw = JSON.stringify({
      done: true,
      milestones: [
        { id: 'M1', status: 'done' },
        { id: 'M2', status: 'done' },
      ],
      humanTodos: ['Deploy to Vercel', 'Add /public/og.png'],
    });
    expect(parseState(raw)).toEqual({
      done: true,
      settled: true,
      summary: 'M1:done M2:done',
      humanTodos: ['Deploy to Vercel', 'Add /public/og.png'],
    });
  });

  it('treats the loop as settled when every milestone is done OR blocked, even before done:true', () => {
    const raw = JSON.stringify({
      done: false,
      milestones: [
        { id: 'M1', status: 'done' },
        { id: 'M2', status: 'blocked' },
      ],
    });
    const s = parseState(raw);
    expect(s.done).toBe(false);
    expect(s.settled).toBe(true);
    expect(s.summary).toBe('M1:done M2:blocked');
    expect(s.humanTodos).toEqual([]);
  });

  it('is NOT settled while any milestone is still todo', () => {
    const raw = JSON.stringify({
      milestones: [
        { id: 'M1', status: 'done' },
        { id: 'M2', status: 'todo' },
      ],
    });
    expect(parseState(raw).settled).toBe(false);
  });

  it('falls back to safe defaults on unparseable JSON', () => {
    expect(parseState('{not json')).toEqual({
      done: false,
      settled: false,
      summary: '(unparseable)',
      humanTodos: [],
    });
  });

  it('keeps only string humanTodos and reports no-milestones cleanly', () => {
    const raw = JSON.stringify({ milestones: [], humanTodos: ['ok', 3, null, 'also ok'] });
    const s = parseState(raw);
    expect(s.humanTodos).toEqual(['ok', 'also ok']);
    expect(s.settled).toBe(false);
    expect(s.summary).toBe('(no milestones)');
  });
});
