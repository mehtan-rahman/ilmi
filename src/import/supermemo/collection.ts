// A SuperMemo collection read into memory: the tree, each element's title,
// texts, and schedule numbers, the ranks of the priority queue, and the
// day epoch. Pure over bytes and a small file system; nothing here knows
// about the vault or about HTML. LAYOUT.md says what each read rests on.

import type { FsEntry, FsStat } from '../../vault/fs.js';
import { TD_NEVER } from './bytes.js';
import {
  MEDIA, TEXTUAL, decodeText, readContents, readGroup, readHistory, readInfo, readInts, readMem, rtxText,
  type Diags, type ImportDiagnostic, type MemRecord,
} from './records.js';

/** What the reader needs: directory listing, stat, and bytes. */
export interface SmFs {
  readDir(path: string): Promise<FsEntry[]>;
  stat(path: string): Promise<FsStat | null>;
  readBytes(path: string): Promise<Uint8Array>;
}

export type SmType = 'topic' | 'item' | 'task' | 'template' | 'concept' | 'unknown';

const TYPES: Record<number, SmType> = { 0: 'topic', 1: 'item', 2: 'task', 3: 'template', 4: 'concept' };

/** One textual component: an HTML file, or a plain text from the registry. */
export interface SmText {
  kind: 'html' | 'text';
  body: string;
}

export interface SmElement {
  id: number;
  type: SmType;
  typeByte: number;
  deleted: boolean;
  parent: number;
  /** In tree order. */
  children: number[];
  title: string;
  /** Textual components in order; for an item the first is the question, the second the answer. */
  texts: SmText[];
  /** Image, sound, video, and spelling components, dropped. */
  media: number;
  interval: number;
  lastRepDay: number;
  lastTouch: number;
  af: number;
  /** Dated rows in the repetition history; absent when there is no history file. */
  reps?: number;
  /** 0-based position in `priority.sub`; absent when not listed. */
  rank?: number;
}

export interface Epoch {
  /** TDateTime day number that `lastRepDay` counts from. */
  day: number;
  /** Fraction of voting elements that agree with it. */
  agreement: number;
  samples: number;
}

export interface SmCollection {
  name: string;
  /** Absolute path of the collection folder. */
  dir: string;
  elements: Map<number, SmElement>;
  /** Live elements reachable from the root, depth first, parents first. */
  order: number[];
  /** How many elements `priority.sub` ranks. */
  ranked: number;
  epoch: Epoch | null;
  hasHistory: boolean;
  diagnostics: ImportDiagnostic[];
}

const joinPath = (dir: string, name: string) => (dir.endsWith('/') ? dir + name : `${dir}/${name}`);
const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** `dir/name`, matched without regard to case; `null` when absent. */
async function find(fs: SmFs, dir: string | null, name: string, wantDir = false): Promise<string | null> {
  if (dir === null) return null;
  const want = name.toLowerCase();
  for (const e of await fs.readDir(dir)) {
    if (e.name.toLowerCase() === want && (wantDir ? e.isDir : e.isFile)) return joinPath(dir, e.name);
  }
  return null;
}

async function bytesOf(fs: SmFs, dir: string | null, name: string): Promise<Uint8Array | null> {
  const p = await find(fs, dir, name);
  return p === null ? null : fs.readBytes(p);
}

/** Every file under `elements/`, by the integer stem of its name (LAYOUT.md §7). */
async function indexSlots(fs: SmFs, dir: string | null, diags: Diags): Promise<Map<number, string>> {
  const slots = new Map<number, string>();
  if (dir === null) return slots;
  const visit = async (d: string) => {
    for (const e of await fs.readDir(d)) {
      const p = joinPath(d, e.name);
      if (e.isDir) await visit(p);
      else if (e.isFile) {
        const stem = e.name.includes('.') ? e.name.slice(0, e.name.indexOf('.')) : e.name;
        if (!/^\d+$/.test(stem)) continue;
        const n = Number(stem);
        if (slots.has(n)) diags.push({ file: `elements/${e.name}`, message: `slot ${n} appears twice; the first is used` });
        else slots.set(n, p);
      }
    }
  };
  await visit(dir);
  return slots;
}

