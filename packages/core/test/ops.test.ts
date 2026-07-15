import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  combineBranches,
  demoSeed,
  forkBranch,
  getBranch,
  makeMsg,
  nextName,
  spliceSummary,
  summaryFallback,
} from '../src/index.ts';
import type { Conversation } from '../src/index.ts';

const FIXTURES = join(import.meta.dirname, '../fixtures/ops');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Replace generated UUIDs with "NEW" and real epoch-ms timestamps with 0 (see fixtures README). */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => {
        if ((k === 'id' || k === 'branchId' || k === 'messageId') && typeof v === 'string' && UUID_RE.test(v)) {
          return [k, 'NEW'];
        }
        if ((k === 'createdAt' || k === 'updatedAt') && typeof v === 'number' && v > 1e12) return [k, 0];
        return [k, normalize(v)];
      }),
    );
  }
  return value;
}

interface Fixture {
  name: string;
  conversation: Conversation;
  op: string;
  args: Record<string, unknown>;
  expected: unknown;
}

describe('ops fixtures', () => {
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));
  it('has fixtures', () => expect(files.length).toBeGreaterThan(0));

  for (const file of files) {
    const fx: Fixture = JSON.parse(readFileSync(join(FIXTURES, file), 'utf8'));
    it(`${file}: ${fx.name}`, () => {
      const conv = structuredClone(fx.conversation);
      switch (fx.op) {
        case 'forkBranch': {
          const from = getBranch(conv, fx.args.branchId as string)!;
          forkBranch(conv, from, fx.args.messageId as string | null, fx.args.name as string);
          expect(normalize(conv)).toEqual(fx.expected);
          break;
        }
        case 'combineBranches': {
          combineBranches(conv, fx.args.sourceBranchId as string, fx.args.targetBranchId as string);
          expect(normalize(conv)).toEqual(fx.expected);
          break;
        }
        case 'spliceSummary': {
          const branch = getBranch(conv, fx.args.branchId as string)!;
          spliceSummary(branch, fx.args.fromId as string, fx.args.toId as string, fx.args.summaryText as string);
          expect(normalize(conv)).toEqual(fx.expected);
          break;
        }
        case 'nextName': {
          expect(nextName(conv, fx.args.base as 'Branch' | 'Rewind')).toEqual(fx.expected);
          break;
        }
        default:
          throw new Error(`unknown op: ${fx.op}`);
      }
    });
  }
});

describe('ops edge cases', () => {
  const conv = () => {
    const c: Conversation = JSON.parse(
      readFileSync(join(FIXTURES, 'fork-prefix.json'), 'utf8'),
    ).conversation;
    return structuredClone(c);
  };

  it('forkBranch throws on unknown message', () => {
    const c = conv();
    expect(() => forkBranch(c, c.branches[0], 'nope', 'X')).toThrow('message not found');
  });

  it('combineBranches throws on identical branches', () => {
    const c = conv();
    expect(() => combineBranches(c, 'b1', 'b1')).toThrow('bad branches');
  });

  it('spliceSummary throws on inverted range', () => {
    const c = conv();
    expect(() => spliceSummary(c.branches[0], 'c', 'a', 's')).toThrow('bad range');
  });

  it('makeMsg produces a message-kind msg with uuid', () => {
    const m = makeMsg('user', 'hi');
    expect(m.kind).toBe('message');
    expect(m.id).toMatch(UUID_RE);
  });

  it('summaryFallback uses first line of first and last messages, 90 chars', () => {
    const long = 'x'.repeat(200);
    expect(summaryFallback([makeMsg('user', `${long}\nrest`), makeMsg('assistant', 'end')])).toBe(
      `${'x'.repeat(90)} → end`,
    );
  });

  it('demoSeed materializes offsets and shares fork-point prefixes', () => {
    const seed = demoSeed(1_000_000_000_000);
    const q3 = seed[0];
    expect(q3.branches.map((b) => b.name)).toEqual(['Main', 'Playful tone', 'Formal tone']);
    const main = q3.branches[0];
    const playful = q3.branches[1];
    expect(playful.messages.slice(0, main.messages.length).map((m) => m.id)).toEqual(
      main.messages.map((m) => m.id),
    );
    expect(playful.messages).toHaveLength(main.messages.length + 2);
    expect(q3.updatedAt).toBe(1_000_000_000_000);
  });
});
