// The fixture collection, written from LAYOUT.md by this file and nothing
// else: small, made for the purpose, nobody's real notes. `npm run fixture:sm`
// writes it to `collection/`; the test checks the files there are exactly
// what this builds, then imports them. The variants exercise what a clean
// collection cannot: an unknown type byte, an unknown component kind, a
// registry trailer that names the wrong member, a missing history file.

import { promises as fsp } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { concat, f64le, le16, le32, real48le, tdDay } from '../bytes.js';
import { CONTENTS_SIZE, GROUP_MAGIC, HISTORY_SIZE, INFO_SIZE, MEM_SIZE } from '../records.js';

export interface FixtureOptions {
  /** Add an element whose type byte is 9. */
  unknownType?: boolean;
  /** Give the first topic a component of kind 0x0a. */
  unknownComponent?: boolean;
  /** Write the wrong member id after the extract's title. */
  badTrailer?: boolean;
  /** Leave out RepetitionHistory.dat. */
  noHistory?: boolean;
}

interface FComp {
  kind: 'html' | 'text' | 'image';
  body: string;
}

interface FEl {
  id: number;
  type: number;
  title: string;
  parent: number;
  deleted?: boolean;
  comps?: FComp[];
  interval?: number;
  lastRep?: string;
  /** Day of the last touch; the last repetition by default. */
  touch?: string;
  af?: number;
  /** Dated repetitions. */
  history?: string[];
  placeholders?: number;
}

export const FIXTURE_NAME = 'fixture';
/** The day the fixture was "exported": the import day in the tests. */
export const LAST_DAY = '2024-02-05';
/** Day numbers in ElementInfo count from here. */
export const EPOCH_DAY = '2023-12-31';

const enc = new TextEncoder();

const page = (title: string, body: string) => `<html><head><title>${title}</title></head><body>${body}</body></html>`;

export function fixtureElements(opts: FixtureOptions = {}): FEl[] {
  const els: FEl[] = [
    { id: 1, type: 0, title: FIXTURE_NAME, parent: 0 },
    { id: 2, type: 0, title: 'papers', parent: 1 },
    {
      id: 3, type: 0, title: 'Wozniak 1990', parent: 2,
      comps: [
        { kind: 'html', body: page('Optimization of learning', '<h1>Optimization of learning</h1><p>The spacing effect is the finding that practice spread over time is remembered longer than the same practice massed into one sitting.</p><p>A schedule that times each review for the moment a memory is about to fail spends the fewest reviews on the most retention.</p>') },
        { kind: 'image', body: 'not an image' },
      ],
      interval: 9, lastRep: '2024-01-20', af: 2, history: ['2023-12-28', '2024-01-20'],
    },
    {
      id: 4, type: 0, title: 'spacing effect', parent: 3,
      comps: [{ kind: 'html', body: '<p>Spacing out practice beats massing it.</p>' }],
      interval: 3, lastRep: '2024-01-25', touch: '2024-01-26', af: 1.5, history: ['2024-01-22', '2024-01-25'],
    },
    {
      id: 5, type: 1, title: 'what does the spacing effect predict?', parent: 3,
      comps: [{ kind: 'html', body: '<p>what does the spacing effect predict?</p>' }, { kind: 'text', body: 'spaced practice is remembered longer than massed practice' }],
      interval: 12, lastRep: '2024-01-18', af: 1.3, history: ['2023-12-20', '2024-01-02', '2024-01-18'], placeholders: 1,
    },
    {
      id: 6, type: 1, title: 'massed practice yields [...] retention', parent: 4,
      comps: [{ kind: 'html', body: '<p>massed practice yields <span class="cloze">[...]</span> retention</p>' }, { kind: 'text', body: 'weaker' }],
      interval: 4, lastRep: '2024-01-28', af: 1.2, history: ['2024-01-24', '2024-01-28'],
    },
    {
      id: 7, type: 1, title: 'who described the spacing effect first?', parent: 5,
      comps: [{ kind: 'html', body: '<p>who described the spacing effect first?</p>' }, { kind: 'text', body: 'Ebbinghaus' }],
    },
    { id: 8, type: 0, title: 'german', parent: 2 },
    {
      id: 9, type: 1, title: 'der Vorsatz', parent: 8,
      comps: [{ kind: 'html', body: '<p>der Vorsatz</p>' }, { kind: 'text', body: 'resolution; intention' }],
      interval: 30, lastRep: '2024-01-05', af: 1.4, history: ['2023-12-06', '2024-01-05'],
    },
    {
      id: 10, type: 1, title: 'die Lücke', parent: 8,
      comps: [{ kind: 'html', body: '<p>die Lücke</p>' }, { kind: 'text', body: 'gap' }],
    },
    { id: 11, type: 0, title: 'tasks', parent: 1 },
    {
      id: 12, type: 2, title: 'write the intro', parent: 11,
      comps: [{ kind: 'html', body: '<p>Write the introduction to the spacing paper.</p>' }],
    },
    { id: 13, type: 0, title: '', parent: 1, deleted: true },
    { id: 14, type: 3, title: 'default template', parent: 1 },
    { id: 15, type: 4, title: 'ideas', parent: 1 },
    {
      id: 16, type: 0, title: 'notes on reading', parent: 15,
      comps: [{ kind: 'html', body: '<p>Read with a pencil.</p>' }],
    },
  ];
  if (opts.unknownType) els.push({ id: 17, type: 9, title: 'mystery', parent: 1 });
  return els;
}

