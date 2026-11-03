// Sections that come back, from the app's side (FORMAT.md §6.5): enrolling
// the heading under the caret (the inspector, the heading's menu, the
// palette), dismissing it and bringing it back. Each writes the heading's
// one line, through the open reader's writer when the page is open (so
// nothing typed there is lost), else through the vault.

import { docPri, meta, type Doc, type Heading, type SectionSchedule } from '../format/index.js';
import { broughtBack, dismissed, enrolSection, firstGap, sectionInQueue, sectionSpan } from '../schedule/index.js';
import { appNow } from './clock.js';
import { plainMath } from './chromeText.js';
import { doneLine } from './items.js';
import { popMenu, type PopItem } from './popMenu.js';
import { useApp, type CaretHeading } from './store.js';
import { currentVault, note } from './vault.js';

/** How a write reaches a document: the reader's writer when one is open on it (`Reader.tsx` registers it). */
type WriteThrough = (path: string, mutate: (doc: Doc) => void) => Promise<unknown> | null;
let through: WriteThrough = () => null;

/** The reader says how to write through an open page; the vault is the fallback. */
export function setWriteThrough(fn: WriteThrough): void {
  through = fn;
}

/** Change a document: through its open reader, else the vault. */
export function writeDoc(path: string, mutate: (doc: Doc) => void): Promise<unknown> {
  return through(path, mutate) ?? currentVault()?.update(path, mutate) ?? Promise.resolve(null);
}

/** The heading at a caret's place in the page's blocks: the `nth` with text, when its text still matches; else the first with that text. */
export function headingOf(doc: Doc, at: { nth: number; text: string }): { index: number; heading: Heading } | null {
  let n = 0;
  let byText: { index: number; heading: Heading } | null = null;
  for (let i = 0; i < doc.blocks.length; i++) {
    const b = doc.blocks[i]!;
    if (b.kind !== 'heading' || !b.text.trim()) continue;
    if (n++ === at.nth && b.text === at.text) return { index: i, heading: b };
    if (!byText && b.text === at.text) byText = { index: i, heading: b };
  }
  return byText;
}

/** What a section's line says it is: not enrolled, coming back, or dismissed (its boxes kept). */
export type SectionStatus = 'none' | 'on' | 'dismissed';
export const statusOf = (s: SectionSchedule | undefined): SectionStatus => (!s ? 'none' : sectionInQueue(s) ? 'on' : 'dismissed');

/** How far out a section under `at` first comes back: the cadence of its line's priority, else its document's. */
function gapOf(at: CaretHeading, read: SectionSchedule | undefined): number {
  return firstGap(read?.pri ?? useApp.getState().docs[at.path]?.pri);
}

/** Enroll the section under `at`: back on its cadence. */
export function comeBack(at: CaretHeading, read?: SectionSchedule): Promise<unknown> {
  note(doneLine('§', plainMath(at.text), `back in ${gapOf(at, read)}d`));
  return writeDoc(at.path, (doc) => { const h = headingOf(doc, at); if (h) enrolSection(h.heading, appNow(), docPri(meta(doc))); });
}

/** Dismiss it: its notes and cards stay; the line goes, or keeps only its boxes. */
export function dismissSection(at: CaretHeading): Promise<unknown> {
  note(doneLine('§', plainMath(at.text), 'dismissed'));
  return writeDoc(at.path, (doc) => {
    const h = headingOf(doc, at);
    if (!h?.heading.read) return;
    const next = dismissed(h.heading.read);
    if (next) h.heading.read = next;
    else delete h.heading.read;
  });
}

/** Bring a dismissed section back: due on its cadence, the rest of its line kept. */
export function bringBack(at: CaretHeading, read?: SectionSchedule): Promise<unknown> {
  note(doneLine('§', plainMath(at.text), `back in ${gapOf(at, read)}d`));
  return writeDoc(at.path, (doc) => { const h = headingOf(doc, at); if (h) h.heading.read = broughtBack(h.heading.read, appNow(), docPri(meta(doc))); });
}

/**
 * Move the section under `at` to the end of note `to` (milestone 50): the
 * heading with its line, and every block under it, cards and all; the
 * source note closes the gap. Resolves to the heading's index in `to`.
 */
export async function moveSection(at: CaretHeading, to: string): Promise<number | null> {
  const vault = currentVault();
  if (!vault || to === at.path) return null;
  const from = (await vault.read(at.path)).doc;
  const h = headingOf(from, at);
  if (!h) return null;
  const span = sectionSpan(from.blocks, h.index);
  const blocks = from.blocks.slice(span.start, span.end).map((b) => structuredClone(b));
  let index = -1;
  await writeDoc(to, (d) => { index = d.blocks.length; d.blocks.push(...blocks); });
  await writeDoc(at.path, (d) => {
    const here = headingOf(d, at);
    if (!here) return;
    const s = sectionSpan(d.blocks, here.index);
    d.blocks.splice(s.start, s.end - s.start);
  });
  const title = useApp.getState().docs[to]?.title ?? to.replace(/\.md$/, '').split('/').pop();
  note(doneLine('§', plainMath(at.text), `moved to ${title}`));
  return index;
}

/** A section moves between notes: a source's heading stays where the author put it. */
export const canMove = (path: string): boolean => useApp.getState().docs[path]?.type === 'note';

/** `move to…`: the palette lists the notes the section can go to. */
export function moveAction(at: CaretHeading): PopItem {
  return { label: 'move to…', glyph: '→', act: 'move-to', run: () => useApp.setState({ paletteOpen: true, sectionMove: at }) };
}

/** The one action a heading offers by its state, worded as everywhere: come back, dismiss, or bring back. */
export function sectionActions(status: SectionStatus, at: CaretHeading, read?: SectionSchedule): PopItem[] {
  if (status === 'none') return [{ label: 'come back', glyph: '§', act: 'come-back', run: () => void comeBack(at, read).catch(console.error) }];
  if (status === 'dismissed') return [{ label: 'bring back', glyph: '§', act: 'bring-back', run: () => void bringBack(at, read).catch(console.error) }];
  return [{ label: 'dismiss', glyph: '§', act: 'dismiss', run: () => void dismissSection(at).catch(console.error) }];
}

/** The heading's context menu, at the pointer. */
export function sectionMenu(x: number, y: number, at: CaretHeading, read: SectionSchedule | undefined): HTMLElement {
  return popMenu({ left: x, top: y, bottom: y }, [...sectionActions(statusOf(read), at, read), ...(canMove(at.path) ? [moveAction(at)] : [])], 'section-menu');
}
