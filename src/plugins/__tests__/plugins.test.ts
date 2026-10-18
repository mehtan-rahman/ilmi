// @vitest-environment jsdom
//
// The plugin runtime over the corpus vault in an in-memory fs: the sample
// loads, its command, action, block hook, setting, and grade ear work; a
// throwing plugin and an api mismatch are refused with a notice and leave
// the others alone; turning a plugin off takes everything back; files
// changing on disk reload it; a package installs.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from '../../format/index.js';
import { Vault, type Fs, type FsEntry, type FsStat } from '../../vault/index.js';
import type { Ilmi, Selection } from '../api.js';
import { contextOf, keyMatches, parseKey } from '../context.js';
import { API, PluginHost, cleanPluginPath, parseManifest, type Bridge } from '../runtime.js';
import { showModal, showPopover } from '../surfaces.js';

// jsdom gives `import.meta.url` an http scheme, so the paths come from the test's directory
const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault/');
const REPO = join(import.meta.dirname, '../../../');
const ROOT = '/v';

// ── an in-memory fs ──────────────────────────────────────────────

interface MemFs extends Fs {
  files: Map<string, string | Uint8Array>;
  dirs: Set<string>;
}

function memFs(): MemFs {
  const files = new Map<string, string | Uint8Array>();
  const dirs = new Set<string>();
  const stamps = new Map<string, number>();
  let clock = 1;
  const parent = (p: string) => p.slice(0, p.lastIndexOf('/'));
  const mkdirp = (p: string) => { for (let d = p; d && d !== '/'; d = parent(d)) dirs.add(d); };
  const touch = (p: string) => stamps.set(p, clock++);
  const size = (v: string | Uint8Array) => (typeof v === 'string' ? Buffer.byteLength(v) : v.length);
  const fs: MemFs = {
    files,
    dirs,
    async readDir(path): Promise<FsEntry[]> {
      if (!dirs.has(path)) throw new Error(`${path}: no such directory`);
      const out = new Map<string, FsEntry>();
      const pre = `${path}/`;
      for (const f of files.keys()) if (f.startsWith(pre) && !f.slice(pre.length).includes('/')) out.set(f, { name: f.slice(pre.length), isDir: false, isFile: true });
      for (const d of dirs) if (d.startsWith(pre) && !d.slice(pre.length).includes('/')) out.set(d, { name: d.slice(pre.length), isDir: true, isFile: false });
      return [...out.values()];
    },
    async stat(path): Promise<FsStat | null> {
      const v = files.get(path);
      if (v !== undefined) return { mtimeMs: stamps.get(path) ?? 0, size: size(v), isDir: false };
      if (dirs.has(path)) return { mtimeMs: 0, size: 0, isDir: true };
      return null;
    },
    async readText(path) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`${path}: no such file`);
      return typeof v === 'string' ? v : new TextDecoder().decode(v);
    },
    async writeText(path, text) {
      if (!dirs.has(parent(path))) throw new Error(`${parent(path)}: no such directory`);
      files.set(path, text);
      touch(path);
    },
    async readBytes(path) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`${path}: no such file`);
      return typeof v === 'string' ? new TextEncoder().encode(v) : v;
    },
    async writeBytes(path, bytes) {
      files.set(path, bytes);
      touch(path);
    },
    async rename(from, to) {
      const v = files.get(from);
      if (v !== undefined) {
        files.delete(from);
        files.set(to, v);
        touch(to);
        return;
      }
      if (!dirs.has(from)) throw new Error(`${from}: no such file`);
      for (const d of [...dirs]) if (d === from || d.startsWith(`${from}/`)) { dirs.delete(d); dirs.add(to + d.slice(from.length)); }
      for (const [f, val] of [...files]) if (f.startsWith(`${from}/`)) { files.delete(f); files.set(to + f.slice(from.length), val); }
    },
    async mkdir(path) { mkdirp(path); },
    async remove(path) {
      files.delete(path);
      for (const d of [...dirs]) if (d === path || d.startsWith(`${path}/`)) dirs.delete(d);
      for (const f of [...files.keys()]) if (f.startsWith(`${path}/`)) files.delete(f);
    },
    async watch() { return () => {}; },
  };
  mkdirp(ROOT);
  return fs;
}

