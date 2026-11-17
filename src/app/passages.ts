// Passages (milestone 81; FORMAT.md §6.5, *a passage*): boxes drawn on a
// PDF's pages that come back in the day's queue by themselves. A passage
// is kept with the PDF, among its marks (`.ilmi/marks/<sha256>.json`,
// `src/vault/marks.ts`), and in no note: the note on a PDF is the person's
// own, and nothing is written into it for them. Here: making one, the
// queue's items for them, what the session's three do to one, and taking
// one away. A boxed section of a note written before 81 is still its
// heading's line, in the note (`sections.ts`).

import { PRI_DEFAULT, pagesLabel, parseBoxes, type Box, type SectionSchedule } from '../format/index.js';
import { passageMarksOf } from '../pdf/index.js';
import { advanceSchedule, broughtBack, newPassage, passageItem, type QueueItem, type ReadAction, type SectionItem } from '../schedule/index.js';
import { marksHashOf, passageId, type PassageMark } from '../vault/index.js';
import { allMarks, heldMarks, loadMarks, onMarks, pdfHashOf, setMark } from './book.js';
import { appNow } from './clock.js';
import { useApp } from './store.js';
import { onHiddenChange, refreshQueue, setExtraItems, setPostponePassage } from './vault.js';

/** A passage's line as the schedule reads it. */
export function schedOf(m: PassageMark): SectionSchedule {
  const s: SectionSchedule = { boxes: m.boxes };
  if (m.made !== undefined) s.made = m.made;
  if (m.due !== undefined) s.due = m.due;
  if (m.ivl !== undefined) s.ivl = m.ivl;
  if (m.reps !== undefined) s.reps = m.reps;
  if (m.af !== undefined) s.af = m.af;
  if (m.pri !== undefined) s.pri = m.pri;
  return s;
}

/** The entry for a passage's line: its place its first box's, `at` when it was made. */
export function markOfSched(s: SectionSchedule, at: number): PassageMark | null {
  const boxes = parseBoxes(s.boxes ?? '');
  if (!boxes?.length) return null;
  const { extra: _e, boxes: _b, ...rest } = s;
  return { kind: 'passage', page: boxes[0]!.page, y: Math.round(boxes[0]!.y * 10000) / 10000, at, ...rest, boxes: s.boxes! };
}

/**
 * The document a passage is of: one whose pages are that PDF, a chapter
 * that holds the passage's page before the whole book (its priority and
 * its exams are the nearer), the whole book before a chapter that does
 * not; the first by path among equals, so every device says the same.
 * Null when no document of the collection has those pages any more.
 */
export function passageDoc(hash: string, page: number): string | null {
  const docs = useApp.getState().docs;
  let best: { id: string; rank: number } | null = null;
  for (const [id, info] of Object.entries(docs)) {
    if (info.pdf === undefined || pdfHashOf(id) !== hash) continue;
    const r = info.pages;
    const rank = !r ? 1 : page >= r.first && page <= r.last ? 0 : 2;
    if (!best || rank < best.rank || (rank === best.rank && id < best.id)) best = { id, rank };
  }
  return best?.id ?? null;
}

/** The priority of the document at `id`, as a passage on its pages takes it. */
const docPriOf = (id: string): number => useApp.getState().docs[id]?.pri ?? PRI_DEFAULT;

/**
 * Keep the boxes drawn on the pages of the document at `id` as a passage:
 * made today, back on the cadence of the document's priority. Null when
 * the document's PDF cannot be named (no store under the collection).
 */
export async function keepPassage(id: string, boxes: readonly Box[]): Promise<{ hash: string; boxes: string; ivl: number; label: string } | null> {
  const hash = pdfHashOf(id);
  if (hash === null || !boxes.length) return null;
  const now = appNow();
  const sched = newPassage(boxes, now, useApp.getState().docs[id]?.pri);
  const mark = markOfSched(sched, now.getTime());
  if (!mark) return null;
  await setMark(hash, passageId(sched.boxes), mark);
  return { hash, boxes: sched.boxes, ivl: sched.ivl, label: pagesLabel(boxes) };
}

