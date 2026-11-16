// @vitest-environment jsdom
// What was read is logged where it is done, once each (FORMAT.md §1, *a
// reading line*): a pass, a postponement and a dismissal through
// `actOnDoc`, a section and an extract made through `sectionNode` and
// `extractNode`, a section dismissed from its heading. An undo takes the
// line back with a line of its own; the grades' log is as it was; the
// lines are in the month's file, come back when the collection is opened
// again, and go out with an export.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseReadings, parseReviews } from '../../format/index.js';
import { docItems, type ReadItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault');
const ROOT = '/collections/reading';
const WOZ = 'papers/wozniak-1990.md';
const FILE = `${ROOT}/.ilmi/reviews/2026-05.jsonl`;

type StoreFs = import('../../vault/index.js').StoreFs;
let fs: StoreFs;
const clock = { t: new Date('2026-05-27T09:00:00').getTime() };

vi.mock('../clock.js', () => ({ appNow: () => new Date(clock.t), setClockDay: () => {} }));
vi.mock('../collections.js', async (orig) => ({ ...(await orig<typeof import('../collections.js')>()), collectionFs: () => fs }));
vi.mock('../crdt.js', async (orig) => ({ ...(await orig<typeof import('../crdt.js')>()), startCrdt: async () => true, stopCrdt: () => {} }));
vi.mock('../keep.js', async (orig) => ({ ...(await orig<typeof import('../keep.js')>()), startMirror: async () => {}, stopMirror: () => {}, keepDatedSoon: () => {}, stopDated: () => {} }));
vi.mock('@tauri-apps/plugin-log', async (orig) => ({ ...(await orig<typeof import('@tauri-apps/plugin-log')>()), info: async () => {} }));
vi.mock('../../plugins/index.js', async (orig) => ({ ...(await orig<typeof import('../../plugins/index.js')>()), startPlugins: async () => ({}), stopPlugins: () => {} }));

const { memStore } = await import('../../vault/mem-store.js');
const { storeFs, importFolder, exportFolder } = await import('../../vault/index.js');
const { closeVault, currentVault, extractNode, logReading, openVault, sectionNode, unlogReading } = await import('../vault.js');
const { actOnDoc } = await import('../Session.js');
const { dismissSection } = await import('../sections.js');
const { useApp } = await import('../store.js');

const readings = () => useApp.getState().readings;
const said = () => readings().map((r) => `${r.read} ${r.doc}${r.sec ? ` § ${r.sec}` : ''}${r.to !== undefined ? ` to ${r.to}` : ''}`);
/** The log's appends are not awaited by what logs them: let them land. */
const landed = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); await currentVault()!.loadLog(); };
const item = async (): Promise<ReadItem> => docItems(WOZ, (await currentVault()!.read(WOZ)).doc, new Date(clock.t)).find((i): i is ReadItem => i.kind === 'read')!;

beforeAll(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fs = storeFs(memStore(), ROOT);
  await importFolder(nodeFs, CORPUS, fs, ROOT);
  await openVault(ROOT);
});
afterAll(() => { closeVault(); });

describe('the reading log', () => {
  it('nothing is logged until something is read; a pass, later and a dismissal each log one line, with where it was read to', async () => {
    expect(readings()).toEqual([]);
    await actOnDoc(await item(), 'on', 4);
    await landed();
    expect(said()).toEqual([`pass ${WOZ} to 4`]);
    expect(readings()[0]!.at).toBe('2026-05-27T' + new Date(clock.t).toISOString().slice(11, 19) + 'Z');
    clock.t += 60_000;
    await actOnDoc(await item(), 'postpone');
    await landed();
    expect(said()).toEqual([`pass ${WOZ} to 4`, `later ${WOZ}`]);
    expect(parseReadings(await fs.readText(FILE)).map((r) => r.read)).toEqual(['pass', 'later']);
    // the grades' log is not touched
    expect(useApp.getState().reviews).toEqual([]);
    expect(parseReviews(await fs.readText(FILE))).toEqual([]);
  });

  it('an undo takes the line back with a line of its own; done again in the same second it is its own line', async () => {
    unlogReading(WOZ);
    await landed();
    expect(said()).toEqual([`pass ${WOZ} to 4`]);
    const lines = parseReadings(await fs.readText(FILE));
    expect(lines.map((r) => r.read)).toEqual(['pass', 'later', 'undo']);
    expect(lines[2]).toMatchObject({ doc: WOZ, of: lines[1]!.at });
    // nothing more to take back of what this was not: a section's line is its own
    unlogReading(WOZ, 'no such section');
    expect(said()).toEqual([`pass ${WOZ} to 4`]);
    logReading(WOZ, 'later');
    await landed();
    expect(readings().at(-1)).toEqual({ at: `${lines[1]!.at.slice(0, 17)}01Z`, doc: WOZ, read: 'later' });
    expect((await currentVault()!.loadReadings()).map((r) => r.read)).toEqual(['pass', 'later']);
  });

  it('a section and an extract made log theirs: the section under its note and its heading; a section dismissed from its heading is done', async () => {
    clock.t += 60_000;
    const doc = (await currentVault()!.read(WOZ)).doc;
    const paras = doc.blocks.map((b, i) => (b.kind === 'paragraph' ? i : -1)).filter((i) => i >= 0);
    const text = (i: number) => { const b = doc.blocks[i]!; return b.kind === 'paragraph' ? b.text : ''; };
    const made = await sectionNode(WOZ, { text: text(paras[0]!), blocks: [paras[0]!] });
    const child = await extractNode(WOZ, { text: text(paras[1]!), blocks: [paras[1]!] });
    expect(child).toMatch(/^papers\/wozniak-1990\//);
    await dismissSection({ path: made.note, nth: 0, text: made.text } as Parameters<typeof dismissSection>[0]);
    await landed();
    expect(said().slice(2)).toEqual([`section ${made.note} § ${made.text}`, `extract ${WOZ}`, `done ${made.note} § ${made.text}`]);
    // made and dismissed within a second: the later line a second after, so an undo names one of them
    expect(readings().at(-1)!.at > readings().at(-3)!.at).toBe(true);
    // the section's undo takes its own line back, not the document's
    unlogReading(made.note, made.text);
    await landed();
    expect(said().slice(2)).toEqual([`section ${made.note} § ${made.text}`, `extract ${WOZ}`]);
  });

  it('opened again the readings are there, oldest first; an export holds the lines', async () => {
    const before = readings();
    closeVault();
    expect(readings()).toEqual([]);
    await openVault(ROOT);
    // one second's lines come back in the store's order (by their text), as a second's grades do
    const order = (l: typeof before) => [...l].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
    expect(order(readings())).toEqual(order(before));
    expect(readings().map((r) => r.at)).toEqual(before.map((r) => r.at));
    const out = join(await fsp.mkdtemp(join(tmpdir(), 'ilmi-reading-')), 'export');
    await exportFolder(fs, ROOT, nodeFs, out);
    const month = await fsp.readFile(join(out, '.ilmi/reviews/2026-05.jsonl'), 'utf8');
    expect(month).toBe(await fs.readText(FILE));
    expect(parseReadings(month).filter((r) => r.read === 'undo').length).toBe(2);
    expect(month.split('\n').filter(Boolean).every((l) => l.startsWith('{"at":"2026-05-27T') && l.includes('"read":"'))).toBe(true);
    await fsp.rm(join(out, '..'), { recursive: true, force: true });
  });
});
