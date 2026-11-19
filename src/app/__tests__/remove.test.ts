// @vitest-environment jsdom
// Every delete has the notice's undo (39, from 38's window check: ⌘⌫ on a
// note with nothing under it deleted at once, with no way back). Over a real
// vault: the notice says what went, its undo puts the file back.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { useApp } from '../store.js';

let vault: Vault;
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault, openDir: vi.fn() };
});

const { deleteNode, deleteNodes } = await import('../remove.js');
const { undoNotice } = await import('../land.js');
const { Writer } = await import('../writer.js');

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault');
const EIGEN = 'courses/linear-algebra/unit-2/eigenvalues.md';

describe('a delete', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-remove-'));
    await fsp.cp(CORPUS, dir, { recursive: true });
    vault = await Vault.open(nodeFs, dir);
    useApp.setState({ vault: dir, docs: {}, notice: null, log: [] });
  });
  afterEach(async () => {
    vault.close();
    await fsp.rm(dir, { recursive: true, force: true });
  });

  it('leaves a notice with undo, and undo brings the file back', async () => {
    const text = await fsp.readFile(join(dir, EIGEN), 'utf8');
    await deleteNode(EIGEN);
    expect(vault.documents()).not.toContain(EIGEN);
    expect(useApp.getState().notice).toMatchObject({ line: 'deleted · eigenvalues', undo: true });
    await undoNotice();
    expect(await fsp.readFile(join(dir, EIGEN), 'utf8')).toBe(text);
    expect(vault.documents()).toContain(EIGEN);
    expect(useApp.getState().log[0]).toBe('undone · eigenvalues');
  });

  it('writes what was typed on its page first, so undo puts back the last of it', async () => {
    // a page on it with an edit still in its pause (the menu's click took the focus a moment ago)
    const page = new Writer(vault, EIGEN);
    page.saw(await vault.read(EIGEN));
    page.schedule(() => [{ kind: 'paragraph', text: 'typed just before the delete' }]);
    await deleteNode(EIGEN);
    page.close();
    await undoNotice();
    expect(await fsp.readFile(join(dir, EIGEN), 'utf8')).toContain('typed just before the delete');
  });

  it('several deleted as one leave one notice, and its one undo brings them all back where they were', async () => {
    const LA = 'courses/linear-algebra';
    // an order of the directory's own, so "where they were" is more than the names' order
    await vault.setOrder(LA, ['vectors.md', 'unit-2', 'problem-set-1.md']);
    const order = [...vault.order[LA]!];
    const text = await fsp.readFile(join(dir, EIGEN), 'utf8');
    await deleteNodes([`${LA}/vectors.md`, `${LA}/unit-2`, 'german.md']);
    expect(vault.documents()).not.toContain(`${LA}/vectors.md`);
    expect(vault.documents()).not.toContain(EIGEN);
    expect(vault.documents()).not.toContain('german.md');
    expect(useApp.getState().notice).toMatchObject({ line: 'deleted · 3 items', undo: true });
    await undoNotice();
    expect(vault.documents()).toEqual(expect.arrayContaining([`${LA}/vectors.md`, EIGEN, 'german.md']));
    expect(await fsp.readFile(join(dir, EIGEN), 'utf8')).toBe(text);
    expect(vault.order[LA]).toEqual(order);
  });

  it('one of several that cannot go stops it there: the notice says how many went, and undo puts those back', async () => {
    const remove = vault.remove.bind(vault);
    vi.spyOn(vault, 'remove').mockImplementation((path) => (path === 'essays' ? Promise.reject(new Error('held')) : remove(path)));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await deleteNodes(['german.md', 'essays', EIGEN]);
    vi.restoreAllMocks();
    expect(vault.documents()).not.toContain('german.md');
    expect(vault.documents()).toContain(EIGEN);
    expect(useApp.getState().notice).toMatchObject({ line: 'deleted · 1 of 3 items', undo: true });
    await undoNotice();
    expect(vault.documents()).toContain('german.md');
  });
});
