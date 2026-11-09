// The session: the outstanding queue walked one element at a time, after the
// prototype's recall.jsx. A card is revealed and graded. Everything else
// offers the same three: ⏎ next (a pass, back later each time), `p` later
// (not counted), `d` dismiss (it ends; its notes and cards stay). A book or
// source opens whole in the reader with the marker live, and its ⏎ is done
// for today (`dismiss`, once the marker is at or past its end); a note
// revisited opens whole from the top; a section opens its
// document at its heading, in the editor, to write in, card, and enroll
// more; a draft opens whole. Above the actions, one line says what the
// element is and where it stands. Every result is written to the file the
// element came from, through its open page when it has one.

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { emitDocAction, emitGrade, runBlockHooks, usePlugins } from '../plugins/index.js';
import { PRI_DEFAULT, READ_AF, WRITE_AF, blanks, cardFields, type Block, type Card } from '../format/index.js';
import { GRADES, advanceRead, advanceSection, cadence, dayOf, grownAt, lineKey, advanceWrite, dirPri, nextGap, pacedInterval, perPassOf, postponed, readTarget, scheduleOf, type CardItem, type Grade, type QueueItem, type ReadItem, type SectionItem, type WriteItem } from '../schedule/index.js';
import { EL_WORD, FORM_LABEL, doneLine, dueLabel, gapLabels, glyphOf, markOf, ownBlank, paceWords, sourceLabel, standing, trailParts, dueTone } from './items.js';
import { writeDoc } from './sections.js';
import { queueId } from './names.js';
import type { OpenOpts } from './panes.js';
import { Pdf, pointInView } from './Pdf.js';
import { MathText } from './MathText.js';
import { plainMath } from './chromeText.js';
import { Reader, clozeHTML, faceDir, faceHTML } from './Reader.js';
import { useApp, type El } from './store.js';
import { useDoc } from './useDoc.js';
import { studyHeader } from './study.js';
import { activeExamAt, currentVault, note, openNode, optionsAt } from './vault.js';
import { openNotes } from './book.js';
import { sessionEnded } from './sync.js';
import { gradeCard } from './grading.js';
import './session.css';
import './incontext.css';
import { appNow } from './clock.js';
import { Glyph, Icon } from './icons.js';

interface Props {
  active: boolean;
  onOpen(path: string, opts: OpenOpts): void;
}

const GRADE_WORD: Record<Grade, string> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

/** `due today`, `due +3d`, but `overdue 2d` and `new` stand alone. */
const dueWord = (due: string | undefined, now: Date): string => {
  const l = dueLabel(due, now);
  return l === 'new' || l.startsWith('overdue') ? l : `due ${l}`;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!el?.isContentEditable;
};

