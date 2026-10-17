// Import a SuperMemo collection into a vault, once, from the command line.
// `readCollection` reads the data files (LAYOUT.md); this walks the tree in
// order and lands each element through `Vault`, so every file written is one
// the app would have written: folders for the tree, sources and extracts for
// topics, cards for items, drafts for tasks. What the notes do not cover is
// a diagnostic in the summary, never something written.

import { meta, type Card, type Doc, type Paragraph } from '../../format/index.js';
import { dayOf } from '../../schedule/dates.js';
import { childDirOf, type Vault } from '../../vault/index.js';
import { readCollection, type SmCollection, type SmElement, type SmFs } from './collection.js';
import { bodyOf, cardOf, deckDoc, nameOf, taskDoc, topicDoc } from './docs.js';
import type { ImportDiagnostic } from './records.js';

export { readCollection, locate, type SmCollection, type SmElement, type SmFs, type SmText, type SmType, type Epoch } from './collection.js';
export type { ImportDiagnostic } from './records.js';

export interface ImportOptions {
  /** The import day; today by default. */
  today?: string;
}

export interface ImportSummary {
  name: string;
  folders: number;
  sources: number;
  extracts: number;
  decks: number;
  cards: number;
  drafts: number;
  /** Elements not written: deleted, templates, unknown types, items kept as prose. */
  skipped: { deleted: number; templates: number; unknown: number; prose: number };
  /** Image, sound, video, and spelling components dropped. */
  media: number;
  epoch: SmCollection['epoch'];
  diagnostics: ImportDiagnostic[];
}

/** Where an element landed. */
type Place =
  | { kind: 'folder'; dir: string }
  | { kind: 'doc'; path: string }
  | { kind: 'none' };

/** A topic with children and nothing to read is a folder; so is a concept group. */
function isFolder(el: SmElement): boolean {
  return el.type === 'concept' || (el.type === 'topic' && el.children.length > 0 && !bodyOf(el.texts).trim());
}

