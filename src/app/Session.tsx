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
//
// The walk grows: a card graded into its learning or relearning steps (due
// at an instant, minutes on) is asked again in this session, appended after
// what is left, however often it takes, and before its instant when nothing
// else is left; each asking is a review of its own. So the end comes with no
// card minutes from due. `returns` and `dropped` (the session's marks) keep
// which asking brought which element, and which are not asked after all.

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { emitDocAction, emitGrade, runBlockHooks, usePlugins } from '../plugins/index.js';
import { PRI_DEFAULT, READ_AF, WRITE_AF, blanks, cardFields, cardForm, type Block, type Card } from '../format/index.js';
import type { CardSchedule, Doc } from '../format/index.js';
import { GRADES, advanceRead, advanceSection, cadence, dayOf, grownAt, lineKey, advanceWrite, dirPri, neverTested, nextGap, owesLearning, metElsewhere, itemOwesLearning, pacedInterval, perPassOf, postponed, readTarget, regradeFrom, scheduleOf, whenToDate, type CardItem, type Grade, type QueueItem, type ReadItem, type SectionItem, type WriteItem } from '../schedule/index.js';
import { EL_WORD, FORM_LABEL, doneLine, dueLabel, gapLabels, glyphOf, markOf, ownBlank, paceWords, sourceLabel, standing, trailParts, dueTone } from './items.js';
import { writeDoc } from './sections.js';
import { queueId } from './names.js';
import type { OpenOpts } from './panes.js';
import { Pdf, pointInView } from './Pdf.js';
import { MathText } from './MathText.js';
import { plainMath } from './chromeText.js';
import { Reader, clozeHTML, faceDir, faceHTML } from './Reader.js';
import { useApp, type El, type SessionMarks } from './store.js';
import { useDoc } from './useDoc.js';
import { studyHeader } from './study.js';
import { actOnPassage } from './passages.js';
import { focusInBook } from './bookNotes.js';
import { activeExamAt, currentVault, logDocAction, note, openNode, optionsAt, unlogReading } from './vault.js';
import { openNotes } from './book.js';
import { sessionEnded } from './sync.js';
import { gradeAhead, gradeCard, inSteps, learnCard, type Graded } from './grading.js';
import { hapticFinished, hapticGrade, hapticReveal, hapticTick } from './haptics.js';
import { CardFaces } from './CardFaces.js';
import { bulkCards, saveCardEdit } from './deckOps.js';
import { cardRef as refOfCard, cardSuspended, type CardRef } from './deck.js';
import { failed, notify } from './land.js';
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
  /** › past the last element too, to the end: an item that is gone has nothing else to move it on. */
  past?: boolean | undefined;
  /** Back to where the session began: a phone's, which has no tab to close (milestone 56). */
  onOut?: (() => void) | undefined;
}

