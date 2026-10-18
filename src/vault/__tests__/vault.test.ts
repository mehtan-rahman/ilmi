import { promises as fsp, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta, type Card } from '../../format/index.js';
import { nodeFs } from '../node-fs.js';
import { Vault, VaultConflict, documents, walk, type TreeNode, type VaultEvent } from '../index.js';

const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault/', import.meta.url));
const WOZ = 'papers/wozniak-1990.md';
const DECK = 'german.md';

let root: string;
let vault: Vault;

beforeEach(async () => {
  root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-vault-'));
  await fsp.cp(CORPUS, root, { recursive: true });
  vault = await Vault.open(nodeFs, root);
});

afterEach(async () => {
  vault.close();
  await fsp.rm(root, { recursive: true, force: true });
});

const readDisk = (rel: string) => fsp.readFile(join(root, rel), 'utf8');

/** Lines that differ between two texts of equal length. */
function changedLines(a: string, b: string): number[] {
  const la = a.split('\n');
  const lb = b.split('\n');
  expect(lb.length).toBe(la.length);
  return la.flatMap((line, i) => (line === lb[i] ? [] : [i + 1]));
}

function firstScheduledCard(blocks: { kind: string }[]): Card {
  const card = blocks.find((b): b is Card => b.kind === 'card' && 'sched' in b);
  if (!card) throw new Error('no scheduled card');
  return card;
}

function names(nodes: TreeNode[]): string[] {
  return nodes.map((n) => (n.kind === 'folder' ? `${n.name}/` : n.name));
}

describe('walk', () => {
  it('builds the tree FORMAT.md §1 describes', async () => {
    expect(names(vault.tree)).toEqual(['books/', 'essays/', 'fleeting/', 'papers/', 'german']);
    const papers = vault.tree.find((n) => n.name === 'papers');
    expect(papers?.kind).toBe('folder');
    if (papers?.kind !== 'folder') return;
    expect(names(papers.children)).toEqual(['archive/', 'crick-1995', 'maxwell', 'two-pages', 'wozniak-1990']);
    // the PDF beside two-pages.md is its pages, attached by stem; the file itself is not a document
    const pair = papers.children.find((n) => n.name === 'two-pages');
    expect(pair).toMatchObject({ kind: 'doc', path: 'papers/two-pages.md', pdf: 'papers/two-pages.pdf' });
    expect(pair?.kind === 'doc' && pair.children && names(pair.children)).toEqual(['the ruler in the margin']);
    expect(vault.documents()).not.toContain('papers/two-pages.pdf');
    const woz = papers.children.find((n) => n.name === 'wozniak-1990');
    expect(woz).toMatchObject({ kind: 'doc', path: WOZ });
    expect(woz?.kind === 'doc' && woz.children && names(woz.children)).toEqual(['woz-ex1']);
  });

  it('ignores dot-directories and non-markdown files', async () => {
    await fsp.mkdir(join(root, '.obsidian'));
    await fsp.writeFile(join(root, '.obsidian/workspace.md'), 'x\n');
    await fsp.mkdir(join(root, '.ilmi'), { recursive: true });
    await fsp.writeFile(join(root, '.ilmi/state.json'), '{}\n');
    await fsp.writeFile(join(root, 'notes.txt'), 'x\n');
    await fsp.writeFile(join(root, 'papers/figure.png'), '');
    const tree = await walk(nodeFs, root);
    expect(names(tree)).toEqual(['books/', 'essays/', 'fleeting/', 'papers/', 'german']);
    expect(documents(tree)).not.toContain('notes.txt');
  });

  it('lists every document in tree order', () => {
    expect(vault.documents()).toEqual([
      'books/james-pluralistic-ch4.md',
      'essays/marginalia.md',
      'essays/spaced-composition.md',
      'essays/talk-incremental.md',
      'fleeting/2026-05-26.md',
      'fleeting/2026-05-27.md',
      'fleeting/clipped-page.md',
      'fleeting/markdown-sampler.md',
      'papers/archive/sutton-2019.md',
      'papers/crick-1995.md',
      'papers/maxwell.md',
      'papers/two-pages.md',
      'papers/two-pages/the ruler in the margin.md',
      'papers/wozniak-1990.md',
      'papers/wozniak-1990/woz-ex1.md',
      'german.md',
    ]);
  });
});