/** Keys for the element on show, while this pane is active and no field has focus. */
function useKeys(active: boolean, handle: (key: string, e: KeyboardEvent) => boolean, deps: unknown[]): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      // the lens under the element may have taken the key (⏎ on a reference in a PDF)
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || inField(e.target)) return;
      if (handle(e.key, e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}

// ── shared chrome ────────────────────────────────────────────────

interface NavProps {
  idx: number;
  total: number;
  onPrev(): void;
  onNext(): void;
  /** Back to where the session began: a phone's, which has no tab to close (milestone 56). */
  onOut?: (() => void) | undefined;
}

function Nav({ idx, total, onPrev, onNext, onOut }: NavProps) {
  return (
    <span className="sess-nav">
      {onOut && <button type="button" className="sn-btn sn-out" aria-label="back" onClick={onOut}><Glyph g="×" /></button>}
      <button type="button" className="sn-btn" onClick={onPrev} disabled={idx === 0}><Icon name="chevron" className="ic-flip" /><span className="gch">‹</span></button>
      <button type="button" className="sn-btn" onClick={onNext} disabled={idx >= total - 1}><Icon name="chevron" /><span className="gch">›</span></button>
    </span>
  );
}

interface BarProps extends NavProps {
  kind: El;
  /** What it is called: `note` for a note revisited, `extract`, else the kind's word. */
  word?: string;
  pri: number;
  /** What the element is, and where it stands (the queue row's words). */
  what: string;
  stands: string;
  /** How a source with a finish day stands (`paceWords`), after that. */
  pace?: string;
  glyph: string;
  children: ReactNode;
}

/** The control bar at the foot of a reading, writing, or section element. */
function SessionBar({ idx, total, kind, word, pri, what, stands, pace, glyph, children, onPrev, onNext, onOut }: BarProps) {
  return (
    <div className="session-bar">
      <div className="sb-inner">
        <div className="sb-meta">
          <Nav idx={idx} total={total} onPrev={onPrev} onNext={onNext} onOut={onOut} />
          <span className="sb-count">{idx + 1} / {total}</span>
          <span className="sb-kind" data-el={kind}>{word ?? EL_WORD[kind]}</span>
          {pri !== PRI_DEFAULT && <span className="sb-count">p {pri}</span>}
        </div>
        <div className="sb-stands">
          <span className="sb-g" data-el={kind}><Glyph g={glyph} /></span>
          <bdi className="sb-what"><MathText text={what} title={false} /></bdi>
          {stands && <span className="sb-where">{stands}</span>}
          {pace && <span className="sb-where" data-pace="1">{pace}</span>}
        </div>
        <div className="sb-actions">{children}</div>
      </div>
    </div>
  );
}

// ── a card ───────────────────────────────────────────────────────

/** The item's card in the document as it is now: where it was, else by id. */
function liveCard(blocks: Block[] | undefined, item: CardItem): Card | null {
  if (!blocks) return null;
  const at = blocks[item.block];
  if (at?.kind === 'card' && (item.id !== undefined ? at.id === item.id : at.text === item.text)) return at;
  if (item.id !== undefined) return blocks.find((b): b is Card => b.kind === 'card' && b.id === item.id) ?? null;
  return null;
}

interface CardProps {
  item: CardItem;
  active: boolean;
  onGrade(g: Grade): void;
}

function CardElement({ item, active, onGrade }: CardProps) {
  const loaded = useDoc(item.path);
  const docPri = useApp((s) => s.docs[item.path]?.pri);
  const [revealed, setRevealed] = useState(false);
  const plugins = usePlugins();
  const phone = useApp((s) => s.phone);
  const cardRef = useRef<HTMLDivElement>(null);
  const now = appNow();
  const card = liveCard(loaded?.doc.blocks, item);
  // the card's own, else the document's, live: the inspector may change either mid-session
  const pri = card ? dirPri(card, item.dir, docPri ?? PRI_DEFAULT) : item.pri;
  const text = card?.text ?? item.text;
  const f = cardFields(text);
  // the item's schedule stands in only until the document is loaded; a card reset since reads as new
  const sched = !card ? item.sched : scheduleOf(card, item.group, item.dir);
  const exam = activeExamAt(item.path, now);
  const gaps = gapLabels(sched, now, optionsAt(item.path).opts.retention, exam && { exam, key: lineKey(card?.id ?? item.id, text, item.group, item.dir) });
  const grade = (g: Grade) => { if (revealed) onGrade(g); else setRevealed(true); };

  useKeys(active, (key) => {
    if (key === ' ') { grade(3); return true; }
    if (key >= '1' && key <= '4') { grade(Number(key) as Grade); return true; }
    return false;
  }, [revealed, item]);

  // the faces, drawn: every plugin's block hook sees each
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    for (const face of el.querySelectorAll<HTMLElement>('.face')) runBlockHooks(face, { path: item.path, block: item.block, where: 'face' });
  });

  if (loaded && !card) return <div className="empty center">no longer in the collection</div>;

  // The card sized to what it holds: the question, then on reveal the
  // answer under a hairline (before it, one quiet line). A cloze is
  // answered in place: its blank fills in the sentence, nothing repeated
  // below it.
  let front: ReactNode;
  let back: ReactNode = null;
  if (!f) front = <div dir={faceDir(text)} dangerouslySetInnerHTML={{ __html: faceHTML(text) }} />;
  else if (f.form === 'cloze') {
    // which blanks this item tests, in `blanks(text)` order; the rest are context
    const mine = blanks(text).map((b, i) => ownBlank(item, b.n, i));
    const html = clozeHTML(
      text,
      (_, i) => (mine[i] ? (revealed ? 'revealed' : 'hidden') : 'plain'),
      (s) => (s === 'hidden' ? 'cloze' : s === 'revealed' ? 'cloze revealed' : 'cloze ctx'),
    );
    // a click on one of this card's blanks, in text or in a formula, reveals
    const onFront = (e: MouseEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('.cloze:not(.ctx), .math.blanks:not([data-blanks="0"])')) setRevealed(true);
    };
    front = <div className="cloze-text" dir={faceDir(text)} onClick={onFront} dangerouslySetInnerHTML={{ __html: html }} />;
  } else if (f.form === 'qa') {
    front = <div className="qa-q" dir={faceDir(f.front)} dangerouslySetInnerHTML={{ __html: faceHTML(f.front) }} />;
    back = <div className="qa-a" dir={faceDir(f.back)} dangerouslySetInnerHTML={{ __html: faceHTML(f.back) }} />;
  } else {
    // both ways: the reverse asks the right side and answers with the left
    const [ask, answer] = item.dir === 'r' ? [f.right, f.left] : [f.left, f.right];
    front = <div className="bidir-a" data-dir={item.dir ?? 'f'} dir={faceDir(ask)} dangerouslySetInnerHTML={{ __html: faceHTML(ask) }} />;
    back = <div className="bidir-b" dir={faceDir(answer)} dangerouslySetInnerHTML={{ __html: faceHTML(answer) }} />;
  }

  const groupNo = item.group && item.groups > 1 ? ('n' in item.group ? item.group.n : item.group.blank + 1) : null;

  return (
    <>
      <div className="card" ref={cardRef} data-revealed={revealed ? '1' : '0'} data-faces={back ? '2' : '1'} data-plugins={plugins?.version ?? 0}>
        <div className="face front">{front}</div>
        {back && revealed && <div className="face back"><div className="face-body">{back}</div></div>}
        {!revealed && (
          <button type="button" className="face-hint" onClick={() => setRevealed(true)}><kbd className="kbd">space</kbd> <span className="lbl">reveal</span></button>
        )}
      </div>
      <div className="card-meta">
        <span className="cm-type" data-form={f?.form}>{f ? FORM_LABEL[f.form] : 'card'}</span>
        {groupNo !== null && <span>blank {groupNo} of {item.groups}</span>}
        {item.dir === 'r' && <span className="cm-dir">back to front</span>}
        <span>{plural(sched?.reps ?? 0, 'review')}</span>
        {sched?.stability !== undefined && <span>stability {Math.round(sched.stability)}d</span>}
        {pri !== PRI_DEFAULT && <span>p {pri}</span>}
        <span className="cm-due" data-due={!sched?.due || item.dueAt <= now ? '1' : '0'} data-st={dueTone(dueWord(sched?.due, now))}>{dueWord(sched?.due, now)}</span>
      </div>
      {phone && !revealed
        // under the thumb, where the grades will be
        ? <button type="button" className="reveal-all" onClick={() => setRevealed(true)}>reveal</button>
        : (
          <div className="grades" data-revealed={revealed ? '1' : '0'}>
            {GRADES.map((g) => (
              <button key={g} type="button" onClick={() => grade(g)}>
                <span className="label">{GRADE_WORD[g]}<kbd>{g}</kbd></span>
                <span className="gap">{gaps[g]}</span>
              </button>
            ))}
          </div>
        )}
    </>
  );
}