/** The corpus vault, `.ilmi/plugins/` included, copied into the fs. */
function seed(fs: MemFs): void {
  const visit = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const rel = relative(CORPUS, p).split('\\').join('/');
      if (statSync(p).isDirectory()) {
        fs.dirs.add(`${ROOT}/${rel}`);
        visit(p);
      } else {
        fs.files.set(`${ROOT}/${rel}`, readFileSync(p, 'utf8'));
      }
    }
  };
  visit(CORPUS);
}

/** Another plugin in the fs, as a folder; `code` is the bundle. */
function addPlugin(fs: MemFs, id: string, code: string, manifest: Record<string, unknown> = {}): void {
  const dir = `${ROOT}/.ilmi/plugins/${id}`;
  fs.dirs.add(dir);
  fs.files.set(`${dir}/plugin.json`, JSON.stringify({ id, name: id, version: '1.0.0', api: 1, ...manifest }));
  fs.files.set(`${dir}/main.js`, code);
}

function enable(fs: MemFs, ids: string[]): void {
  fs.files.set(`${ROOT}/.ilmi/plugins.json`, JSON.stringify(ids));
}

// ── a bridge that remembers ──────────────────────────────────────

function fakeBridge() {
  const notices: string[] = [];
  const bridge: Bridge & { notices: string[]; opened: string[] } = {
    notices,
    opened: [],
    version: '0.1.0',
    notice: (t) => notices.push(t),
    fetch: async () => new Response('ok'),
    today: () => [{ kind: 'card', path: 'german.md', block: 3, text: 'x', due: '2026-10-18T12:00:00.000Z', pri: 50 }],
    onQueue: () => () => {},
    current: () => null,
    activeLens: () => ({ path: 'german.md', kind: 'deck' }),
    openLens: (p) => bridge.opened.push(p),
    popover: showPopover,
    modal: showModal,
    addStyle: (id, css) => {
      const el = document.createElement('style');
      el.dataset.plugin = id;
      el.textContent = css;
      document.head.appendChild(el);
      return () => el.remove();
    },
  };
  return bridge;
}

const SEL: Selection = { text: 'three little words', path: 'papers/wozniak-1990.md', block: 2, rect: { top: 10, left: 10, bottom: 30, right: 200, width: 190, height: 20 }, context: 'three little words.' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The handle a test plugin stashes on `globalThis`. */
declare global {
  // eslint-disable-next-line no-var
  var __ilmi: Ilmi | undefined;
  // eslint-disable-next-line no-var
  var __off: number | undefined;
}

const KEEP_HANDLE = `module.exports.activate = (ilmi) => { globalThis.__ilmi = ilmi; ilmi.onDeactivate(() => { globalThis.__off = (globalThis.__off ?? 0) + 1; }); };`;

let fs: MemFs;
let vault: Vault;
let bridge: ReturnType<typeof fakeBridge>;
let host: PluginHost;

async function open(): Promise<void> {
  vault = await Vault.open(fs, ROOT);
  bridge = fakeBridge();
  host = new PluginHost(vault, bridge);
  await host.start();
}

beforeEach(async () => {
  fs = memFs();
  seed(fs);
  globalThis.__ilmi = undefined;
  globalThis.__off = undefined;
  await open();
});

afterEach(() => {
  host.stop();
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-plugin]').forEach((el) => el.remove());
});