describe('read', () => {
  it('parses a document and keeps its diagnostics', async () => {
    const loaded = await vault.read(WOZ);
    expect(meta(loaded.doc)).toMatchObject({ type: 'source', frozen: true });
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.stamp).not.toBeNull();

    await fsp.writeFile(join(root, 'broken.md'), 'prose\n<!-- sr due=2026-01-01 -->\n');
    const broken = await vault.read('broken.md');
    expect(broken.diagnostics.length).toBeGreaterThan(0);
    expect(vault.diagnostics('broken.md')).toBe(broken.diagnostics);
  });

  it('serves the cache until told the file changed', async () => {
    const a = await vault.read(WOZ);
    expect(await vault.read(WOZ)).toBe(a);
    expect(await vault.read(WOZ, true)).not.toBe(a);
  });
});

describe('write', () => {
  it('changes one card schedule on disk by one line', async () => {
    const before = await readDisk(WOZ);
    await vault.update(WOZ, (doc) => {
      firstScheduledCard(doc.blocks).sched!.due = '2026-07-04';
    });
    const after = await readDisk(WOZ);
    expect(changedLines(before, after)).toEqual([16]);
    expect(after.split('\n')[15]).toBe(
      '<!-- sr due=2026-07-04 st=review s=22 d=3.8 r=9 l=0 ivl=22 last=2026-05-19T08:00:00Z g=3 -->',
    );
    expect(after.endsWith('\n')).toBe(true);
  });

  it('removes one card with its id and schedule, nothing else', async () => {
    const before = (await readDisk(DECK)).split('\n');
    const { doc } = await vault.read(DECK);
    const n = doc.blocks.filter((b) => b.kind === 'card').length;
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-gedacht');
    const written = await vault.removeCard(DECK, i, 'cv-gedacht');
    expect(written.doc.blocks.filter((b) => b.kind === 'card')).toHaveLength(n - 1);
    expect(written.doc.blocks.some((b) => b.kind === 'card' && b.id === 'cv-gedacht')).toBe(false);
    const after = await readDisk(DECK);
    expect(after).not.toContain('cv-gedacht');
    expect(after.split('\n')).toEqual(before.filter((l) => !l.includes('das Gedächtnis') && !l.includes('s=14 d=3.4')).filter((l, k, a) => !(l === '' && a[k - 1] === '')));
  });

  it('finds a moved card by id, and refuses a card that is not there', async () => {
    await vault.removeCard(DECK, 0, 'cv-gedacht');
    const { doc } = await vault.read(DECK);
    expect(doc.blocks.some((b) => b.kind === 'card' && b.id === 'cv-gedacht')).toBe(false);
    await expect(vault.removeCard(DECK, 0, 'cv-gedacht')).rejects.toThrow(/no such card/);
    await expect(vault.removeCard(DECK, 999)).rejects.toThrow(/no such card/);
  });

  it('finds an id-less card by its text when another card slid into its index', async () => {
    const text = 'ein Wort ohne Karte ::: a word without a card';
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.text === text);
    expect(doc.blocks[i]).toEqual({ kind: 'card', text });
    // a card is added above it on disk before the vault hears of it
    const disk = await readDisk(DECK);
    await fsp.writeFile(join(root, DECK), disk.replace('vergessen ::: to forget ^', 'neu ::: new\n\nvergessen ::: to forget ^'));
    await expect(vault.removeCard(DECK, i, undefined, 'nothing like it')).rejects.toThrow(/no such card/);
    const written = await vault.removeCard(DECK, i, undefined, text);
    expect(written.doc.blocks.some((b) => b.kind === 'card' && b.text === text)).toBe(false);
    expect(written.doc.blocks.some((b) => b.kind === 'card' && b.id === 'cv-cloze')).toBe(true);
    expect((await readDisk(DECK)).split('\n')).toEqual(disk.replace('vergessen ::: to forget ^', 'neu ::: new\n\nvergessen ::: to forget ^').split('\n').filter((l) => l !== text).slice(0, -1));
  });

  it('resets one card by dropping its sr line and nothing else', async () => {
    const before = (await readDisk(DECK)).split('\n');
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-gedacht');
    const written = await vault.resetCard(DECK, i, 'cv-gedacht');
    const card = written.doc.blocks[i];
    expect(card).toEqual({ kind: 'card', text: 'das Gedächtnis ::: memory', id: 'cv-gedacht' });
    // line 14 is the card's schedule; every other line stays put
    expect((await readDisk(DECK)).split('\n')).toEqual(before.filter((_, k) => k !== 13));
    // a second reset changes nothing and still resolves
    const again = await vault.resetCard(DECK, i, 'cv-gedacht');
    expect(again.text).toBe(written.text);
  });

  it('resets a cloze card with per-blank schedules', async () => {
    const before = (await readDisk(WOZ)).split('\n');
    const { doc } = await vault.read(WOZ);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cw2-min');
    expect(doc.blocks[i]).toHaveProperty('blanks');
    const written = await vault.resetCard(WOZ, i, 'cw2-min');
    const card = written.doc.blocks[i];
    expect(card?.kind).toBe('card');
    expect(card).not.toHaveProperty('sched');
    expect(card).not.toHaveProperty('blanks');
    expect(card).toHaveProperty('id', 'cw2-min');
    // lines 25 and 26 are the c1 and c2 schedules
    expect((await readDisk(WOZ)).split('\n')).toEqual(before.filter((_, k) => k !== 24 && k !== 25));
  });

  it('keeps a card\'s own priority through a reset', async () => {
    const { doc } = await vault.read(WOZ);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cw1-paths');
    await vault.update(WOZ, (d) => { const c = d.blocks[i]; if (c?.kind === 'card') c.sched = { ...c.sched, pri: 20 }; });
    expect(await readDisk(WOZ)).toContain(' g=3 pri=20 -->');
    const written = await vault.resetCard(WOZ, i, 'cw1-paths');
    expect(written.doc.blocks[i]).toEqual({ kind: 'card', text: expect.any(String), id: 'cw1-paths', sched: { pri: 20 } });
    expect((await readDisk(WOZ)).split('\n')).toContain('<!-- sr pri=20 -->');
  });

  it('moves a card to the end of another document with its schedule', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    const srcBefore = (await readDisk(DECK)).split('\n');
    const destBefore = (await readDisk(WOZ)).split('\n');
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    const card = doc.blocks[i];
    const dest = await vault.moveCard(DECK, i, WOZ, 'cv-vergessen');
    expect(dest.path).toBe(WOZ);
    expect(dest.doc.blocks[dest.doc.blocks.length - 1]).toEqual(card);
    // the card's two lines and the blank after them leave the source
    expect((await readDisk(DECK)).split('\n')).toEqual(srcBefore.filter((_, k) => k < 15 || k > 17));
    // and land after a blank line at the end of the destination
    expect((await readDisk(WOZ)).split('\n')).toEqual([...destBefore.slice(0, -1), '', srcBefore[15], srcBefore[16], '']);
    // destination first, then source, each through the normal event
    expect(events.map((e) => e.kind === 'doc' && e.path)).toEqual([WOZ, DECK]);
    expect(await vault.read(WOZ)).toBe(dest);
  });

  it('moves a card without its extract backrefs', async () => {
    await vault.update(WOZ, (doc) => {
      const card = firstScheduledCard(doc.blocks);
      card.extracts = ['woz-ex1'];
    });
    const { doc } = await vault.read(WOZ);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cw1-paths');
    expect(doc.blocks[i]).toHaveProperty('extracts', ['woz-ex1']);
    const woz = (await readDisk(WOZ)).split('\n');
    const k = woz.findIndex((l) => l.endsWith('^cw1-paths'));
    expect(woz.slice(k + 1, k + 4).map((l) => l.slice(0, 12))).toEqual(['<!-- sr due=', '<!-- extract', '']);
    const dest = await vault.moveCard(WOZ, i, DECK, 'cw1-paths');
    const moved = dest.doc.blocks[dest.doc.blocks.length - 1];
    expect(moved).toMatchObject({ kind: 'card', id: 'cw1-paths' });
    expect(moved).toHaveProperty('sched');
    expect(moved).not.toHaveProperty('extracts');
    expect(dest.diagnostics).toEqual([]);
    // the card, its schedule, its backref, and the blank after them leave the source
    expect((await readDisk(WOZ)).split('\n')).toEqual(woz.filter((_, n) => n < k || n > k + 3));
    // and the card and its schedule, without the backref, end the destination
    expect((await readDisk(DECK)).split('\n').slice(-3)).toEqual([woz[k], woz[k + 1], '']);
  });

  it('moves the card as it is on disk, not as the cache last saw it', async () => {
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    // an edit the watcher has not delivered yet
    const disk = await readDisk(DECK);
    await fsp.writeFile(join(root, DECK), disk.replace('vergessen ::: to forget ^', 'vergessen ::: to forget; to leave behind ^'));
    const dest = await vault.moveCard(DECK, i, WOZ, 'cv-vergessen');
    expect(dest.doc.blocks[dest.doc.blocks.length - 1]).toMatchObject({ kind: 'card', text: 'vergessen ::: to forget; to leave behind', id: 'cv-vergessen' });
    expect(await readDisk(WOZ)).toContain('vergessen ::: to forget; to leave behind ^cv-vergessen');
    expect(await readDisk(DECK)).not.toContain('vergessen');
  });

  it('leaves a card that changed between the two writes in the source, so it is in both files', async () => {
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    const disk = await readDisk(DECK);
    // the source changes the moment the destination is written
    const off = vault.subscribe((ev) => {
      if (ev.kind === 'doc' && ev.path === WOZ) writeFileSync(join(root, DECK), disk.replace('vergessen ::: to forget ^', 'vergessen ::: to forget; to leave behind ^'));
    });
    await expect(vault.moveCard(DECK, i, WOZ, 'cv-vergessen')).rejects.toBeInstanceOf(VaultConflict);
    off();
    expect(await readDisk(DECK)).toContain('vergessen ::: to forget; to leave behind ^cv-vergessen');
    expect(await readDisk(WOZ)).toContain('vergessen ::: to forget ^cv-vergessen');
  });

  it('mints a fresh id when the destination already has one', async () => {
    const stranger = { kind: 'card' as const, text: 'to forget ::: oublier', id: 'cv-vergessen', sched: { due: '2026-08-01' } };
    await vault.update(WOZ, (doc) => {
      doc.blocks.push(structuredClone(stranger));
    });
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    const dest = await vault.moveCard(DECK, i, WOZ, 'cv-vergessen');
    const blocks = dest.doc.blocks;
    expect(blocks[blocks.length - 2]).toEqual(stranger);
    const moved = blocks[blocks.length - 1];
    expect(moved).toMatchObject({ kind: 'card', text: 'vergessen ::: to forget', sched: { due: '2026-06-02', stability: 6 } });
    expect(moved?.kind === 'card' && moved.id).toMatch(/^c[a-z0-9]{6}$/);
    expect(blocks.filter((b) => b.kind === 'card' && b.id === 'cv-vergessen')).toHaveLength(1);
    expect(await readDisk(DECK)).not.toContain('cv-vergessen');
    // on disk the fresh id sits on the paragraph line, the schedule directly under it, after the stranger
    expect((await readDisk(WOZ)).split('\n').slice(-6)).toEqual([
      'to forget ::: oublier ^cv-vergessen',
      '<!-- sr due=2026-08-01 -->',
      '',
      `vergessen ::: to forget ^${moved?.kind === 'card' ? moved.id : ''}`,
      '<!-- sr due=2026-06-02 st=review s=6 d=4 r=5 l=0 ivl=6 last=2026-05-27T07:30:00Z g=3 -->',
      '',
    ]);
  });

  it('refuses to move a card to a missing document, or onto its own', async () => {
    const before = await readDisk(DECK);
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    await expect(vault.moveCard(DECK, i, 'papers/nope.md', 'cv-vergessen')).rejects.toThrow(/no such document/);
    await expect(vault.moveCard(DECK, i, 'papers', 'cv-vergessen')).rejects.toThrow(/no such document/);
    await expect(vault.moveCard(DECK, i, DECK, 'cv-vergessen')).rejects.toThrow(/onto/);
    expect(await readDisk(DECK)).toBe(before);
    await expect(vault.moveCard(DECK, 999, WOZ)).rejects.toThrow(/no such card/);
    expect(await readDisk(WOZ)).not.toContain('cv-vergessen');
  });

  it('writes atomically and leaves no temp file', async () => {
    await vault.update(WOZ, (doc) => {
      firstScheduledCard(doc.blocks).sched!.due = '2026-07-04';
    });
    const files = await fsp.readdir(join(root, 'papers'));
    expect(files.filter((f) => f.includes('tmp'))).toEqual([]);
  });

  it('keeps both sides of a concurrent edit', async () => {
    await vault.read(WOZ);
    const original = await readDisk(WOZ);
    const edited = original.replace('## §1 — the premise', '## §1 — the premise, revised');
    expect(edited).not.toBe(original);
    await fsp.writeFile(join(root, WOZ), edited);

    await vault.update(WOZ, (doc) => {
      firstScheduledCard(doc.blocks).sched!.due = '2026-07-04';
    });
    const after = await readDisk(WOZ);
    expect(after).toContain('## §1 — the premise, revised');
    expect(after).toContain('<!-- sr due=2026-07-04 st=review');
    expect(changedLines(edited, after)).toEqual([16]);
  });

  it('refuses a whole-doc overwrite when the file moved', async () => {
    const { doc } = await vault.read(WOZ);
    await fsp.appendFile(join(root, WOZ), '\nlate addition\n');
    await expect(vault.write(WOZ, doc)).rejects.toBeInstanceOf(VaultConflict);
    expect(await readDisk(WOZ)).toContain('late addition');
  });

  it('does not mistake its own write for an external change', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    const written = await vault.update(WOZ, (doc) => {
      firstScheduledCard(doc.blocks).sched!.due = '2026-07-04';
    });
    // the write itself is reported once; the watcher's echo of it is not
    expect(events).toEqual([{ kind: 'doc', path: WOZ, loaded: written }]);
    await vault.changed([join(root, WOZ), join(root, `${WOZ}.ilmi-tmp`)]);
    expect(events).toHaveLength(1);
    expect(await vault.read(WOZ)).toBe(written);
  });
});

