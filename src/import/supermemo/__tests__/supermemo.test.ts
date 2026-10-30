// @vitest-environment jsdom
// The SuperMemo import: the primitives round-trip, the fixture on disk is
// what the generator writes, and importing it into a scratch vault gives the
// tree, the files, and the queue LAYOUT.md §13 says it should, with no
// diagnostics. The variants check that what the notes do not cover is a
// diagnostic and never a crash or a guess in a file.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from '../../../format/index.js';
import { queue } from '../../../schedule/index.js';
import { Vault, documents } from '../../../vault/index.js';
import { nodeFs } from '../../../vault/node-fs.js';
import { dayOfTd, f64, f64le, real48, real48le, tdDay, tdWhen } from '../bytes.js';
import { formatSummary, importCollection, readCollection } from '../index.js';
import { smNodeFs } from '../node-fs.js';
import { COLLECTION_DIR, FIXTURE_NAME, LAST_DAY, PRIORITY, buildCollection, writeFiles, type FixtureOptions } from './make-collection.js';

const KNO = join(COLLECTION_DIR, `${FIXTURE_NAME}.Kno`);
const NOON = new Date(`${LAST_DAY}T12:00:00`);

const scratch: string[] = [];
async function tmp(prefix: string): Promise<string> {
  const d = await fsp.mkdtemp(join(tmpdir(), prefix));
  scratch.push(d);
  return d;
}
afterEach(async () => {
  for (const d of scratch.splice(0)) await fsp.rm(d, { recursive: true, force: true });
});

/** A fixture variant written to a scratch directory; resolves to its `.Kno`. */
async function variant(opts: FixtureOptions): Promise<string> {
  const d = await tmp('ilmi-sm-src-');
  await writeFiles(d, buildCollection(opts));
  return join(d, `${FIXTURE_NAME}.Kno`);
}

async function importInto(kno: string) {
  const dir = await tmp('ilmi-sm-vault-');
  const vault = await Vault.open(nodeFs, dir);
  const summary = await importCollection(smNodeFs, kno, vault, { today: LAST_DAY });
  const opened = await Vault.open(nodeFs, dir);
  return { dir, vault: opened, summary };
}

const read = (dir: string, rel: string) => fsp.readFile(join(dir, rel), 'utf8');

describe('bytes', () => {
  it('reads back what it writes: real48, f64, TDateTime days', () => {
    for (const v of [0, 1, 1.5, 2, 1.3, 6.9, 0.07, 1234.5678, -2.25]) {
      const b = real48le(v);
      expect(b).toHaveLength(6);
      expect(Math.abs(real48(b, 0) - v)).toBeLessThan(Math.abs(v) * 1e-11 + 1e-12);
    }
    expect(f64(f64le(45321.5), 0)).toBe(45321.5);
    expect(dayOfTd(tdDay('2024-02-05'))).toBe('2024-02-05');
    expect(dayOfTd(0)).toBe('1899-12-30');
    expect(tdDay('1899-12-31')).toBe(1);
    expect(tdWhen(45321.75)).toBe('2024-01-30');
    expect(tdWhen(0)).toBeNull();
    expect(tdWhen(999)).toBeNull();
  });
});