export async function importCollection(fs: SmFs, path: string, vault: Vault, opts: ImportOptions = {}): Promise<ImportSummary> {
  const today = opts.today ?? dayOf(new Date());
  const c = await readCollection(fs, path);
  const summary: ImportSummary = {
    name: c.name, folders: 0, sources: 0, extracts: 0, decks: 0, cards: 0, drafts: 0,
    skipped: { deleted: 0, templates: 0, unknown: 0, prose: 0 }, media: 0, epoch: c.epoch, diagnostics: c.diagnostics,
  };
  const note = (el: SmElement, message: string) => summary.diagnostics.push({ file: 'info/ElementInfo.dat', message: `element ${el.id}: ${message}` });

  const places = new Map<number, Place>();
  const decks = new Map<string, string>();
  const pending = new Map<string, (Card | Paragraph)[]>();
  const hostPri = new Map<string, number | undefined>();

  /** The nearest ancestor that is a folder (or the root). */
  const folderAbove = (el: SmElement): string => {
    for (let p = el.parent; p !== 0; ) {
      const place = places.get(p);
      if (place?.kind === 'folder') return place.dir;
      p = c.elements.get(p)?.parent ?? 0;
    }
    return '';
  };

  /** The nearest ancestor that is a document, before any folder. */
  const docAbove = (el: SmElement): string | null => {
    for (let p = el.parent; p !== 0; ) {
      const place = places.get(p);
      if (place?.kind === 'doc') return place.path;
      if (place?.kind === 'folder') return null;
      p = c.elements.get(p)?.parent ?? 0;
    }
    return null;
  };

  const land = async (dir: string, type: 'source' | 'extract' | 'deck' | 'draft', name: string, make: (name: string) => Doc): Promise<string> => {
    const path = await vault.createDoc(dir, type, name, today);
    const actual = path.slice(path.lastIndexOf('/') + 1, -3);
    const doc = make(actual);
    await vault.write(path, doc);
    hostPri.set(path, meta(doc).pri);
    return path;
  };

  const deckFor = async (dir: string): Promise<string> => {
    const have = decks.get(dir);
    if (have) return have;
    const path = await land(dir, 'deck', 'cards', (name) => deckDoc({ type: 'deck', name, today }));
    decks.set(dir, path);
    summary.decks++;
    return path;
  };

  for (const id of c.order) {
    const el = c.elements.get(id)!;
    summary.media += el.media;
    if (id === 1) { places.set(id, { kind: 'folder', dir: '' }); continue; }
    if (el.deleted) { summary.skipped.deleted++; places.set(id, { kind: 'none' }); continue; }
    switch (el.type) {
      case 'template':
        summary.skipped.templates++;
        places.set(id, { kind: 'none' });
        break;
      case 'unknown':
        summary.skipped.unknown++;
        note(el, `unknown type ${el.typeByte}, skipped`);
        places.set(id, { kind: 'none' });
        break;
      case 'concept':
      case 'topic': {
        if (isFolder(el)) {
          const dir = await vault.createFolder(folderAbove(el), nameOf(el));
          summary.folders++;
          places.set(id, { kind: 'folder', dir });
          break;
        }
        const parentDoc = docAbove(el);
        const type = parentDoc === null ? 'source' : 'extract';
        const dir = parentDoc === null ? folderAbove(el) : childDirOf(parentDoc);
        const path = await land(dir, type, nameOf(el), (name) => topicDoc(el, c, { type, name, today }));
        if (type === 'source') summary.sources++; else summary.extracts++;
        places.set(id, { kind: 'doc', path });
        break;
      }
      case 'item': {
        const host = docAbove(el) ?? (await deckFor(folderAbove(el)));
        const made = cardOf(el, c, hostPri.get(host));
        if (!made) { summary.skipped.prose++; note(el, 'item with no text, skipped'); }
        else if ('prose' in made) {
          summary.skipped.prose++;
          note(el, made.why);
          pending.set(host, [...(pending.get(host) ?? []), { kind: 'paragraph', text: made.prose }]);
        } else {
          summary.cards++;
          pending.set(host, [...(pending.get(host) ?? []), made.card]);
        }
        places.set(id, { kind: 'none' });
        break;
      }
      case 'task': {
        const path = await land(folderAbove(el), 'draft', nameOf(el), (name) => taskDoc(el, c, { type: 'draft', name, today }));
        summary.drafts++;
        places.set(id, { kind: 'doc', path });
        break;
      }
    }
  }

  for (const [path, blocks] of pending) {
    await vault.update(path, (doc) => { doc.blocks.push(...blocks); });
  }
  return summary;
}

/** The summary as the command line prints it: a few quiet lines. */
export function formatSummary(s: ImportSummary, target: string): string {
  const counts: string[] = [];
  const add = (n: number, word: string) => { if (n) counts.push(`${n} ${word}`); };
  add(s.folders, s.folders === 1 ? 'folder' : 'folders');
  add(s.sources, s.sources === 1 ? 'source' : 'sources');
  add(s.extracts, s.extracts === 1 ? 'extract' : 'extracts');
  add(s.decks, s.decks === 1 ? 'deck' : 'decks');
  add(s.cards, s.cards === 1 ? 'card' : 'cards');
  add(s.drafts, s.drafts === 1 ? 'draft' : 'drafts');
  const lines = [`${s.name} → ${target}`, counts.join(' · ') || 'nothing to import'];
  const skipped: string[] = [];
  const sk = (n: number, word: string) => { if (n) skipped.push(`${n} ${word}`); };
  sk(s.skipped.deleted, 'deleted');
  sk(s.skipped.templates, s.skipped.templates === 1 ? 'template' : 'templates');
  sk(s.skipped.prose, 'kept as prose');
  sk(s.media, s.media === 1 ? 'media component dropped' : 'media components dropped');
  if (skipped.length) lines.push(skipped.join(' · '));
  for (const d of s.diagnostics) lines.push(`${d.file}: ${d.message}`);
  return lines.join('\n');
}