describe('the sample, from the corpus', () => {
  it('is on, with its row, its style, and the walk unaware of .ilmi', () => {
    expect(host.rows()).toEqual([expect.objectContaining({ id: 'hello', name: 'hello', version: '0.1.0', author: 'ilmi', enabled: true, state: 'on', hasSettings: true })]);
    expect(document.head.querySelector('style[data-plugin="hello"]')?.textContent).toContain('.hello-lit');
    expect(vault.documents().some((d) => d.startsWith('.ilmi'))).toBe(false);
    expect(vault.tree.map((n) => n.name)).toEqual(['books', 'essays', 'fleeting', 'papers', 'german']);
  });

  it('adds a command the palette lists and runs', () => {
    expect(host.pluginCommands()).toEqual([{ id: 'plugin:hello:say-hi', title: 'hello: say hi', plugin: 'hello' }]);
    expect(host.runCommand('plugin:hello:say-hi')).toBe(true);
    expect(bridge.notices).toEqual(['hi']);
    expect(host.runCommand('plugin:nobody:x')).toBe(false);
  });

  it('adds a verb to the selection cue', () => {
    expect(host.actionsFor(SEL)).toEqual([{ id: 'hello:count', name: 'hello: count' }]);
    expect(host.runAction('hello:count', SEL)).toBe(true);
    expect(bridge.notices).toEqual(['3 words']);
    expect(host.runAction('hello:count', { ...SEL, text: 'one' })).toBe(true);
    expect(bridge.notices[1]).toBe('1 word');
  });

  it('lights [hello] in a drawn block, once', () => {
    const p = document.createElement('p');
    p.textContent = 'say [hello] to the margin, and [hello] again';
    const ctx = { path: 'x.md', block: 0, where: 'reader' as const };
    host.runBlockHooks(p, ctx);
    expect(p.querySelectorAll('.hello-lit').length).toBe(2);
    expect(p.textContent).toBe('say [hello] to the margin, and [hello] again');
    host.runBlockHooks(p, ctx);
    expect(p.querySelectorAll('.hello-lit').length).toBe(2);
    const plain = document.createElement('p');
    plain.innerHTML = 'nothing <em>here</em>';
    host.runBlockHooks(plain, ctx);
    expect(plain.innerHTML).toBe('nothing <em>here</em>');
  });

  it('round-trips a setting through data.json', async () => {
    expect(host.settingsOf('hello')).toEqual([{ kind: 'text', key: 'greeting', label: 'greeting', placeholder: 'hi' }]);
    expect(host.settingValue('hello', 'greeting')).toBeUndefined();
    await host.setSetting('hello', 'greeting', 'salaam');
    expect(JSON.parse(fs.files.get(`${ROOT}/.ilmi/plugins/hello/data.json`) as string)).toEqual({ greeting: 'salaam' });
    host.runCommand('plugin:hello:say-hi');
    expect(bridge.notices).toEqual(['salaam']);
    // a fresh runtime over the same files reads it back
    host.stop();
    await open();
    expect(host.settingValue('hello', 'greeting')).toBe('salaam');
    await host.setSetting('hello', 'greeting', '');
    expect(JSON.parse(fs.files.get(`${ROOT}/.ilmi/plugins/hello/data.json`) as string)).toEqual({});
  });

  it('hears a grade', () => {
    host.emit('grade', { element: { kind: 'card', path: 'german.md', block: 3, due: '2026-10-18T12:00:00.000Z', pri: 50 }, grade: 3, card: null });
    expect(bridge.notices).toEqual(['hello saw a 3']);
  });

  it('takes everything back when turned off, and gives it back when turned on', async () => {
    await host.setEnabled('hello', false);
    expect(host.rows()[0]).toMatchObject({ enabled: false, state: 'off', hasSettings: false });
    expect(JSON.parse(fs.files.get(`${ROOT}/.ilmi/plugins.json`) as string)).toEqual([]);
    expect(host.pluginCommands()).toEqual([]);
    expect(host.actionsFor(SEL)).toEqual([]);
    expect(host.hasBlockHooks()).toBe(false);
    expect(host.settingsOf('hello')).toEqual([]);
    expect(document.head.querySelector('style[data-plugin="hello"]')).toBeNull();
    host.emit('grade', { element: { kind: 'card', path: 'german.md', due: '2026-10-18T12:00:00.000Z', pri: 50 }, grade: 1, card: null });
    expect(bridge.notices).toEqual([]);
    await host.setEnabled('hello', true);
    expect(host.rows()[0]).toMatchObject({ enabled: true, state: 'on' });
    expect(JSON.parse(fs.files.get(`${ROOT}/.ilmi/plugins.json`) as string)).toEqual(['hello']);
    expect(host.pluginCommands().length).toBe(1);
    expect(document.head.querySelector('style[data-plugin="hello"]')).not.toBeNull();
  });
});