export function Nav({ idx, total, onPrev, onNext, onOut, past }: NavProps) {
  return (
    <span className="sess-nav">
      {onOut && <button type="button" className="sn-btn sn-out" aria-label="back" onClick={onOut}><Glyph g="×" /></button>}
      <button type="button" className="sn-btn" onClick={onPrev} disabled={idx === 0}><Icon name="chevron" className="ic-flip" /><span className="gch">‹</span></button>
      <button type="button" className="sn-btn" onClick={onNext} disabled={!past && idx >= total - 1}><Icon name="chevron" /><span className="gch">›</span></button>
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
  /** The walk's length as counted: the tests still to come of cards learnt first are in it. */
  of?: number | undefined;
  children: ReactNode;
}

/** The control bar at the foot of a reading, writing, or section element. */
function SessionBar({ idx, total, of, kind, word, pri, what, stands, pace, glyph, children, onPrev, onNext, onOut }: BarProps) {
  return (
    <div className="session-bar">
      <div className="sb-inner">
        <div className="sb-meta">
          <Nav idx={idx} total={total} onPrev={onPrev} onNext={onNext} onOut={onOut} />
          <span className="sb-count">{idx + 1} / {of ?? total}</span>
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
function liveCard(blocks: Block[] | undefined, item: CardItem, edited?: string): Card | null {
  if (!blocks) return null;
  const at = blocks[item.block];
  let card: Card | null = null;
  // a card with no id edited here is found by its new text too
  if (at?.kind === 'card' && (item.id !== undefined ? at.id === item.id : at.text === item.text || at.text === edited)) card = at;
  else if (item.id !== undefined) card = blocks.find((b): b is Card => b.kind === 'card' && b.id === item.id) ?? null;
  // a reverse asked of a card edited since to no longer both ways: the line it tests is gone
  return card && item.dir === 'r' && cardForm(card.text) !== 'bidir' ? null : card;
}

/** A grade given to an item in this session: shown again on ‹, and what a grade there replaces (`written` once it is). */
interface Given {
  g: Grade;
  run: Promise<Graded | null>;
  written?: Graded | null;
  /** The schedule it was given from and the one it leaves, as told at the grade (`gradeAhead`): what says whether the card comes back, before anything is written. */
  from: CardSchedule | undefined;
  next: CardSchedule;
}

interface CardProps {
  item: CardItem;
  active: boolean;
  /** The grade this item was given in this session, when it was. */
  given?: Given | undefined;
  /** `line`: the schedule of the line it asks, as the document here has it. */
  onGrade(g: Grade, line: CardSchedule | undefined): void;
  /** Graded here, and asked again since (its return graded): the grade given stands, shown, and space is on to the next. */
  locked?: boolean;
  /** On past an item that is gone, and whether it is. */
  onSkip(): void;
  onGone(gone: boolean): void;
  /** An edit being written: a grade after it waits for it, so it finds the card as edited. */
  onEdit(run: Promise<unknown>): void;
  /** It may come up to learn: the tweak on, and not learnt already at another element of this session. */
  learnable?: boolean;
  /** It was learnt at this element, in this session: come back to with ‹, it is up to learn again, though its line says it was. */
  learntHere?: boolean;
  /** Learnt (space, ⏎): its line says so (`seen`), and it is tested at the session's end. */
  onLearnt?: () => void;
  /** `s`: the card suspended (the session moves on, nothing graded), or one come back to brought back. */
  onSuspend(ref: CardRef, on: boolean): void;
}

/** The session whose end was felt (`hapticFinished`). */
let endFelt: number | undefined;

/** One card's line, however often it is in the walk (learnt, then tested). */
const learnKey = (c: CardItem) => `${c.path}#${c.id ?? c.block}#${c.group ? JSON.stringify(c.group) : ''}#${c.dir ?? ''}`;

export { neverTested };

function CardElement({ item, active, given, locked, onGrade, onSkip, onGone, onEdit, learnable, learntHere, onLearnt, onSuspend }: CardProps) {
  const loaded = useDoc(item.path);
  const docPri = useApp((s) => s.docs[item.path]?.pri);
  // a card never tested, and not learnt yet (its line has no `seen`), comes up answered, to learn: its test is at the
  // session's end (the `learnNew` tweak). As the walk had it when the element came up
  const [learnAt] = useState(() => !given && !!learnable && itemOwesLearning(item));
  // a card graded in this session comes back answered, its grade marked
  const [revealed, setRevealed] = useState(!!given || learnAt);
  // `e`, or a press on a revealed box: the two boxes live in place (`CardFaces.tsx`)
  const [editing, setEditing] = useState(false);
  // the press that opened the boxes, for the caret to land where it was
  const [pressAt, setPressAt] = useState<{ face: 'front' | 'back'; x: number; y: number } | undefined>(undefined);
  const [edited, setEdited] = useState<string | undefined>(undefined);
  const plugins = usePlugins();
  const phone = useApp((s) => s.phone);
  const cardRef = useRef<HTMLDivElement>(null);
  const now = appNow();
  const card = liveCard(loaded?.doc.blocks, item, edited);
  // the card's own, else the document's, live: the inspector may change either mid-session
  const pri = card ? dirPri(card, item.dir, docPri ?? PRI_DEFAULT) : item.pri;
  const text = card?.text ?? item.text;
  const f = cardFields(text);
  // the item's schedule stands in only until the document is loaded; a card reset since reads as new
  const sched = !card ? item.sched : scheduleOf(card, item.group, item.dir);
  // and as the document has it now: a line that has a review since the walk was made (a sync), or that says it was
  // learnt elsewhere, is not up to learn; it is asked, its answer down
  const learning = learnAt && !(card && (!neverTested(sched) || (sched?.seen !== undefined && !learntHere) || metElsewhere(card, sched)));
  useEffect(() => { if (learnAt && !learning && !given) setRevealed(false); }, [learning]);
  const exam = activeExamAt(item.path, now);
  // a grade given again is given from before the one it replaces: so are its hints
  const from = given?.written ? regradeFrom(sched, given.written) : sched;
  const gaps = gapLabels(from, now, optionsAt(item.path).opts.retention, exam && { exam, key: lineKey(card?.id ?? item.id, text, item.group, item.dir) });
  // the answer shown, felt under the finger where the device can (`haptics.ts`)
  const reveal = () => { if (!revealed) hapticReveal(); setRevealed(true); };
  const grade = (g: Grade) => { if (revealed) onGrade(g, sched); else reveal(); };
  // the card, or the line it asks, no longer in the file: no grade reaches it, space moves on
  const gone = !!loaded && !card;
  useEffect(() => { onGone(gone); }, [gone]);
  // suspended (here with `s`, or anywhere since): it is not graded, space is on to the next, `s` brings it back
  const suspended = !!card && cardSuspended(card, item.group, item.dir);

  useKeys(active, (key, e) => {
    // a key held down: the system repeats it, and it does nothing more (not the page's scroll either)
    if (e.repeat) return !editing && (key === ' ' || key === 'Enter' || (key >= '1' && key <= '4') || key === 'e' || key === 's');
    if (gone) {
      if (key === ' ') { onSkip(); return true; }
      return false;
    }
    if (editing) return false;
    if (key === 's' && card) { onSuspend(refOfCard(item.path, item.block, card), !suspended); return true; }
    if (suspended || locked) {
      if (key === ' ' || key === 'Enter') { onSkip(); return true; }
      if (key >= '1' && key <= '4') return true;
    } else {
      if (learning && (key === ' ' || key === 'Enter')) { onLearnt?.(); return true; }
      if (key === ' ') { grade(3); return true; }
      if (key >= '1' && key <= '4') { grade(Number(key) as Grade); return true; }
    }
    if (key === 'e' && card) { setRevealed(true); setPressAt(undefined); setEditing(true); return true; }
    return false;
  }, [revealed, item, editing, card, gone, learning, suspended, locked, sched]);

  // an edit written: the card's text in the file, and this session's other items of it, follow
  const saveEdit = (text: string, was: string) => {
    if (!card) return;
    setEdited(text);
    const ref = card.id === undefined ? { path: item.path, block: item.block, text: was } : { path: item.path, block: item.block, id: card.id, text: was };
    onEdit(saveCardEdit(ref, text, card.sched?.pri ?? null).then(() => {
      if (card.id !== undefined) return;
      useApp.setState((s) => (s.session ? {
        session: { ...s.session, items: s.session.items.map((i) => (i.kind === 'card' && i.path === item.path && i.block === item.block && i.text === was ? { ...i, text } as CardItem : i)) },
      } : {}));
    }).catch(failed('edit')));
  };

  // the faces, drawn: every plugin's block hook sees each
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    for (const face of el.querySelectorAll<HTMLElement>('.face')) runBlockHooks(face, { path: item.path, block: item.block, where: 'face' });
  });

  if (gone) {
    return (<>
      <div className="empty center">no longer in the collection</div>
      <div className="grades" data-revealed="1" data-gone="1">
        <button type="button" data-act="skip" onClick={onSkip}><span className="label">skip<kbd>space</kbd></span></button>
      </div>
    </>);
  }

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
      if ((e.target as HTMLElement).closest('.cloze:not(.ctx), .math.blanks:not([data-blanks="0"])')) reveal();
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

  const schedule = (
    <>
      {groupNo !== null && <span>blank {groupNo} of {item.groups}</span>}
      {item.dir === 'r' && <span className="cm-dir">back to front</span>}
      <span>{plural(sched?.reps ?? 0, 'review')}</span>
      {sched?.stability !== undefined && <span>stability {Math.round(sched.stability)}d</span>}
      {pri !== PRI_DEFAULT && <span>p {pri}</span>}
      {given && <span className="cm-given">graded {GRADE_WORD[given.g]}</span>}
      {learning && <span className="cm-learn">first time · learn it</span>}
      {suspended
        ? <span className="cm-due" data-due="0" data-st={dueTone('suspended')}>suspended</span>
        : <span className="cm-due" data-due={!sched?.due || item.dueAt <= now ? '1' : '0'} data-st={dueTone(dueWord(sched?.due, now))}>{dueWord(sched?.due, now)}</span>}
    </>
  );
  // a press on a box once the answer is up edits it there
  const editOnPress = (face: 'front' | 'back') => (e: MouseEvent) => {
    if (!revealed || !card || editing) return;
    // a selection made in the face is for copying, not an edit
    if (!window.getSelection()?.isCollapsed) return;
    setPressAt({ face, x: e.clientX, y: e.clientY });
    setEditing(true);
  };
  return (
    <>
      {editing && card ? (
        <CardFaces card={card} autoFocus keep={`${item.path}#${card.id ?? item.block}`} onSave={saveEdit} onDone={() => { setEditing(false); setPressAt(undefined); }} at={pressAt}>{schedule}</CardFaces>
      ) : (<>
      <div className="card" key={`${item.path}#${card?.id ?? item.block}`} ref={cardRef} data-revealed={revealed ? '1' : '0'} data-faces={back ? '2' : '1'} data-plugins={plugins?.version ?? 0}>
        <div className="face front" onClick={editOnPress('front')}>{front}</div>
        {back && revealed && <div className="face back" onClick={editOnPress('back')}><div className="face-body">{back}</div></div>}
        {!revealed && (
          <button type="button" className="face-hint" onClick={reveal}><kbd className="kbd">space</kbd> <span className="lbl">reveal</span></button>
        )}
      </div>
      <div className="card-meta">
        <span className="cm-type" data-form={f?.form}>{f ? FORM_LABEL[f.form] : 'card'}</span>
        {schedule}
      </div>
      </>)}
      {suspended ? (
        <div className="grades" data-revealed="1" data-gone="1" data-suspended="1">
          <button type="button" data-act="pass" onClick={onSkip}>
            <span className="label">next<kbd>space</kbd></span>
            <span className="gap">suspended</span>
          </button>
        </div>
      ) : locked ? (
        <div className="grades" data-revealed="1" data-gone="1" data-locked="1">
          <button type="button" data-act="pass" onClick={onSkip}>
            <span className="label">next<kbd>space</kbd></span>
            <span className="gap">asked again since</span>
          </button>
        </div>
      ) : learning ? (
        <div className="grades learn" data-revealed="1" data-learn="1">
          <button type="button" data-act="learnt" onClick={() => onLearnt?.()}>
            <span className="label">got it<kbd>space</kbd></span>
            <span className="gap">tested at the end<span className="keys-only"> · 1–4 grade it now</span></span>
          </button>
        </div>
      ) : phone && !revealed
        // under the thumb, where the grades will be
        ? <button type="button" className="reveal-all" onClick={reveal}>reveal</button>
        : (
          <div className="grades" data-revealed={revealed ? '1' : '0'}>
            {GRADES.map((g) => (
              <button key={g} type="button" data-grade={g} data-given={given?.g === g ? '1' : '0'} onClick={() => grade(g)}>
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
  of?: number | undefined;
  /** `pos`: blocks read, or on a document with pages the page at the bottom of the view, `y` how far down it. */
  onAct(action: DocAction, pos?: number, y?: number): void;
  /** What was done to it in this session, come back to: it is shown, and ⏎ is on to the next, nothing written. */
  done?: { action: string; word: string } | undefined;
  onPass(): void;
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

/** What one of the three did, as the session says it of an element come back to: `passed · back in 5d`, `done for today · back in 2d`, `later · back in 3d`, `dismissed`. */
export function doneWord(item: ReadItem | WriteItem | SectionItem, action: DocAction, now: Date, at?: number): string {
  if (action === 'postpone') return `later · back in ${postponed(item.sched.ivl)}d`;
  if (action === 'done') return 'dismissed';
  return actionWords(item, now, false, at).on.replace(/^next/, 'passed');
}

/**
 * One of the three on a topic: written to its document, through its page when it is open, so what was just typed there is written first.
 * `seen` is given the document as it was just before, for an undo; of a passage, which is in no document, `kept` is given the undo itself.
 */
export function actOnDoc(item: ReadItem | WriteItem | SectionItem, action: DocAction, pos?: number, y?: number, seen?: (before: Doc) => void, kept?: (undo: () => Promise<void>) => void): Promise<unknown> {
  const now = appNow();
  hapticTick();
  // a passage is in no document: its line is among its PDF's marks, and `kept` is given what puts it back
  if (item.kind === 'section' && item.passage) {
    const run = actOnPassage(item, action).then((undo) => { if (undo) kept?.(undo); });
    if (action === 'on') emitDocAction(item);
    void run.then(() => logDocAction(item, action, pos), () => {});
    return run;
  }
  const run = writeDoc(item.path, (doc) => {
    seen?.(structuredClone(doc));
    if (item.kind === 'read') advanceRead(doc, action, now, pos, activeExamAt(item.path, now), y);
    else if (item.kind === 'section') advanceSection(doc, item.block, item.heading, action, now);
    else advanceWrite(doc, action, now);
  });
  if (action === 'on') emitDocAction(item);
  void run.then(() => logDocAction(item, action, pos), () => {});
  return run;
}

/**
 * One of the three taken back: the element's own line as it was in `before` (a section's `read` line under its
 * heading; a source's or a draft's fields), and nothing else of its document: what was written to it since (a card in
 * it graded or learnt, another section passed) stays.
 */
export function putBackDoc(item: ReadItem | WriteItem | SectionItem, before: Doc): Promise<unknown> {
  return writeDoc(item.path, (doc) => {
    if (item.kind !== 'section') {
      if (before.frontmatter) doc.frontmatter = structuredClone(before.frontmatter);
      else delete doc.frontmatter;
      return;
    }
    const at = (d: Doc) => { const h = d.blocks[item.block]; return h?.kind === 'heading' && h.text === item.heading ? h : d.blocks.find((b) => b.kind === 'heading' && b.text === item.heading); };
    const [was, now] = [at(before), at(doc)];
    if (now?.kind !== 'heading') return;
    if (was?.kind === 'heading' && was.read) now.read = structuredClone(was.read);
    else delete now.read;
  });
}

function DocSession({ item, active, onAct, done, onPass, ...nav }: DocProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const info = useApp((s) => s.docs[item.path]);
  const docs = useApp((s) => s.docs);
  const phone = useApp((s) => s.phone);
  const reading = item.kind === 'read';
  const section = item.kind === 'section';
  // a document with pages opens as its book, a section of it at its boxes (`Pdf.tsx`); a section of a note attached to a
  // PDF on its own opens that PDF's pages, the note beside them (milestone 70, `book.ts`)
  const pages = !!info?.pdf || (section && info?.of !== undefined);
  // (a written notebook that is a PDF's note is its own sheets: what is kept on them is shown on them)
  const pagesId = info?.pdf !== undefined ? item.path : info?.of ?? item.path;
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
    // a passage is on the pages alone: they open at its boxes, lit
    if (item.passage) { focusInBook(pagesId, item.passage.boxes); return; }
    useApp.setState({ reveal: { path: item.path, index: item.block, heading: item.heading } });
    // a phone's one page stays the pages, at the section's boxes: there is no pane beside them
    if (pages && !useApp.getState().phone) void openNotes(pagesId, item.path).catch(failed('open the notes'));
  }, [item]);

  useKeys(active, (key, e) => {
    // a key held down does nothing more
    if (e.repeat) return key === 'Enter';
    // done already in this session: ⏎ is on to the next, and nothing is written twice
    if (done) { if (key === 'Enter') { onPass(); return true; } return false; }
    if (key === 'Enter') { on(); return true; }
    if (key === 'p') { onAct('postpone'); return true; }
    if (key === 'd') { onAct('done'); return true; }
    return false;
  }, [item, done, atEnd]);

  const word = note ? 'note' : item.kind === 'read' && item.extract ? 'extract' : item.kind === 'section' && item.passage ? 'passage' : undefined;
  const what = plainMath(section ? `${docs[item.path]?.title ?? sourceLabel(item, docs)} › ${item.heading}` : sourceLabel(item, docs));
  return (
    <div className="doc-session" ref={barRef} data-el={item.kind} data-book={pages ? '1' : '0'}>
      {pages ? <Pdf id={pagesId} active={active} session readOn={item.kind === 'read'} onLast={setLast} /> : <Reader id={item.path} active={active} />}
      <SessionBar kind={markOf(item)} {...(word ? { word } : {})} pri={pri} what={what} stands={standing(item, appNow(), info?.pages?.first)} pace={paceWords(item, appNow())} glyph={glyphOf(item)} {...nav}>
        {done ? (<>
          <span className="sb-done" data-done={done.action}>{done.word}</span>
          <button type="button" data-act="pass" onClick={onPass}><span className="ra-l">next</span><kbd>⏎</kbd></button>
        </>) : (<>
          <button type="button" data-act="on" onClick={on}><span className="ra-l">{phone ? twoLines(words.on) : words.on}</span><kbd>⏎</kbd></button>
          <button type="button" data-act="postpone" onClick={() => onAct('postpone')}><span className="ra-l">{words.postpone}</span><kbd>p</kbd></button>
          <button type="button" data-act="done" onClick={() => onAct('done')}><span className="ra-l">{words.done}</span><kbd>d</kbd></button>
        </>)}
      </SessionBar>
    </div>
  );
}

// ── the session ──────────────────────────────────────────────────

export function Session({ active, onOpen }: Props) {
  const session = useApp((s) => s.session);
  const docs = useApp((s) => s.docs);
  const phone = useApp((s) => s.phone);
  const seq = session?.seq;
  const items = session?.items ?? [];
  const total = items.length;
  // what was done to each element, kept with the session (not here: the pane draws its active tab only, so this lens
  // is drawn anew each time its tab is come back to)
  const spare = useRef<{ seq: number | undefined; marks: SessionMarks; kept: boolean } | null>(null);
  if (!spare.current || spare.current.seq !== seq || (spare.current.kept && session && !session.marks)) {
    spare.current = { seq, marks: { given: new Map(), learnt: new Map(), acted: new Map(), returns: new Map(), dropped: new Set() }, kept: false };
  }
  const marks = session?.marks ?? spare.current.marks;
  // cards asked again (the file's head): by the asking graded, the element that asks it again; and those not asked after all
  const returns = marks.returns;
  const dropped = marks.dropped;
  /** The first element at or after `i` that is asked, of `n`; none, the end. And the last at or before it; none, -1. */
  const onFrom = (i: number, n: number) => { while (i < n && dropped.has(i)) i++; return Math.min(i, n); };
  const backFrom = (i: number) => { while (i >= 0 && dropped.has(i)) i--; return i; };
  // where it is, kept with the session for the same reason; a new session starts from its first element
  const idx = onFrom(session?.at ?? 0, total);
  const setIdx = (to: (i: number, n: number) => number) => useApp.setState((s) => {
    if (!s.session || s.session.seq !== seq) return {};
    const n = s.session.items.length;
    return { session: { ...s.session, at: to(onFrom(s.session.at ?? 0, n), n) } };
  });
  const el = items[idx];
  // what the counter says: the elements asked, and how many are before this one
  const asked = total - dropped.size;
  let place = 0;
  for (let i = 0; i < idx; i++) if (!dropped.has(i)) place++;
  useEffect(() => {
    if (!session || session.marks) return;
    spare.current!.kept = true;
    useApp.setState((s) => (s.session && s.session.seq === seq && !s.session.marks ? { session: { ...s.session, marks } } : {}));
  }, [session, marks, seq]);
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
    // the end is felt once a session, however often its lens is drawn again there
    if (total > 0 && idx >= total && seq !== undefined && endFelt !== seq) { endFelt = seq; hapticFinished(); }
    if (deck && total > 0 && idx >= total) openNode(deck.id);
    if (deck || total === 0 || idx < total) return;
    const t = setTimeout(() => openNode(queueId('today')), 1500);
    return () => clearTimeout(t);
  }, [deck, idx, total]);

  // the item on show is gone (`CardElement`): › moves on from it to the end too
  const [goneAt, setGoneAt] = useState<string | null>(null);
  const key = `${session?.seq}:${idx}`;
  const past = goneAt === key;

  const goPrev = () => setIdx((i) => { const p = backFrom(i - 1); return p < 0 ? i : p; });
  const goNext = () => setIdx((i, n) => { const x = onFrom(i + 1, n); return x < n ? x : past ? n : i; });
  const advance = () => setIdx((i, n) => onFrom(i + 1, n));

  // go to source: the card's document, scrolled to the card and the card marked (the reader's `reveal`),
  // in a tab of its own: the session's stays, and goes on from here when it is come back to
  const goToSource = (opts: OpenOpts = {}) => {
    if (el?.kind !== 'card') return;
    useApp.setState({ reveal: el.id === undefined ? { path: el.path, index: el.block } : { path: el.path, index: el.block, id: el.id } });
    onOpen(el.path, { newTab: true, ...opts });
  };

  useKeys(active, (key, e) => {
    if (key === '[') { goPrev(); return true; }
    if (key === ']') { goNext(); return true; }
    if (key === 'o' && el?.kind === 'card') { if (!e.repeat) goToSource(); return true; }
    return false;
  }, [total, el, past, seq]);

  const fail = failed('grade');

  // the edits this session has sent to be written; a grade waits for them
  const edits = useRef<Promise<unknown>>(Promise.resolve());
  const onEdit = (run: Promise<unknown>) => { const before = edits.current; edits.current = before.then(() => run); };

  // the grades given in this session, by item: ‹ back to one shows it, and a grade there takes its place
  const given = marks.given as Map<string, Given>;
  // cards learnt in this session (`learnNew`): each is tested once more at the end, and not learnt again
  const learnNew = useApp((s) => s.learnNew);
  const learnt = marks.learnt;
  const onLearnt = (shown: CardItem) => {
    const k = learnKey(shown);
    hapticTick();
    if (!learnt.has(k)) {
      // where it was learnt: ‹ back there shows it to learn again, its test still the one at the end
      learnt.set(k, key);
      const place = idx;
      useApp.setState((s) => (s.session && s.session.seq === seq ? { session: { ...s.session, items: [...s.session.items, shown] } } : {}));
      // and its line says so (`seen`), at once: the session left before its end, the app closed, the next day, another
      // device, the card is asked as a test and not shown to learn again. After an edit of it still being written; a
      // grade waits for this as it waits for an edit
      let wrote = null as { id: string; key?: string } | null;
      const run = edits.current.then(() => {
        const s = useApp.getState().session;
        const live = s?.seq === seq ? s?.items[place] : undefined;
        const item = live?.kind === 'card' && live.path === shown.path && live.block === shown.block ? live : shown;
        return learnCard(item, appNow(), (w) => { wrote = w; }).then((loaded) => ({ item, loaded }));
      }).then(({ item, loaded }) => {
        const w = wrote;
        if (!loaded || !w) return;
        // a card that had no id has one now, and a blank it numbered is numbered: the session's other items of it follow
        const at = loaded.doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === w.id);
        if (!at) return;
        const n = w.key?.startsWith('c') ? Number(w.key.slice(1)) : null;
        const blank = item.group && 'blank' in item.group ? item.group.blank : null;
        useApp.setState((s) => (s.session && s.session.seq === seq ? {
          session: {
            ...s.session,
            items: s.session.items.map((i) => {
              if (i.kind !== 'card' || i.path !== item.path || i.block !== item.block || (item.id === undefined ? i.id !== undefined : i.id !== item.id)) return i;
              const mine = n !== null && blank !== null && i.group && 'blank' in i.group && i.group.blank === blank;
              const to = { ...i, id: w.id, text: at.text, ...(mine ? { group: { n } } : {}) } as CardItem;
              // what was learnt is kept by the card's line, which is named by its id now
              const [was, now] = [learnKey(i), learnKey(to)];
              const where = learnt.get(was);
              if (was !== now && where !== undefined) { learnt.delete(was); learnt.set(now, where); }
              return to;
            }),
          },
        } : {}));
      });
      onEdit(run.catch(failed('got it')));
    }
    advance();
  };

  /**
   * Whether the card graded at `ask` comes back (`on`): `item` appended to the walk, to be asked once everything
   * else has had its turn, the total one more; or, its grade given again, the element it brought taken out of the
   * walk or put back in. One already graded stays as it is. `late`: said once the grade is written and differs from
   * what was told at the grade; nothing is added to a session already at its end.
   */
  const comeBack = (ask: string, item: CardItem, on: boolean, late = false) => useApp.setState((s) => {
    if (!s.session || s.session.seq !== seq) return {};
    const slot = returns.get(ask);
    if (slot === undefined) {
      if (!on || (late && onFrom(s.session.at ?? 0, s.session.items.length) >= s.session.items.length)) return {};
      returns.set(ask, s.session.items.length);
      return { session: { ...s.session, items: [...s.session.items, item] } };
    }
    if (given.has(`${seq}:${slot}`) || on !== dropped.has(slot)) return {};
    if (on) dropped.delete(slot); else dropped.add(slot);
    return { session: { ...s.session, items: s.session.items.map((i, k) => (on && k === slot ? item : i)) } };
  });
  /** The elements that ask what the one at `k` asks, after it: its return, that one's, and on. */
  const asksAfter = (k: number): Set<number> => {
    const out = new Set<number>();
    for (let at: number | undefined = k; at !== undefined && !out.has(at); at = returns.get(`${seq}:${at}`)) out.add(at);
    return out;
  };

  const onGrade = (shown: CardItem, g: Grade, line: CardSchedule | undefined) => {
    const vault = currentVault();
    if (!vault) return;
    hapticGrade(g);
    const now = appNow();
    const ms = now.getTime() - shownAt.current;
    const place = idx;
    const was = given.get(key);
    // asked again: the asking that brought it here, graded
    const back = [...returns].find(([, at]) => at === place)?.[0];
    const prior = back === undefined ? undefined : given.get(back);
    // what the grade will leave, told now: from the line as the document has it (given again, from before the grade it
    // replaces, as it will be written); a grade before it still being written (the one this replaces, the asking that
    // brought the card back) is not in the document yet, and is counted from what it was told
    const base = was
      ? (was.written === undefined ? was.from : was.written ? regradeFrom(line, was.written) : line)
      : prior && prior.written === undefined ? prior.next : line;
    const next = gradeAhead(shown.path, base, g, now);
    // in its steps, due minutes on: asked again before the session ends (not one studied ahead, which asks each card once)
    const again = !session?.cram && inSteps(next);
    const returning = (sched: CardSchedule): CardItem => {
      const s = useApp.getState().session;
      const live = s?.seq === seq ? s?.items[place] : undefined;
      const { due: _d, pulled: _p, buried: _b, held: _h, ...rest } = live?.kind === 'card' ? live : shown;
      return { ...rest, sched, ...(sched.due ? { due: sched.due, dueAt: whenToDate(sched.due) } : { dueAt: now }) };
    };
    comeBack(key, returning(next), again);
    let told = null as Graded | null;
    // once an edit of the card is written, the item as it is then: a card with no id is found by its new text
    const run = edits.current.then(async () => {
      // given again: once the grade it replaces is written (a card it gave an id has it), from before it, its log line in that one's place
      const over = was ? await was.run : null;
      // asked again: once its last asking's grade is written, its line after that one's
      const before = prior ? await prior.run : null;
      const s = useApp.getState().session;
      const live = s?.seq === seq ? s?.items[place] : undefined;
      const item = live?.kind === 'card' && live.path === shown.path && live.block === shown.block ? live : shown;
      const loaded = await gradeCard(item, g, now, ms, over, (w) => { told = w; }, before?.line.at);
      return { item, loaded };
    }).then(({ item, loaded }) => {
      if (!loaded) return;
      // a card that had no id has one now, and a blank it numbered is numbered:
      // later items of the same card in this session follow
      const at = loaded.doc.blocks[item.block];
      emitGrade(item, g, at?.kind === 'card' ? at : null);
      // the blank this item numbered is its group now, so a grade given again finds its line; so is its return's
      const n = told?.line.key?.startsWith('c') ? Number(told.line.key.slice(1)) : null;
      if (n !== null && item.group && 'blank' in item.group && at?.kind === 'card') {
        const mine = asksAfter(place);
        useApp.setState((s) => (s.session && s.session.seq === seq ? {
          session: { ...s.session, items: s.session.items.map((i, k) => (mine.has(k) && i.kind === 'card' ? { ...i, group: { n }, text: at.text } as CardItem : i)) },
        } : {}));
      }
      if (at?.kind !== 'card' || item.id !== undefined) return;
      useApp.setState((s) => (s.session ? {
        session: {
          ...s.session,
          items: s.session.items.map((i) => (i.kind === 'card' && i.path === item.path && i.block === item.block && i.id === undefined ? { ...i, id: at.id, text: at.text } as CardItem : i)),
        },
      } : {}));
    });
    run.catch(fail);
    // what a grade after this one replaces: this one once written, else (it did not land) the one before it
    const mine: Given = { g, run: run.then(() => told, () => told ?? was?.run ?? null), from: base, next };
    void mine.run.then((w) => {
      mine.written = w;
      // drawn again: the hints of a grade given again are from before this one, now that it is known
      useApp.setState((s) => (s.session && s.session.seq === seq ? { session: { ...s.session } } : {}));
      // written, and not as told (the line changed under it): the card comes back, or does not, as the file says
      if (w && given.get(key) === mine && inSteps(w.next) !== again && !session?.cram) comeBack(key, returning(w.next), !again, true);
    });
    given.set(key, mine);
    advance();
  };

  // `s`: the card out of the queue (the deck's suspend, its notice's undo), ungraded, and on to the next;
  // on one come back to, it is brought back and stays up to be graded. After what this session is still writing.
  const onSuspend = (ref: CardRef, on: boolean) => {
    const writes = Promise.all([edits.current, ...[...given.values()].map((g) => g.run)]);
    void writes.then(() => bulkCards([ref], { kind: on ? 'suspend' : 'unsuspend' })).catch(failed(on ? 'suspend' : 'unsuspend'));
    if (on) advance();
  };

  // what was done to a topic in this session, by where it is: come back to, it is shown, and nothing is written twice
  const acted = marks.acted;
  const unmark = (at: string) => {
    acted.delete(at);
    useApp.setState((s) => (s.session && s.session.seq === seq ? { session: { ...s.session } } : {}));
  };
  const onDoc = (item: ReadItem | WriteItem | SectionItem, action: DocAction, pos?: number, y?: number) => {
    const vault = currentVault();
    if (!vault) return;
    if (acted.has(key)) { advance(); return; }
    const now = appNow();
    const at = key;
    const line = docLine(item, action, now, pos);
    acted.set(at, { action, word: doneWord(item, action, now, pos) });
    let before = null as Doc | null;
    let putBack = null as (() => Promise<void>) | null;
    const run = actOnDoc(item, action, pos, y, (doc) => { before = doc; }, (undo) => { putBack = undo; });
    // later and dismiss can be taken back from the notice: the document as it was, and the element to act on again
    if (action === 'on') note(line);
    else {
      void run.then(() => notify(line, null, before || putBack ? async () => {
        if (putBack) await putBack();
        else await putBackDoc(item, before!);
        unlogReading(item.path, item.kind === 'section' ? item.heading : undefined);
        unmark(at);
      } : undefined), () => {});
    }
    run.catch((e: unknown) => {
      unmark(at);
      // no longer enrolled (dismissed since the walk was made: on another device, synced in under the session; from its
      // row): there was nothing to act on, and the session has moved on
      if (e instanceof Error && /not enrolled/.test(e.message)) { note(`${glyphOf(item)} no longer in the queue`); return; }
      failed(action === 'on' ? 'next' : action === 'postpone' ? 'later' : 'dismiss')(e);
    });
    advance();
  };

  // a card learnt and then tested is in the walk twice: one element
  const distinct = new Set(items.map((i) => (i.kind === 'card' ? learnKey(i) : `${i.kind}#${i.path}#${i.kind === 'section' ? `${i.block}#${i.passage ? `${i.passage.hash}#${i.passage.boxes}` : i.heading}` : ''}`))).size;
  // the tests still to come of cards that will be learnt first: counted from the start, so the total does not grow underfoot
  const ahead = learnNew ? items.filter((c, i) => c.kind === 'card' && itemOwesLearning(c) && !learnt.has(learnKey(c)) && !given.has(`${seq}:${i}`)).length : 0;
  // a card that comes back is one more when its grade brings it: that cannot be told from the start
  const shownTotal = asked + ahead;

  if (!el) {
    return (
      <div className="recall-wrap">
        <div className="empty center session-end">{total === 0 ? 'nothing due' : `all done, ${plural(distinct, 'item')} · back to the queue`}</div>
      </div>
    );
  }

  const onOut = phone ? () => openNode(deck?.id ?? queueId('today')) : undefined;
  if (el.kind !== 'card') {
    return <DocSession key={key} item={el} active={active} idx={place} total={asked} of={shownTotal} onPrev={goPrev} onNext={goNext} onOut={onOut} onAct={(a, pos, y) => onDoc(el, a, pos, y)} done={acted.get(key)} onPass={advance} />;
  }

  const openSource = (e: MouseEvent) => goToSource({ cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey });
  // where the card sits: the document, then the headings over it
  const trail = trailParts(el, docs);
  return (
    <div className="recall-wrap">
      <div className="recall-meta">
        <Nav idx={place} total={asked} onPrev={goPrev} onNext={goNext} onOut={onOut} past={past} />
        {deck
          ? <span className="sess-count sess-deck">{studyHeader(deck.title, shownTotal - place)}</span>
          : <span className="sess-count">{place + 1} / {shownTotal}</span>}
        <span className="el-tag" data-el="card" data-form={el.form}>{FORM_LABEL[el.form]}</span>
        <button type="button" className="meta-srclink card-trail" onClick={openSource} title={`${plainMath(trail.join(' › '))}  o`}>
          {trail.map((t, i) => <bdi key={i} className={i ? 'ct-h' : 'ct-doc'}><MathText text={t} title={false} /></bdi>)}
          <span className="ms-arrow">↗</span>
        </button>
      </div>
      <CardElement key={key} item={el} active={active} given={given.get(key)} locked={given.has(`${seq}:${returns.get(key)}`)} onGrade={(g, line) => onGrade(el, g, line)} onSkip={advance} onGone={(g) => setGoneAt((was) => (g ? key : was === key ? null : was))} onEdit={onEdit} learnable={learnNew && (learnt.get(learnKey(el)) ?? key) === key} learntHere={learnt.get(learnKey(el)) === key} onLearnt={() => onLearnt(el)} onSuspend={onSuspend} />
    </div>
  );
}
