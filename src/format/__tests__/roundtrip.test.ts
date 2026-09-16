// parse → serialize → parse is a fixed point, on the corpus and on random
// mutations of it. Canonical files also come back byte for byte.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse, serialize } from '../index.js';

const CORPUS = join(import.meta.dirname, 'corpus');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(CORPUS).map((p) => ({ name: relative(CORPUS, p), text: readFileSync(p, 'utf8') }));
const vault = files.filter((f) => f.name.startsWith('vault/'));
const mangled = files.filter((f) => f.name.startsWith('mangled/'));

/** The three round-trip properties every input must satisfy. */
function expectFixedPoint(text: string, label: string) {
  const first = parse(text);
  const out1 = serialize(first.doc);
  const second = parse(out1);
  expect(second.doc, `${label}: parse(serialize(parse(x))) = parse(x)`).toEqual(first.doc);
  const out2 = serialize(second.doc);
  expect(out2, `${label}: serialize is idempotent`).toBe(out1);
  // canonicalizing never introduces a problem: whatever the second pass
  // reports (orphans kept verbatim) the first pass already reported
  const firstMessages = new Set(first.diagnostics.map((d) => d.message));
  for (const d of second.diagnostics) {
    expect(firstMessages.has(d.message), `${label}: new diagnostic "${d.message}"`).toBe(true);
  }
}

describe('corpus', () => {
  it('has both halves', () => {
    expect(vault.length).toBeGreaterThan(5);
    expect(mangled.length).toBeGreaterThan(10);
  });

  for (const f of vault) {
    it(`${f.name} is canonical and byte-stable`, () => {
      const { doc, diagnostics } = parse(f.text);
      expect(diagnostics).toEqual([]);
      expect(serialize(doc)).toBe(f.text);
      expectFixedPoint(f.text, f.name);
    });
  }

  for (const f of mangled) {
    it(`${f.name} reaches a fixed point`, () => {
      expectFixedPoint(f.text, f.name);
    });
  }
});

// ── random mutation ──────────────────────────────────────────────

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

const JUNK = [
  '{{', '}}', '{{c1::', '::', ' :: ', ' ::: ', '$', '$$', '^', ' ^id', '#', '# ', '---', '```', '<!-- sr ',
  '<!-- sr due=2026-01-01 -->', '<!-- extract x -->', '-->', '?', '??', '- ', '> ', '|', '    ', '\t', 'ü', '—',
];

function mutate(text: string, rand: () => number): string {
  const lines = text.split('\n');
  const edits = 1 + Math.floor(rand() * 5);
  for (let e = 0; e < edits; e++) {
    const i = Math.floor(rand() * Math.max(1, lines.length));
    const op = Math.floor(rand() * 9);
    switch (op) {
      case 0: lines.splice(i, 1); break;                                   // delete a line
      case 1: lines.splice(i, 0, lines[i] ?? ''); break;                    // duplicate a line
      case 2: lines.splice(i, 0, ''); break;                                // insert a blank
      case 3: lines.splice(i, 0, JUNK[Math.floor(rand() * JUNK.length)]!); break;
      case 4: if (i + 1 < lines.length) { const t = lines[i]!; lines[i] = lines[i + 1]!; lines[i + 1] = t; } break;
      case 5: if (lines[i] !== undefined) lines[i] = lines[i]!.slice(0, Math.floor(rand() * (lines[i]!.length + 1))); break;
      case 6: if (lines[i] !== undefined) {                                  // splice junk into a line
        const l = lines[i]!; const at = Math.floor(rand() * (l.length + 1));
        lines[i] = l.slice(0, at) + JUNK[Math.floor(rand() * JUNK.length)] + l.slice(at);
      } break;
      case 7: if (i + 1 < lines.length) lines.splice(i, 2, lines[i]! + lines[i + 1]!); break;   // join lines
      case 8: if (lines[i] !== undefined) lines[i] = lines[i]!.replace(/-->|\}\}|\$|::|\^/, ''); break;
    }
  }
  return lines.join('\n');
}

// FUZZ_ROUNDS=2000 FUZZ_SEED=7 npx vitest run roundtrip   for a longer soak
describe('mutated corpus', () => {
  const rand = rng(Number(process.env['FUZZ_SEED'] ?? 0x1234abcd));
  const ROUNDS = Number(process.env['FUZZ_ROUNDS'] ?? 60);
  for (const f of files) {
    it(`${f.name} × ${ROUNDS} mutations`, () => {
      for (let r = 0; r < ROUNDS; r++) {
        const mutated = mutate(f.text, rand);
        expectFixedPoint(mutated, `${f.name} mutation ${r}`);
      }
    });
  }
});