describe('the handle', () => {
  beforeEach(async () => {
    host.stop();
    addPlugin(fs, 't', KEEP_HANDLE);
    enable(fs, ['hello', 't']);
    await open();
  });

  it('names the api, the app, and the manifest', () => {
    const ilmi = globalThis.__ilmi!;
    expect(ilmi.api).toBe(API);
    expect(ilmi.version).toBe('0.1.0');
    expect(ilmi.manifest).toEqual({ id: 't', name: 't', version: '1.0.0', api: 1 });
    expect(ilmi.vault.name).toBe('v');
    expect(ilmi.vault.list()).toContain('german.md');
    expect(ilmi.lens.active()).toEqual({ path: 'german.md', kind: 'deck' });
    expect(ilmi.queue.today()[0]).toMatchObject({ kind: 'card', path: 'german.md' });
  });

  it('addCard creates the deck, which parses clean, and appends to it', async () => {
    const ilmi = globalThis.__ilmi!;
    expect(await ilmi.vault.addCard('vocab.md', 'كتاب :: book')).toBe(0);
    const text = await ilmi.vault.read('vocab.md');
    expect(text).toBe('---\ntype: deck\n---\n\nكتاب :: book\n');
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(doc.blocks).toEqual([{ kind: 'card', text: 'كتاب :: book' }]);
    expect(vault.documents()).toContain('vocab.md');
    expect(await ilmi.vault.addCard('vocab', 'قلم :: pen\nwith context', { sched: { pri: 30 } })).toBe(1);
    const second = parse(await ilmi.vault.read('vocab.md'));
    expect(second.diagnostics).toEqual([]);
    expect(second.doc.blocks[1]).toEqual({ kind: 'card', text: 'قلم :: pen\nwith context', sched: { pri: 30 } });
    // into a folder that is there, and the deck already a deck
    expect(await ilmi.vault.addCard('german.md', 'der Tisch ::: table')).toBeGreaterThan(0);
    await expect(ilmi.vault.addCard('vocab.md', 'just prose')).rejects.toThrow('not a card');
    await expect(ilmi.vault.addCard('../out.md', 'a :: b')).rejects.toThrow('outside the vault');
  });

  it('reads, updates, writes, creates, and lands a source', async () => {
    const ilmi = globalThis.__ilmi!;
    const doc = await ilmi.vault.doc('german.md');
    expect(doc.blocks.some((b) => b.kind === 'card')).toBe(true);
    await ilmi.vault.update('german.md', (d) => { d.blocks.push({ kind: 'paragraph', text: 'a note from a plugin' }); });
    expect(await ilmi.vault.read('german.md')).toContain('a note from a plugin\n');
    expect(ilmi.format.meta(await ilmi.vault.doc('german.md')).type).toBe('deck');
    const made = await ilmi.vault.create('fleeting/from a plugin.md', '# hi\n\nsome text\n');
    expect(made).toBe('fleeting/from a plugin.md');
    expect(await ilmi.vault.read(made)).toBe('# hi\n\nsome text\n');
    await ilmi.vault.write(made, 'rewritten\n');
    expect(await ilmi.vault.read(made)).toBe('rewritten\n');
    const src = await ilmi.vault.addSource('papers', { title: 'A Plugin Paper', text: 'first paragraph\n\nsecond' });
    expect(src).toBe('papers/A Plugin Paper.md');
    expect(ilmi.format.meta(await ilmi.vault.doc(src)).frozen).toBe(true);
    await ilmi.vault.remove(made);
    expect(ilmi.vault.list()).not.toContain(made);
    expect(ilmi.format.cardForm('a :: b')).toBe('qa');
    expect(ilmi.format.cardForm('prose')).toBeNull();
    expect(ilmi.format.serialize(ilmi.format.parse('x\n').doc)).toBe('x\n');
  });

  it('keeps its data in data.json and hears changes', async () => {
    const ilmi = globalThis.__ilmi!;
    const seen: unknown[] = [];
    ilmi.store.on('change', (d) => seen.push(d));
    expect(await ilmi.store.load()).toEqual({});
    await ilmi.store.save({ a: 1 });
    expect(JSON.parse(fs.files.get(`${ROOT}/.ilmi/plugins/t/data.json`) as string)).toEqual({ a: 1 });
    expect(ilmi.store.get('a')).toBe(1);
    expect(seen).toEqual([{ a: 1 }]);
  });

  it('opens a popover and a modal that close on escape, and a lens', () => {
    const ilmi = globalThis.__ilmi!;
    const el = document.createElement('div');
    el.textContent = 'a definition';
    const pop = ilmi.ui.popover(SEL.rect, el);
    expect(document.querySelector('.plug-pop')?.textContent).toBe('a definition');
    expect(pop.el.style.top).toBe('38px');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // the listeners attach a tick later; close() is the sure way
    pop.close();
    expect(document.querySelector('.plug-pop')).toBeNull();
    const m = ilmi.ui.modal(el);
    expect(document.querySelector('.plug-overlay .plug-modal')).not.toBeNull();
    m.close();
    expect(document.querySelector('.plug-overlay')).toBeNull();
    ilmi.lens.open('german.md');
    expect(bridge.opened).toEqual(['german.md']);
    ilmi.ui.notice('from t');
    expect(bridge.notices).toEqual(['from t']);
  });

  it('refuses the cue keys and the vault edge', () => {
    const ilmi = globalThis.__ilmi!;
    expect(() => ilmi.selection.addAction({ id: 'x', name: 'x', key: 'e', run() {} })).toThrow('belongs to the cue');
    expect(() => cleanPluginPath('a/../../b')).toThrow('outside the vault');
    expect(cleanPluginPath('/a//b/./c.md')).toBe('a/b/c.md');
  });

  it('runs onDeactivate once when turned off, and the handle is then dead', async () => {
    const ilmi = globalThis.__ilmi!;
    await host.setEnabled('t', false);
    expect(globalThis.__off).toBe(1);
    expect(() => ilmi.commands.add({ id: 'late', name: 'late', run() {} })).toThrow('t is off');
    host.stop();
    expect(globalThis.__off).toBe(1);
  });
});