// ── reading and writing, in the document ─────────────────────────

/** Prose blocks that have scrolled past the top of the pane: what has been read. */
function blocksAbove(from: HTMLElement): number | undefined {
  const scroller = from.closest('.pane-body');
  const surface = scroller?.querySelector('.draft-doc');
  if (!scroller || !surface) return undefined;
  const top = scroller.getBoundingClientRect().top + 70;
  let n = 0;
  for (const el of surface.children) {
    if (el.classList.contains('card-span')) continue;
    if (el.getBoundingClientRect().bottom < top) n++;
  }
  return n;
}

export type DocAction = 'on' | 'postpone' | 'done';

interface DocProps extends NavProps {
  item: ReadItem | WriteItem | SectionItem;
  active: boolean;
  /** `pos`: blocks read, or on a document with pages the page at the bottom of the view, `y` how far down it. */
  onAct(action: DocAction, pos?: number, y?: number): void;
}

/** A book or source read on: its ⏎ is done for today, not next. */
export const isBook = (item: QueueItem): boolean => item.kind === 'read' && !item.note && !item.extract;

/** A book or source with reading left: it comes back on its cadence. A document read by its pages always has, until its marker reaches its end. */
export const readingOn = (item: ReadItem): boolean => isBook(item) && (!!item.pdf || item.pos < item.total);