describe('fixture', () => {
  it('on disk is exactly what the generator builds', async () => {
    const built = buildCollection();
    const seen = new Set<string>();
    const walk = async (rel: string) => {
      for (const e of await fsp.readdir(join(COLLECTION_DIR, rel), { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(r);
        else seen.add(r);
      }
    };
    await walk('');
    expect([...seen].sort()).toEqual([...built.keys()].sort());
    for (const [rel, bytes] of built) {
      const disk = new Uint8Array(await fsp.readFile(join(COLLECTION_DIR, rel)));
      expect(Array.from(disk), rel).toEqual(Array.from(bytes));
    }
  });

  it('reads as the layout says: tree, titles, texts, schedules, ranks, epoch', async () => {
    const c = await readCollection(smNodeFs, KNO);
    expect(c.diagnostics).toEqual([]);
    expect(c.name).toBe('fixture');
    expect(c.order).toEqual([1, 2, 3, 4, 6, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const el = (id: number) => c.elements.get(id)!;
    expect(el(1).children).toEqual([2, 11, 13, 14, 15]);
    expect(el(3).title).toBe('Wozniak 1990');
    expect(el(3).type).toBe('topic');
    expect(el(3).texts.map((t) => t.kind)).toEqual(['html']);
    expect(el(3).media).toBe(1);
    expect(el(5).texts).toEqual([
      { kind: 'html', body: '<p>what does the spacing effect predict?</p>' },
      { kind: 'text', body: 'spaced practice is remembered longer than massed practice' },
    ]);
    expect(el(3).interval).toBe(9);
    expect(el(3).af).toBeCloseTo(2, 9);
    expect(el(4).af).toBeCloseTo(1.5, 9);
    expect(el(5).reps).toBe(3);
    expect(el(7).reps).toBe(0);
    expect(el(13).deleted).toBe(true);
    expect(el(14).type).toBe('template');
    expect(el(15).type).toBe('concept');
    expect(el(12).type).toBe('task');
    expect(PRIORITY.map((id) => el(id).rank)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(el(7).rank).toBeUndefined();
    expect(c.ranked).toBe(6);
    expect(c.hasHistory).toBe(true);
    expect(c.epoch).not.toBeNull();
    expect(dayOfTd(c.epoch!.day)).toBe('2023-12-31');
    expect(c.epoch!.samples).toBe(5);
    expect(c.epoch!.agreement).toBeCloseTo(0.8, 9);
  });
});

describe('import', () => {
  it('lands the fixture as the tree, files, and schedules LAYOUT.md §13 maps, parsing clean', async () => {
    const { dir, vault, summary } = await importInto(KNO);
    expect(summary.diagnostics).toEqual([]);
    expect(summary).toMatchObject({
      name: 'fixture', folders: 4, sources: 2, extracts: 1, decks: 1, cards: 5, drafts: 1,
      skipped: { deleted: 1, templates: 1, unknown: 0, prose: 0 }, media: 1,
    });

    expect(documents(vault.tree)).toEqual([
      'ideas/notes on reading.md',
      'papers/german/cards.md',
      'papers/Wozniak 1990.md',
      'papers/Wozniak 1990/spacing effect.md',
      'tasks/write the intro.md',
    ]);
    for (const path of vault.documents()) {
      const loaded = await vault.read(path);
      expect(loaded.diagnostics, path).toEqual([]);
      expect(parse(loaded.text).diagnostics, path).toEqual([]);
    }

    expect(await read(dir, 'papers/Wozniak 1990.md')).toBe([
      '---',
      'type: source',
      'frozen: true',
      'imported: 2024-02-05',
      'pri: 0',
      'read: due=2024-01-29 ivl=9 reps=2 pos=0 af=2',
      '---',
      '',
      'The spacing effect is the finding that practice spread over time is remembered longer than the same practice massed into one sitting.',
      '',
      'A schedule that times each review for the moment a memory is about to fail spends the fewest reviews on the most retention.',
      '',
      'what does the spacing effect predict? :: spaced practice is remembered longer than massed practice ^sm5',
      '<!-- sr due=2024-01-30 st=review s=12 d=5 r=3 ivl=12 last=2024-01-18 pri=20 -->',
      '',
      'who described the spacing effect first? :: Ebbinghaus ^sm7',
      '',
    ].join('\n'));

    expect(await read(dir, 'papers/Wozniak 1990/spacing effect.md')).toBe([
      '---',
      'type: extract',
      'imported: 2024-02-05',
      'pri: 40',
      'read: due=2024-01-28 ivl=3 reps=2 pos=0 af=1.5',
      '---',
      '',
      'Spacing out practice beats massing it.',
      '',
      'massed practice yields {{c1::weaker}} retention ^sm6',
      '<!-- sr due=2024-02-01 st=review s=4 d=5 r=2 ivl=4 last=2024-01-28 pri=60 -->',
      '',
    ].join('\n'));

    expect(await read(dir, 'papers/german/cards.md')).toBe([
      '---',
      'type: deck',
      '---',
      '',
      'der Vorsatz :: resolution; intention ^sm9',
      '<!-- sr due=2024-02-04 st=review s=30 d=5 r=2 ivl=30 last=2024-01-05 pri=100 -->',
      '',
      'die Lücke :: gap ^sm10',
      '',
    ].join('\n'));

    expect(await read(dir, 'tasks/write the intro.md')).toBe([
      '---',
      'type: draft',
      'started: 2024-02-05',
      'pri: 80',
      'write: due=2024-02-05 ivl=1 reps=0 done=false',
      '---',
      '',
      'Write the introduction to the spacing paper.',
      '',
    ].join('\n'));

    expect(await read(dir, 'ideas/notes on reading.md')).toBe([
      '---',
      'type: source',
      'frozen: true',
      'imported: 2024-02-05',
      '---',
      '',
      'Read with a pencil.',
      '',
    ].join('\n'));
  });

  it("the queue for the fixture's last day holds its outstanding elements and its new cards", async () => {
    const { vault } = await importInto(KNO);
    const items = await queue(vault, NOON);
    const due = items.filter((i) => i.dueAt <= NOON);
    const key = (i: typeof items[number]) => (i.kind === 'card' ? `card ${i.id}` : `${i.kind} ${i.path}`);
    expect(due.map(key).sort()).toEqual([
      'card sm10', 'card sm5', 'card sm6', 'card sm7', 'card sm9',
      'read papers/Wozniak 1990.md', 'read papers/Wozniak 1990/spacing effect.md',
      'write tasks/write the intro.md',
    ]);
    // six were outstanding in SuperMemo (the fixture's Outstanding.sub), two are cards that were never repeated
    expect(due.filter((i) => i.kind !== 'card' || i.sched?.last !== undefined)).toHaveLength(6);
    expect(due).toHaveLength(items.length);
    // by priority: the paper and its unranked card at 0, its ranked card, the extract, the extract's card,
    // the deck's unranked card at its deck's 50, the task, the deck's ranked card
    expect(due.map((i) => i.pri)).toEqual([0, 0, 20, 40, 50, 60, 80, 100]);
  });

  it('reports what the layout does not cover and writes nothing for it', async () => {
    const kno = await variant({ unknownType: true, unknownComponent: true, badTrailer: true });
    const { vault, summary } = await importInto(kno);
    const messages = summary.diagnostics.map((d) => `${d.file}: ${d.message}`);
    expect(messages).toContain('info/ElementInfo.dat: element 17: unknown type 9, skipped');
    expect(messages).toContain('info/compon.dat: element 3: component kind 0x0a unknown, skipped');
    expect(messages).toContain('registry/Text.rtx: member 4: trailer names member 104; text not used');
    expect(messages).toHaveLength(3);
    expect(summary.skipped.unknown).toBe(1);
    // the extract lost its title and lands as `untitled`; everything else is as before
    expect(documents(vault.tree)).toEqual([
      'ideas/notes on reading.md',
      'papers/german/cards.md',
      'papers/Wozniak 1990.md',
      'papers/Wozniak 1990/untitled.md',
      'tasks/write the intro.md',
    ]);
    for (const path of vault.documents()) expect((await vault.read(path)).diagnostics, path).toEqual([]);
    expect(formatSummary(summary, '/v').split('\n').slice(0, 2)).toEqual(['fixture → /v', '4 folders · 2 sources · 1 extract · 1 deck · 5 cards · 1 draft']);
  });

  it('without a repetition history writes no repetition counts', async () => {
    const kno = await variant({ noHistory: true });
    const { dir, summary } = await importInto(kno);
    expect(summary.diagnostics).toEqual([]);
    const text = await read(dir, 'papers/Wozniak 1990.md');
    expect(text).toContain('read: due=2024-01-29 ivl=9 pos=0 af=2');
    expect(text).toContain('<!-- sr due=2024-01-30 st=review s=12 d=5 ivl=12 last=2024-01-18 pri=20 -->');
    expect(text).not.toContain(' r=');
  });

  it('refuses what is not a collection', async () => {
    const d = await tmp('ilmi-sm-none-');
    await expect(readCollection(smNodeFs, join(d, 'nothing.kno'))).rejects.toThrow('no collection folder');
    await expect(readCollection(smNodeFs, d)).rejects.toThrow('not a SuperMemo collection');
  });
});