describe('faults', () => {
  it('a plugin that throws on activate is off for the session, with a notice; the others stand', async () => {
    host.stop();
    addPlugin(fs, 'bad', `module.exports.activate = () => { throw new Error('boom'); };`);
    enable(fs, ['bad', 'hello']);
    await open();
    expect(bridge.notices).toEqual(['bad: boom']);
    expect(host.rows().map((r) => [r.id, r.state, r.error])).toEqual([['bad', 'failed', 'boom'], ['hello', 'on', undefined]]);
    expect(host.runCommand('plugin:hello:say-hi')).toBe(true);
    expect(bridge.notices[1]).toBe('hi');
  });

  it('a throw inside a callback deactivates that plugin and leaves the rest', async () => {
    host.stop();
    addPlugin(fs, 'flaky', `module.exports.activate = (ilmi) => {
      ilmi.commands.add({ id: 'go', name: 'flaky: go', run() { throw new Error('mid-run'); } });
      ilmi.session.on('grade', () => { throw new Error('on grade'); });
      ilmi.render.onBlock(() => { throw new Error('on block'); });
    };`);
    enable(fs, ['hello', 'flaky']);
    await open();
    expect(host.pluginCommands().length).toBe(2);
    host.runCommand('plugin:flaky:go');
    expect(bridge.notices).toEqual(['flaky: mid-run']);
    expect(host.rows().find((r) => r.id === 'flaky')).toMatchObject({ state: 'failed', error: 'mid-run', enabled: true });
    expect(host.pluginCommands().map((c) => c.id)).toEqual(['plugin:hello:say-hi']);
    expect(host.hasBlockHooks()).toBe(true);
    host.emit('grade', { element: { kind: 'card', path: 'german.md', due: '2026-10-18T12:00:00.000Z', pri: 50 }, grade: 4, card: null });
    expect(bridge.notices).toEqual(['flaky: mid-run', 'hello saw a 4']);
  });

  it('a rejected promise fails the plugin too', async () => {
    host.stop();
    addPlugin(fs, 'slow', `module.exports.activate = (ilmi) => { ilmi.commands.add({ id: 'go', name: 'slow: go', async run() { throw new Error('later'); } }); };`);
    enable(fs, ['slow']);
    await open();
    host.runCommand('plugin:slow:go');
    await sleep(0);
    expect(bridge.notices).toEqual(['slow: later']);
    expect(host.rows().find((r) => r.id === 'slow')?.state).toBe('failed');
  });

  it('an api mismatch is refused with a notice', async () => {
    host.stop();
    addPlugin(fs, 'old', KEEP_HANDLE, { api: 0, name: 'old one' });
    enable(fs, ['old', 'hello']);
    await open();
    expect(bridge.notices).toEqual(['old one was written for api 0, this is api 1']);
    expect(host.rows().find((r) => r.id === 'old')).toMatchObject({ state: 'refused', enabled: true, error: 'written for api 0, this is api 1' });
    expect(globalThis.__ilmi).toBeUndefined();
    expect(host.pluginCommands().length).toBe(1);
  });

  it('a folder without a readable manifest is a broken row, not a crash', async () => {
    host.stop();
    fs.dirs.add(`${ROOT}/.ilmi/plugins/junk`);
    fs.files.set(`${ROOT}/.ilmi/plugins/junk/plugin.json`, '{not json');
    fs.dirs.add(`${ROOT}/.ilmi/plugins/other`);
    fs.files.set(`${ROOT}/.ilmi/plugins/other/plugin.json`, JSON.stringify({ id: 'elsewhere', name: 'x', version: '1', api: 1 }));
    enable(fs, ['junk', 'hello']);
    await open();
    expect(host.rows().map((r) => [r.id, r.state, r.error])).toEqual([
      ['hello', 'on', undefined],
      ['junk', 'broken', 'plugin.json is not JSON'],
      ['other', 'broken', 'plugin.json says elsewhere, the folder is other'],
    ]);
    expect(bridge.notices).toEqual([]);
  });

  it('a `require` serves nothing', async () => {
    host.stop();
    addPlugin(fs, 'needy', `const x = require('left-pad'); module.exports.activate = () => {};`);
    enable(fs, ['needy']);
    await open();
    expect(bridge.notices).toEqual([`needy: require('left-pad'): plugins bundle their dependencies`]);
  });
});