/**
 * How many days ⏎ sends an element out at `now`: a source with reading
 * left on its cadence, or sooner if its finish day needs it (`at`: where
 * the pass ended, once known); a section, a note revisited or an extract grown
 * from the time elapsed, a draft the same.
 */
export function nextDays(item: ReadItem | WriteItem | SectionItem, now: Date, at?: number): number {
  if (item.kind === 'section') return nextGap(item.sched, now);
  if (item.kind === 'read') {
    if (!readingOn(item)) return grownAt(item.sched, now, item.sched.af ?? READ_AF);
    const by = readTarget(item.exam, item.finish?.day, dayOf(now));
    if (by?.lead !== 0 || !item.finish) return cadence(item.pri);
    // its finish day: the pacing after this pass, of the usual size until ⏎ says where it ended (`at`)
    const { left, read, perPass } = item.finish;
    const moved = at === undefined ? perPass : Math.max(0, at - item.pos);
    return Math.min(cadence(item.pri), pacedInterval(dayOf(now), by.exam, left - moved, perPassOf(read + moved, (item.sched.reps ?? 0) + 1), 0) ?? Infinity);
  }
  return grownAt(item.sched, now, item.sched.af ?? WRITE_AF);
}

/**
 * The three actions' words: ⏎ `next · back in Nd` (a book's `done for today ·
 * back in Nd`; `dismiss` once the marker is at or past its end, `atEnd`),
 * `later`, `dismiss`.
 */
export function actionWords(item: ReadItem | WriteItem | SectionItem, now: Date, atEnd = false, at?: number): { on: string; postpone: string; done: string } {
  const on = atEnd ? 'dismiss' : `${isBook(item) ? 'done for today' : 'next'} · back in ${nextDays(item, now, at)}d`;
  return { on, postpone: 'later', done: 'dismiss' };
}

/**
 * Whether a source's marker is at or past its end: the last prose block,
 * or the last of its pages (`last`, from the book once its file is read).
 * Its ⏎ then dismisses it.
 */
export function atEndOf(item: ReadItem | WriteItem | SectionItem, pages: boolean, last: number | null): boolean {
  if (item.kind !== 'read' || !isBook(item)) return false;
  if (pages) return last !== null && (item.sched.pos ?? 0) >= last;
  return item.total > 0 && item.pos >= item.total;
}

/** ⏎'s words where a third of a phone has to hold them: `done for today`, under it `back in 2d`. */
export function twoLines(word: string): ReactNode {
  const [what, when] = word.split(' · ');
  return when === undefined ? what : <>{what}<span className="ra-when">{when}</span></>;
}

/** What one of the three did, as a line: a section by its heading, anything else by its document. */
export function docLine(item: ReadItem | WriteItem | SectionItem, action: DocAction, now: Date, at?: number): string {
  const docs = useApp.getState().docs;
  const name = plainMath(item.kind === 'section' ? item.heading : docs[item.path]?.title ?? sourceLabel(item, docs));
  const word = action === 'postpone' ? `later · back in ${postponed(item.sched.ivl)}d` : action === 'done' ? 'dismissed' : actionWords(item, now, false, at).on;
  return doneLine(glyphOf(item), name, word);
}

/** One of the three on a topic: written to its document, through its page when it is open, so what was just typed there is written first. */
export function actOnDoc(item: ReadItem | WriteItem | SectionItem, action: DocAction, pos?: number, y?: number): Promise<unknown> {
  const now = appNow();
  const run = writeDoc(item.path, (doc) => {
    if (item.kind === 'read') advanceRead(doc, action, now, pos, activeExamAt(item.path, now), y);
    else if (item.kind === 'section') advanceSection(doc, item.block, item.heading, action, now);
    else advanceWrite(doc, action, now);
  });
  if (action === 'on') emitDocAction(item);
  return run;
}