/** The collection folder for a `.kno` path or the folder itself. Throws when neither is there. */
export async function locate(fs: SmFs, path: string): Promise<{ name: string; dir: string }> {
  const st = await fs.stat(path);
  if (st?.isDir) return { name: baseName(path), dir: path };
  const m = /^(.*)\.kno$/i.exec(path);
  if (!m) throw new Error(`${path}: not a .kno file or a collection folder`);
  const dir = m[1]!;
  const ds = await fs.stat(dir);
  if (!ds?.isDir) throw new Error(`${dir}: no collection folder beside the .kno`);
  return { name: baseName(dir), dir };
}

/** LAYOUT.md §12: the mode of `floor(lastTouch) − lastRepDay`. */
function calibrate(elements: Iterable<SmElement>): Epoch | null {
  const votes = new Map<number, number>();
  for (const e of elements) {
    if (e.lastTouch < TD_NEVER || e.lastRepDay < 1) continue;
    const v = Math.floor(e.lastTouch) - e.lastRepDay;
    votes.set(v, (votes.get(v) ?? 0) + 1);
  }
  if (!votes.size) return null;
  let day = 0;
  let best = -1;
  let samples = 0;
  for (const [v, n] of votes) {
    samples += n;
    if (n > best || (n === best && v < day)) { best = n; day = v; }
  }
  return { day, agreement: best / samples, samples };
}