describe('the files on disk', () => {
  it('reloads a running plugin when its bundle changes, with a notice', async () => {
    fs.files.set(`${ROOT}/.ilmi/plugins/hello/main.js`, `module.exports.activate = (ilmi) => { ilmi.commands.add({ id: 'two', name: 'hello: two', run() {} }); };`);
    await vault.changed([`${ROOT}/.ilmi/plugins/hello/main.js`]);
    await sleep(600);
    expect(bridge.notices).toEqual(['reloaded · hello']);
    expect(host.pluginCommands().map((c) => c.title)).toEqual(['hello: two']);
    expect(document.head.querySelector('style[data-plugin="hello"]')).not.toBeNull();
    // the same text again: nothing happens
    await vault.changed([`${ROOT}/.ilmi/plugins/hello/main.js`]);
    await sleep(600);
    expect(bridge.notices.length).toBe(1);
  });

  it('drops a plugin whose folder goes, and lists one that arrives', async () => {
    await fs.remove(`${ROOT}/.ilmi/plugins/hello`);
    await vault.changed([`${ROOT}/.ilmi/plugins/hello/main.js`, `${ROOT}/.ilmi/plugins/hello`]);
    await sleep(600);
    expect(bridge.notices).toEqual(['removed · hello']);
    expect(host.rows()).toEqual([]);
    expect(host.pluginCommands()).toEqual([]);
    addPlugin(fs, 'hello', KEEP_HANDLE, { version: '0.2.0' });
    await vault.changed([`${ROOT}/.ilmi/plugins/hello/plugin.json`]);
    await sleep(600);
    expect(host.rows()[0]).toMatchObject({ id: 'hello', version: '0.2.0', enabled: true, state: 'on' });
    expect(globalThis.__ilmi?.manifest.version).toBe('0.2.0');
  });

  it('follows plugins.json edited by hand', async () => {
    fs.files.set(`${ROOT}/.ilmi/plugins.json`, '[]');
    await vault.changed([`${ROOT}/.ilmi/plugins.json`]);
    await sleep(600);
    expect(host.rows()[0]).toMatchObject({ enabled: false, state: 'off' });
    fs.files.set(`${ROOT}/.ilmi/plugins.json`, '["hello"]');
    await vault.changed([`${ROOT}/.ilmi/plugins.json`]);
    await sleep(600);
    expect(host.rows()[0]).toMatchObject({ enabled: true, state: 'on' });
  });

  it('a data.json edited by hand reaches the plugin', async () => {
    fs.files.set(`${ROOT}/.ilmi/plugins/hello/data.json`, '{"greeting":"hallo"}');
    await vault.changed([`${ROOT}/.ilmi/plugins/hello/data.json`]);
    await sleep(600);
    expect(host.settingValue('hello', 'greeting')).toBe('hallo');
    expect(bridge.notices).toEqual([]);
  });
});

