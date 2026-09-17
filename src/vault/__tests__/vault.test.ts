import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta, type Card } from '../../format/index.js';
import { nodeFs } from '../node-fs.js';
import { Vault, VaultConflict, documents, walk, type TreeNode, type VaultEvent } from '../index.js';

const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault/', import.meta.url));
const WOZ = 'papers/wozniak-1990.md';

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
    expect(names(papers.children)).toEqual(['archive/', 'crick-1995', 'wozniak-1990']);
    const woz = papers.children.find((n) => n.name === 'wozniak-1990');
    expect(woz).toMatchObject({ kind: 'doc', path: WOZ });
    expect(woz?.kind === 'doc' && woz.children && names(woz.children)).toEqual(['woz-ex1']);
  });

  it('ignores dot-directories and non-markdown files', async () => {
    await fsp.mkdir(join(root, '.obsidian'));
    await fsp.writeFile(join(root, '.obsidian/workspace.md'), 'x\n');
    await fsp.mkdir(join(root, '.ilmi'));
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
      'papers/archive/sutton-2019.md',
      'papers/crick-1995.md',
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
    expect(changedLines(before, after)).toEqual([15]);
    expect(after.split('\n')[14]).toBe(
      '<!-- sr due=2026-07-04 st=review s=22 d=3.8 r=9 l=0 ivl=22 last=2026-05-19T08:00:00Z g=3 -->',
    );
    expect(after.endsWith('\n')).toBe(true);
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
    expect(changedLines(edited, after)).toEqual([15]);
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
    await vault.changed([join(root, WOZ), join(root, `${WOZ}.ilmi-tmp`)]);
    expect(events).toEqual([]);
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

  it('ignores dot-directories, temp files, and paths outside the vault', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    await vault.changed([join(root, '.ilmi/state.json'), join(root, 'x.md.ilmi-tmp'), '/elsewhere/y.md']);
    expect(events).toEqual([]);
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
    await fsp.mkdir(join(root, '.ilmi'));
    await fsp.writeFile(join(root, '.ilmi/state.json'), '{not json');
    expect(await vault.loadState()).toEqual({});
  });

  it('merges and round-trips', async () => {
    await vault.saveState({ folders: ['papers'] });
    await vault.saveState({ tab: 'german.md' });
    expect(await vault.loadState()).toEqual({ folders: ['papers'], tab: 'german.md' });
    expect(JSON.parse(await readDisk('.ilmi/state.json'))).toEqual({ folders: ['papers'], tab: 'german.md' });
    expect(names(await walk(nodeFs, root))).not.toContain('.ilmi/');
  });
});