export async function readCollection(fs: SmFs, path: string): Promise<SmCollection> {
  const diags: Diags = [];
  const { name, dir } = await locate(fs, path);
  const infoDir = await find(fs, dir, 'info', true);
  const contentsB = await bytesOf(fs, infoDir, 'contents.dat');
  const infoB = await bytesOf(fs, infoDir, 'ElementInfo.dat');
  if (!contentsB || !infoB) throw new Error(`${dir}: not a SuperMemo collection (no info/contents.dat and info/ElementInfo.dat)`);

  const contents = readContents(contentsB, diags);
  const infos = readInfo(infoB, diags);
  if (contents.length !== infos.length) {
    diags.push({ file: 'info/ElementInfo.dat', message: `${infos.length} records against ${contents.length} in contents.dat; the first ${Math.min(contents.length, infos.length)} are read` });
  }
  const n = Math.min(contents.length, infos.length);

  // registry: titles and plain texts
  const registryDir = await find(fs, dir, 'registry', true);
  const memB = await bytesOf(fs, registryDir, 'Text.mem');
  const rtx = (await bytesOf(fs, registryDir, 'Text.rtx')) ?? new Uint8Array(0);
  const members: MemRecord[] = memB ? readMem(memB, diags, 'registry/Text.mem') : [];
  if (!memB) diags.push({ file: 'registry/Text.mem', message: 'missing; no titles or texts' });
  const textOfMember = (id: number, who: string): string | null => {
    if (id <= 0) return null;
    const m = members[id - 1];
    if (!m) { diags.push({ file: 'registry/Text.mem', message: `${who}: member ${id} is beyond the ${members.length} in the registry` }); return null; }
    return rtxText(rtx, m, diags, 'registry/Text.rtx');
  };

  const slots = await indexSlots(fs, await find(fs, dir, 'elements', true), diags);
  const componB = await bytesOf(fs, infoDir, 'compon.dat');

  const elements = new Map<number, SmElement>();
  for (let i = 0; i < n; i++) {
    const c = contents[i]!;
    const r = infos[i]!;
    const el: SmElement = {
      id: c.id,
      type: TYPES[r.typeByte] ?? 'unknown',
      typeByte: r.typeByte,
      deleted: c.deleted || r.titleId === -1,
      parent: c.parent,
      children: [],
      title: '',
      texts: [],
      media: 0,
      interval: r.interval,
      lastRepDay: r.lastRepDay,
      lastTouch: r.lastTouch,
      af: r.af,
    };
    elements.set(c.id, el);
  }

  // the tree, from the root by first child and next sibling
  const order: number[] = [];
  const seen = new Set<number>();
  const visit = (id: number) => {
    const el = elements.get(id)!;
    order.push(id);
    seen.add(id);
    let child = contents[id - 1]!.firstChild;
    while (child !== 0) {
      if (child < 1 || child > n) { diags.push({ file: 'info/contents.dat', message: `element ${id}: child ${child} is out of range` }); break; }
      if (seen.has(child)) { diags.push({ file: 'info/contents.dat', message: `element ${child} is reached twice; the tree is cut there` }); break; }
      const kid = elements.get(child)!;
      if (kid.parent !== id) diags.push({ file: 'info/contents.dat', message: `element ${child} says its parent is ${kid.parent}, not ${id}` });
      el.children.push(child);
      visit(child);
      child = contents[child - 1]!.nextSibling;
    }
  };
  if (n >= 1) visit(1);
  for (const el of elements.values()) {
    if (!seen.has(el.id) && !el.deleted) diags.push({ file: 'info/contents.dat', message: `element ${el.id}: not reachable from the root; skipped` });
  }

  // titles and texts, for what the tree reaches
  for (const id of order) {
    const el = elements.get(id)!;
    if (el.deleted) continue;
    const r = infos[id - 1]!;
    const who = `element ${id}`;
    el.title = textOfMember(r.titleId, who) ?? '';
    if (r.componPos < 0) continue;
    if (!componB) { diags.push({ file: 'info/compon.dat', message: 'missing; no texts' }); break; }
    const group = readGroup(componB, r.componPos, id, diags);
    if (!group) continue;
    for (const comp of group) {
      if (MEDIA.has(comp.kind)) { el.media++; continue; }
      if (!TEXTUAL.has(comp.kind) || comp.registryId === undefined) continue;
      const m = members[comp.registryId - 1];
      if (!m) { diags.push({ file: 'registry/Text.mem', message: `${who}: ${comp.kind} component names member ${comp.registryId}, beyond the registry` }); continue; }
      const file = m.slot > 0 ? slots.get(m.slot) : undefined;
      if (file !== undefined) {
        el.texts.push({ kind: 'html', body: decodeText(await fs.readBytes(file)) });
      } else if (m.slot > 0) {
        diags.push({ file: 'elements', message: `${who}: slot ${m.slot} has no file` });
      } else {
        const t = textOfMember(comp.registryId, who);
        if (t !== null) el.texts.push({ kind: 'text', body: t });
        else diags.push({ file: 'registry/Text.rtx', message: `${who}: ${comp.kind} component has no text` });
      }
    }
  }

  // repetition history: dated rows per element
  const histB = await bytesOf(fs, infoDir, 'RepetitionHistory.dat');
  const hasHistory = histB !== null;
  if (histB) {
    for (const el of elements.values()) el.reps = 0;
    for (const row of readHistory(histB, diags)) {
      const el = elements.get(row.elementId);
      if (!el) continue;
      if (row.when >= TD_NEVER) el.reps = (el.reps ?? 0) + 1;
    }
  }

  // priority ranks
  const prioB = await bytesOf(fs, infoDir, 'priority.sub');
  const ranks = prioB ? readInts(prioB, diags, 'info/priority.sub') : [];
  ranks.forEach((id, rank) => {
    const el = elements.get(id);
    if (el && el.rank === undefined) el.rank = rank;
  });

  // tasklist files: layout unknown
  const tasksDir = await find(fs, dir, 'tasks', true);
  if (tasksDir) {
    for (const e of await fs.readDir(tasksDir)) {
      if (!e.isFile || !/\.dat$/i.test(e.name)) continue;
      const st = await fs.stat(joinPath(tasksDir, e.name));
      if (st && st.size > 0) diags.push({ file: `tasks/${e.name}`, message: `${st.size} bytes; the layout is unknown, so no deadlines or values were read` });
    }
  }

  const epoch = calibrate(elements.values());
  if (!epoch) diags.push({ file: 'info/ElementInfo.dat', message: 'no element has both a last touch and a last repetition day; the day epoch is unknown' });
  else if (epoch.agreement < 0.5) diags.push({ file: 'info/ElementInfo.dat', message: `only ${Math.round(epoch.agreement * 100)}% of ${epoch.samples} elements agree on the day epoch` });

  return { name, dir, elements, order, ranked: ranks.length, epoch, hasHistory, diagnostics: diags };
}