describe('adding one from a file', () => {
  const dist = (): Map<string, string> => {
    const dir = join(REPO, 'src/format/__tests__/corpus/vault/.ilmi/plugins/hello');
    return new Map(['plugin.json', 'main.js', 'style.css'].map((n) => [n, readFileSync(join(dir, n), 'utf8')]));
  };

  it('lands the sample again after its folder was removed, and turns it on', async () => {
    await host.setEnabled('hello', false);
    await fs.remove(`${ROOT}/.ilmi/plugins/hello`);
    await vault.changed([`${ROOT}/.ilmi/plugins/hello`]);
    await sleep(600);
    expect(host.rows()).toEqual([]);
    bridge.notices.length = 0;
    const r = await host.install(dist());
    expect(r).toEqual({ status: 'added', id: 'hello', name: 'hello' });
    expect(bridge.notices).toEqual(['added · hello']);
    expect(host.rows()[0]).toMatchObject({ id: 'hello', enabled: true, state: 'on' });
    expect(fs.files.has(`${ROOT}/.ilmi/plugins/hello/style.css`)).toBe(true);
    expect(JSON.parse(fs.files.get(`${ROOT}/.ilmi/plugins.json`) as string)).toEqual(['hello']);
    expect(host.pluginCommands().length).toBe(1);
  });

  it('refuses a package without a manifest or a bundle, and the same version twice', async () => {
    expect(await host.install(new Map([['main.js', 'x']]))).toEqual({ status: 'refused', reason: 'no plugin.json in that' });
    expect(await host.install(new Map([['plugin.json', '{"id":"a","name":"a","version":"1","api":1}']]))).toEqual({ status: 'refused', reason: 'no main.js in that' });
    expect(await host.install(new Map([['plugin.json', '{"id":"A B"}'], ['main.js', 'x']]))).toMatchObject({ status: 'refused' });
    expect(await host.install(dist())).toEqual({ status: 'taken', id: 'hello', name: 'hello', version: '0.1.0' });
    expect(bridge.notices).toEqual(['no plugin.json in that', 'no main.js in that', 'plugin.json needs an id of lowercase letters, digits, and hyphens', 'hello 0.1.0 is already here']);
  });

  it('offers a replace when the version differs, and replaces when told', async () => {
    const files = dist();
    files.set('plugin.json', files.get('plugin.json')!.replace('"0.1.0"', '"0.2.0"'));
    expect(await host.install(files)).toEqual({ status: 'replace', id: 'hello', name: 'hello', have: '0.1.0', incoming: '0.2.0' });
    expect(host.rows()[0]?.version).toBe('0.1.0');
    expect(await host.install(files, { replace: true })).toEqual({ status: 'added', id: 'hello', name: 'hello' });
    expect(host.rows()[0]).toMatchObject({ version: '0.2.0', state: 'on' });
    expect(bridge.notices).toEqual(['added · hello']);
  });
});