describe('external changes', () => {
  it('re-reads a changed file and reports it', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    const before = await vault.read(WOZ);
    await fsp.writeFile(join(root, WOZ), before.text.replace('the premise', 'the PREMISE'));
    await vault.changed([join(root, WOZ)]);
    expect(events.map((e) => e.kind)).toEqual(['doc']);
    const after = await vault.read(WOZ);
    expect(after).not.toBe(before);
    expect(after.text).toContain('the PREMISE');
  });

  it('re-walks when files appear or disappear', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    await vault.read('german.md');
    await fsp.writeFile(join(root, 'papers/new-paper.md'), '# new\n');
    await fsp.rm(join(root, 'german.md'));
    await vault.changed(['papers/new-paper.md', 'german.md']);
    expect(events.map((e) => e.kind).sort()).toEqual(['gone', 'tree']);
    expect(vault.documents()).toContain('papers/new-paper.md');
    expect(vault.documents()).not.toContain('german.md');
  });

  it('reports dot-directory paths as hidden, and ignores temp files and paths outside the vault', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    await vault.changed([join(root, '.ilmi/state.json'), join(root, 'x.md.ilmi-tmp'), '/elsewhere/y.md']);
    expect(events).toEqual([{ kind: 'hidden', paths: ['.ilmi/state.json'] }]);
    expect(vault.documents()).not.toContain('.ilmi/state.json');
  });

  it('shows up through the real watcher', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    await vault.read(WOZ);
    await vault.watch();
    await new Promise((r) => setTimeout(r, 100));
    const before = await readDisk(WOZ);
    await fsp.writeFile(join(root, WOZ), before.replace('the premise', 'the PREMISE'));
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'doc')).toBe(true), { timeout: 3000 });
    expect((await vault.read(WOZ)).text).toContain('the PREMISE');
  });
});

describe('state', () => {
  it('is empty when absent or malformed', async () => {
    expect(await vault.loadState()).toEqual({});
    await fsp.mkdir(join(root, '.ilmi'), { recursive: true });
    await fsp.writeFile(join(root, '.ilmi/state.json'), '{not json');
    expect(await vault.loadState()).toEqual({});
  });

  it('merges and round-trips', async () => {
    await vault.saveState({ folders: ['papers'] });
    await vault.saveState({ tab: 'german.md' });
    await vault.saveState({ budget: 12 });
    expect(await vault.loadState()).toEqual({ folders: ['papers'], tab: 'german.md', budget: 12 });
    expect(JSON.parse(await readDisk('.ilmi/state.json'))).toEqual({ folders: ['papers'], tab: 'german.md', budget: 12 });
    expect(names(await walk(nodeFs, root))).not.toContain('.ilmi/');
  });
});