function DocSession({ item, active, onAct, ...nav }: DocProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const info = useApp((s) => s.docs[item.path]);
  const docs = useApp((s) => s.docs);
  const phone = useApp((s) => s.phone);
  const reading = item.kind === 'read';
  const section = item.kind === 'section';
  // a document with pages opens as its book, a section of it at its boxes (`Pdf.tsx`); a section of a note attached to a
  // PDF on its own opens that PDF's pages, the note beside them (milestone 70, `book.ts`)
  const pages = !!info?.pdf || (section && info?.of !== undefined);
  const pagesId = info?.of ?? item.path;
  // a note's pass keeps no place (FORMAT.md §3)
  const note = item.kind === 'read' && !!item.note;
  const pri = section ? item.pri : info ? info.pri ?? (reading ? info.read?.pri : info.write?.pri) ?? PRI_DEFAULT : item.pri;
  // the book's last page, once its file is read: a marker at or past it makes ⏎ dismiss
  const [last, setLast] = useState<number | null>(null);
  const atEnd = atEndOf(item, pages, last);
  const on = () => {
    if (atEnd) { onAct('done'); return; }
    if (!reading || note || !barRef.current) { onAct('on'); return; }
    // done for today records the point at the bottom of the view
    if (pages) { const at = pointInView(barRef.current); onAct('on', at?.page, at?.y); return; }
    onAct('on', blocksAbove(barRef.current));
  };
  const words = actionWords(item, appNow(), atEnd);

  // a section opens at its heading, the caret in it and the heading marked; on pages, the note opens beside them
  useEffect(() => {
    if (item.kind !== 'section') return;
    useApp.setState({ reveal: { path: item.path, index: item.block, heading: item.heading } });
    // a phone's one page stays the pages, at the section's boxes: there is no pane beside them
    if (pages && !useApp.getState().phone) void openNotes(pagesId).catch(console.error);
  }, [item]);

  useKeys(active, (key) => {
    if (key === 'Enter') { on(); return true; }
    if (key === 'p') { onAct('postpone'); return true; }
    if (key === 'd') { onAct('done'); return true; }
    return false;
  }, [item]);

  const word = note ? 'note' : item.kind === 'read' && item.extract ? 'extract' : undefined;
  const what = plainMath(section ? `${docs[item.path]?.title ?? sourceLabel(item, docs)} › ${item.heading}` : sourceLabel(item, docs));
  return (
    <div className="doc-session" ref={barRef} data-el={item.kind} data-book={pages ? '1' : '0'}>
      {pages ? <Pdf id={pagesId} active={active} session readOn={item.kind === 'read'} onLast={setLast} /> : <Reader id={item.path} active={active} />}
      <SessionBar kind={markOf(item)} {...(word ? { word } : {})} pri={pri} what={what} stands={standing(item, appNow(), info?.pages?.first)} pace={paceWords(item, appNow())} glyph={glyphOf(item)} {...nav}>
        <button type="button" data-act="on" onClick={on}><span className="ra-l">{phone ? twoLines(words.on) : words.on}</span><kbd>⏎</kbd></button>
        <button type="button" data-act="postpone" onClick={() => onAct('postpone')}><span className="ra-l">{words.postpone}</span><kbd>p</kbd></button>
        <button type="button" data-act="done" onClick={() => onAct('done')}><span className="ra-l">{words.done}</span><kbd>d</kbd></button>
      </SessionBar>
    </div>
  );
}

// ── the session ──────────────────────────────────────────────────