/** Element ids in priority order; 0 first. */
export const PRIORITY: number[] = [3, 5, 4, 6, 12, 9];

/** Slot numbers follow the rule in LAYOUT.md §7 for the first two tiers. */
function slotPath(slot: number, ext: string): string {
  if (slot <= 10) return `elements/${slot}.${ext}`;
  return `elements/${Math.ceil((slot - 10) / 10)}/${slot}.${ext}`;
}

export function buildCollection(opts: FixtureOptions = {}): Map<string, Uint8Array> {
  const els = fixtureElements(opts);
  const n = els.length;
  const files = new Map<string, Uint8Array>();
  const epoch = tdDay(EPOCH_DAY);

  // ── registry: one member per title, one per textual component ──
  const mems: Uint8Array[] = [];
  const rtxParts: Uint8Array[] = [];
  let rtxLen = 0;
  let nextSlot = 1;
  const addMember = (text: string | null, slot: number, linkType: number, badId = false): number => {
    const id = mems.length + 1;
    let offset = 0;
    let length = 0;
    if (text !== null) {
      const body = enc.encode(text);
      const rec = concat([body, Uint8Array.of(0), le32(badId ? id + 100 : id), Uint8Array.of(1)]);
      offset = rtxLen + 1;
      length = rec.length;
      rtxParts.push(rec);
      rtxLen += rec.length;
    }
    const m = new Uint8Array(MEM_SIZE);
    m.set(le32(1), 0);
    m[4] = linkType;
    m.set(le32(offset), 10);
    m.set(le32(length), 14);
    m.set(le32(slot), 22);
    mems.push(m);
    return id;
  };

  const titleIds = new Map<number, number>();
  for (const e of els) {
    if (e.deleted) continue;
    titleIds.set(e.id, addMember(e.title, 0, 3, opts.badTrailer === true && e.id === 4));
  }

  // ── compon.dat: one group per element with components ──
  const componParts: Uint8Array[] = [];
  let componLen = 0;
  const groupPos = new Map<number, number>();
  for (const e of els) {
    const comps = [...(e.comps ?? [])];
    if (opts.unknownComponent && e.id === 3) comps.push({ kind: 'html', body: '' });
    if (!comps.length || e.deleted) continue;
    const bodies: Uint8Array[] = [];
    comps.forEach((comp, i) => {
      if (opts.unknownComponent && e.id === 3 && i === comps.length - 1) {
        // kind 0x0a, 20 bytes: header 0x130a
        bodies.push(concat([Uint8Array.of(0x0a, 0x13), new Uint8Array(20)]));
        return;
      }
      let registryId: number;
      let header: Uint8Array;
      let size: number;
      if (comp.kind === 'html') {
        const slot = nextSlot++;
        files.set(slotPath(slot, 'HTM'), enc.encode(comp.body));
        registryId = addMember(null, slot, 5);
        header = Uint8Array.of(0x0d, 0x1c);
        size = 29;
      } else if (comp.kind === 'text') {
        registryId = addMember(comp.body, 0, 3);
        header = Uint8Array.of(0x00, 0x22);
        size = 35;
      } else {
        const slot = nextSlot++;
        files.set(slotPath(slot, 'jpg'), enc.encode(comp.body));
        registryId = slot; // an Image registry member id; the Image registry is not written
        header = Uint8Array.of(0x02, 0x19);
        size = 26;
      }
      const s = new Uint8Array(size);
      s.set(le16(10), 1); // left
      s.set(le16(10), 3); // top
      s.set(le16(300), 5); // width
      s.set(le16(100), 7); // height
      s.set(le32(registryId), 18);
      bodies.push(concat([header, s]));
    });
    const body = concat(bodies);
    const head = concat([Uint8Array.of(GROUP_MAGIC[0], GROUP_MAGIC[1]), le16(11 + body.length), le32(e.id), Uint8Array.of(comps.length), le16(0)]);
    groupPos.set(e.id, componLen);
    componParts.push(head, body);
    componLen += head.length + body.length;
  }

  // ── contents.dat ──
  const contents = new Uint8Array(n * CONTENTS_SIZE);
  const kids = (id: number) => els.filter((e) => e.parent === id).map((e) => e.id);
  const descendants = (id: number): number => kids(id).reduce((sum, k) => sum + 1 + descendants(k), 0);
  for (const e of els) {
    const o = (e.id - 1) * CONTENTS_SIZE;
    const sibs = kids(e.parent);
    const at = sibs.indexOf(e.id);
    const mine = kids(e.id);
    contents[o] = e.deleted ? 1 : 0;
    contents.set(le32(e.parent), o + 1);
    contents.set(le32(mine[0] ?? 0), o + 5);
    contents.set(le32(mine[mine.length - 1] ?? 0), o + 9);
    contents.set(le32(at > 0 ? sibs[at - 1]! : 0), o + 13);
    contents.set(le32(sibs[at + 1] ?? 0), o + 17);
    contents.set(le32(descendants(e.id)), o + 21);
    contents.set(le32(mine.length), o + 25);
  }

  // ── ElementInfo.dat ──
  const info = new Uint8Array(n * INFO_SIZE);
  for (const e of els) {
    const o = (e.id - 1) * INFO_SIZE;
    info[o] = e.type;
    info.set(le32(e.deleted ? -1 : titleIds.get(e.id) ?? 0), o + 2);
    info.set(le32(groupPos.get(e.id) ?? -1), o + 6);
    if (e.interval && e.lastRep) {
      info.set(le16(e.interval), o + 16);
      info.set(le16(tdDay(e.lastRep) - epoch), o + 18);
      info.set(f64le(tdDay(e.touch ?? e.lastRep) + 0.5), o + 20);
    }
    info.set(real48le(e.af ?? 0), o + 28);
    info.set(real48le(e.af ? 1 : 0), o + 34);
    const first = e.history?.[0];
    if (first) info.set(f64le(tdDay(first) + 0.5), o + 77);
  }

  // ── RepetitionHistory.dat ──
  const rows: Uint8Array[] = [];
  for (const e of els) {
    (e.history ?? []).forEach((day, i) => {
      const r = new Uint8Array(HISTORY_SIZE);
      r.set(le32(e.id), 0);
      r.set(le16(i + 1), 4);
      r.set(f64le(tdDay(day) + 0.5), 10);
      rows.push(r);
    });
    for (let i = 0; i < (e.placeholders ?? 0); i++) {
      const r = new Uint8Array(HISTORY_SIZE);
      r.set(le32(e.id), 0);
      r.set(le16((e.history?.length ?? 0) + i + 1), 4);
      rows.push(r);
    }
  }

  // ── the rest ──
  const live = els.filter((e) => !e.deleted);
  const kno = new Uint8Array(950);
  kno.set(le32(live.length), 0);
  kno.set(le32(live.filter((e) => e.interval).length), 4);
  kno[8] = 0;
  const repetitions = new Uint8Array(n * 4);
  const outstanding: number[] = [];
  for (const e of els) {
    if (!e.interval || !e.lastRep) continue;
    const next = tdDay(e.lastRep) + e.interval - epoch;
    repetitions.set(le32(next), (e.id - 1) * 4);
    if (next <= tdDay(LAST_DAY) - epoch) outstanding.push(e.id);
  }
  for (const e of els) if (e.type === 2 && !e.deleted) outstanding.push(e.id);

  const root = FIXTURE_NAME;
  const out = new Map<string, Uint8Array>();
  out.set(`${root}.Kno`, kno);
  out.set(`${root}/collection.ini`, enc.encode('[Collection]\nTitle=fixture\n'));
  out.set(`${root}/info/contents.dat`, contents);
  out.set(`${root}/info/ElementInfo.dat`, info);
  out.set(`${root}/info/compon.dat`, concat(componParts));
  if (!opts.noHistory) out.set(`${root}/info/RepetitionHistory.dat`, concat(rows));
  out.set(`${root}/info/repetitions.dat`, repetitions);
  out.set(`${root}/info/priority.sub`, concat(PRIORITY.map(le32)));
  out.set(`${root}/info/Outstanding.sub`, concat(outstanding.map(le32)));
  out.set(`${root}/registry/Text.mem`, concat(mems));
  out.set(`${root}/registry/Text.rtx`, concat(rtxParts));
  out.set(`${root}/tasks/Tasks.dat`, new Uint8Array(0));
  for (const [p, b] of files) out.set(`${root}/${p}`, b);
  return out;
}

/** Write `files` under `dir`, making directories as needed. */
export async function writeFiles(dir: string, files: Map<string, Uint8Array>): Promise<void> {
  for (const [rel, bytes] of files) {
    const abs = join(dir, rel);
    await fsp.mkdir(dirname(abs), { recursive: true });
    await fsp.writeFile(abs, bytes);
  }
}

/** Under vitest's jsdom environment `import.meta.url` is not a file URL; the tests run from the project root. */
const here = import.meta.url.startsWith('file:') ? dirname(fileURLToPath(import.meta.url)) : resolve('src/import/supermemo/__tests__');
export const COLLECTION_DIR = join(here, 'collection');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await fsp.rm(COLLECTION_DIR, { recursive: true, force: true });
  const files = buildCollection();
  await writeFiles(COLLECTION_DIR, files);
  console.log(`${files.size} files → ${COLLECTION_DIR}`);
}