describe('the pure pieces', () => {
  it('parses a manifest', () => {
    expect(parseManifest('{"id":"dictionary","name":"dictionary","version":"0.1.0","api":1,"author":"n"}')).toEqual({ manifest: { id: 'dictionary', name: 'dictionary', version: '0.1.0', api: 1, author: 'n' } });
    expect(parseManifest('{"id":"d","name":"d","version":"1","api":"1"}')).toEqual({ manifest: { id: 'd', name: 'd', version: '1', api: 1 } });
    expect(parseManifest('[]')).toEqual({ error: 'plugin.json is not an object' });
    expect(parseManifest('{"id":"Dict","name":"d","version":"1","api":1}')).toEqual({ error: 'plugin.json needs an id of lowercase letters, digits, and hyphens' });
    expect(parseManifest('{"id":"d","version":"1","api":1}')).toEqual({ error: 'plugin.json needs a name' });
    expect(parseManifest('{"id":"d","name":"d","api":1}')).toEqual({ error: 'plugin.json needs a version' });
    expect(parseManifest('{"id":"d","name":"d","version":"1"}')).toEqual({ error: 'plugin.json needs an api version' });
    expect(parseManifest('{"id":"d","name":"d","version":"1","api":1}', 'e')).toEqual({ error: 'plugin.json says d, the folder is e' });
  });

  it('finds the sentence around a selection', () => {
    const text = 'Cramming is mass repetition compressed in time. It works for a day! Does it last? No.';
    expect(contextOf(text, 'compressed')).toBe('Cramming is mass repetition compressed in time.');
    expect(contextOf(text, 'works for a day')).toBe('It works for a day!');
    expect(contextOf(text, 'last')).toBe('Does it last?');
    expect(contextOf(text, 'day! Does')).toBe('It works for a day! Does it last?');
    expect(contextOf('line one\nline two here\nline three', 'two')).toBe('line two here');
    expect(contextOf('قرأتُ الكتابَ أمس؟ نعم.', 'الكتابَ')).toBe('قرأتُ الكتابَ أمس؟');
    expect(contextOf('elsewhere', 'missing')).toBe('missing');
    expect(contextOf('', 'word')).toBe('word');
    expect(contextOf('x', '  ')).toBe('');
  });

  it('reads key specs', () => {
    expect(parseKey('h')).toEqual({ key: 'h', mod: false, shift: false, alt: false });
    expect(parseKey('Mod+Shift+H')).toEqual({ key: 'h', mod: true, shift: true, alt: false });
    expect(parseKey('alt+d')).toEqual({ key: 'd', mod: false, shift: false, alt: true });
    expect(parseKey('hyper+x')).toBeNull();
    expect(parseKey('')).toBeNull();
    const ev = (key: string, m: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => ({ key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...m });
    expect(keyMatches(parseKey('d')!, ev('d'))).toBe(true);
    expect(keyMatches(parseKey('d')!, ev('d', { metaKey: true }))).toBe(false);
    expect(keyMatches(parseKey('mod+d')!, ev('d', { ctrlKey: true }))).toBe(true);
    expect(keyMatches(parseKey('shift+d')!, ev('D', { shiftKey: true }))).toBe(true);
    expect(keyMatches(parseKey('space')!, ev(' '))).toBe(true);
  });

  it('publishes the same types the app uses', () => {
    const api = readFileSync(join(REPO, 'src/plugins/api.ts'), 'utf8');
    const dts = readFileSync(join(REPO, 'plugins/ilmi.d.ts'), 'utf8');
    expect(dts.split('\n').slice(1).join('\n')).toBe(api);
    expect(dts.split('\n')[0]).toContain('npm run plugins');
  });
});