export function Session({ active, onOpen }: Props) {
  const session = useApp((s) => s.session);
  const docs = useApp((s) => s.docs);
  const phone = useApp((s) => s.phone);
  const [idx, setIdx] = useState(0);
  const items = session?.items ?? [];
  const total = items.length;
  const el = items[idx];

  // a new session starts from its first element
  useEffect(() => { setIdx(0); }, [session?.seq]);
  // how long the element has been up: a review's time, for the log
  const shownAt = useRef(Date.now());
  useEffect(() => { shownAt.current = Date.now(); }, [session?.seq, idx]);

  // the tab follows the element
  useEffect(() => {
    useApp.setState({ sessionEl: el ? { kind: el.kind, label: plainMath(sourceLabel(el, docs)), item: el } : null });
  }, [el, docs]);
  useEffect(() => () => useApp.setState({ sessionEl: null }), []);

  // a session over one deck ends where it began: back on the deck's lens
  // the day's queue walked to its end says so, then goes back to the queue
  const deck = session?.deck;
  useEffect(() => {
    if (total > 0 && idx >= total) sessionEnded();
    if (deck && total > 0 && idx >= total) openNode(deck.id);
    if (deck || total === 0 || idx < total) return;
    const t = setTimeout(() => openNode(queueId('today')), 1500);
    return () => clearTimeout(t);
  }, [deck, idx, total]);

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(total - 1, i + 1));
  const advance = () => setIdx((i) => i + 1);

  // go to source: the card's document, scrolled to the card and the card marked (the reader's `reveal`)
  const goToSource = (opts: OpenOpts = {}) => {
    if (el?.kind !== 'card') return;
    useApp.setState({ reveal: el.id === undefined ? { path: el.path, index: el.block } : { path: el.path, index: el.block, id: el.id } });
    onOpen(el.path, opts);
  };

  useKeys(active, (key) => {
    if (key === '[') { goPrev(); return true; }
    if (key === ']') { goNext(); return true; }
    if (key === 'o' && el?.kind === 'card') { goToSource(); return true; }
    return false;
  }, [total, el]);

  const fail = (e: unknown) => console.error(e);

  const onGrade = (item: CardItem, g: Grade) => {
    const vault = currentVault();
    if (!vault) return;
    const now = appNow();
    gradeCard(item, g, now, now.getTime() - shownAt.current).then((loaded) => {
      if (!loaded) return;
      // a card that had no id has one now, and a blank it numbered is numbered:
      // later items of the same card in this session follow
      const at = loaded.doc.blocks[item.block];
      emitGrade(item, g, at?.kind === 'card' ? at : null);
      if (at?.kind !== 'card' || item.id !== undefined) return;
      useApp.setState((s) => (s.session ? {
        session: {
          ...s.session,
          items: s.session.items.map((i) => (i.kind === 'card' && i.path === item.path && i.block === item.block && i.id === undefined ? { ...i, id: at.id, text: at.text } as CardItem : i)),
        },
      } : {}));
    }).catch(fail);
    advance();
  };

  const onDoc = (item: ReadItem | WriteItem | SectionItem, action: DocAction, pos?: number, y?: number) => {
    if (!currentVault()) return;
    actOnDoc(item, action, pos, y).catch(fail);
    note(docLine(item, action, appNow(), pos));
    advance();
  };

  if (!el) {
    return (
      <div className="recall-wrap">
        <div className="empty center session-end">{total === 0 ? 'nothing due' : `all done, ${plural(total, 'element')} · back to the queue`}</div>
      </div>
    );
  }

  const key = `${session?.seq}:${idx}`;
  const onOut = phone ? () => openNode(deck?.id ?? queueId('today')) : undefined;
  if (el.kind !== 'card') {
    return <DocSession key={key} item={el} active={active} idx={idx} total={total} onPrev={goPrev} onNext={goNext} onOut={onOut} onAct={(a, pos, y) => onDoc(el, a, pos, y)} />;
  }

  const openSource = (e: MouseEvent) => goToSource({ cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey });
  // where the card sits: the document, then the headings over it
  const trail = trailParts(el, docs);
  return (
    <div className="recall-wrap">
      <div className="recall-meta">
        <Nav idx={idx} total={total} onPrev={goPrev} onNext={goNext} onOut={onOut} />
        {deck
          ? <span className="sess-count sess-deck">{studyHeader(deck.title, total - idx)}</span>
          : <span className="sess-count">{idx + 1} / {total}</span>}
        <span className="el-tag" data-el="card" data-form={el.form}>{FORM_LABEL[el.form]}</span>
        <button type="button" className="meta-srclink card-trail" onClick={openSource} title={`${plainMath(trail.join(' › '))}  o`}>
          {trail.map((t, i) => <bdi key={i} className={i ? 'ct-h' : 'ct-doc'}><MathText text={t} title={false} /></bdi>)}
          <span className="ms-arrow">↗</span>
        </button>
      </div>
      <CardElement key={key} item={el} active={active} onGrade={(g) => onGrade(el, g)} />
    </div>
  );
}