/** The passage with these boxes in the PDF `hash`, as it is held. */
export function passageOf(hash: string, boxes: string): PassageMark | null {
  const m = heldMarks().get(hash)?.[passageId(boxes)];
  return m?.kind === 'passage' ? m : null;
}

/** Take a passage away, or put one back as it was (an undo). */
export const putPassage = (hash: string, boxes: string, mark: PassageMark | null): Promise<void> => setMark(hash, passageId(boxes), mark);

/** Change a passage's line in place; resolves to an undo that puts it back as it was. Nothing when it is gone. */
export async function changePassage(hash: string, boxes: string, change: (s: SectionSchedule) => SectionSchedule | null): Promise<(() => Promise<void>) | null> {
  await loadMarks(hash);
  const was = passageOf(hash, boxes);
  if (!was) return null;
  const next = change(schedOf(was));
  const mark = next ? markOfSched({ ...next, boxes: was.boxes }, was.at) : null;
  if (!mark) return null;
  await putPassage(hash, boxes, mark);
  return () => putPassage(hash, boxes, was);
}

/** One of the session's three on a passage: next, later, dismiss. Resolves to its undo. */
export function actOnPassage(item: SectionItem, action: ReadAction): Promise<(() => Promise<void>) | null> {
  const p = item.passage;
  if (!p) return Promise.resolve(null);
  const now = appNow();
  return changePassage(p.hash, p.boxes, (s) => advanceSchedule(s, action, now));
}

/** A dismissed passage back in the queue, on the cadence of its priority. */
export function bringPassageBack(id: string, hash: string, boxes: string): Promise<(() => Promise<void>) | null> {
  return changePassage(hash, boxes, (s) => broughtBack(s, appNow(), docPriOf(id)));
}

// ── the queue ──

/** Items kept from one build to the next while nothing of them changed: the day's draw is by the item itself. */
let kept = new Map<string, SectionItem>();

/** Every passage that comes back, as the queue's items: each of the document whose pages it is on; one whose PDF is no longer in the collection waits out of the queue. */
export function passageItems(now: Date): QueueItem[] {
  const out: QueueItem[] = [];
  const next = new Map<string, SectionItem>();
  const day = now.toDateString();
  for (const [hash, marks] of heldMarks()) {
    for (const [, m] of passageMarksOf(marks)) {
      if (m.due === undefined) continue;
      const path = passageDoc(hash, m.page);
      if (path === null) continue;
      const pri = docPriOf(path);
      const key = `${hash}\n${JSON.stringify(m)}\n${path}\n${pri}\n${day}`;
      const item = kept.get(key) ?? passageItem(path, hash, schedOf(m), now, pri);
      if (!item) continue;
      next.set(key, item);
      out.push(item);
    }
  }
  kept = next;
  return out;
}

setExtraItems(passageItems);
setPostponePassage((item) => (item.kind === 'section' ? actOnPassage(item, 'postpone') : Promise.resolve(null)));

/** What the queue reads of the marks: the passages alone, so a bookmark made does not build it again. */
const signature = (): string => JSON.stringify([...heldMarks()].map(([h, marks]) => [h, passageMarksOf(marks)]).filter(([, list]) => (list as unknown[]).length));
let seen = '[]';
function follow(): void {
  const now = signature();
  if (now === seen) return;
  seen = now;
  if (useApp.getState().vault) refreshQueue();
}
onMarks(follow);

/** Every PDF's marks read, so the queue has the passages: when a collection opens, and when a marks file comes in from elsewhere. */
function readAll(): void {
  void allMarks().then(follow).catch(console.error);
}
useApp.subscribe((s, prev) => { if (s.vault !== prev.vault && s.vault) { seen = '[]'; kept = new Map(); readAll(); } });
onHiddenChange((paths) => { if (paths.some((p) => marksHashOf(p) !== null)) readAll(); });
if (useApp.getState().vault) readAll();
