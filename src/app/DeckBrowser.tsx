// The deck lens: a browser over every card under a deck, a folder, or a
// document with children (each row its form, its faces, its due and
// interval, and its file's path when there is more than one file), with a
// search, chips, a sort, a selection with bulk actions, a card opened in
// the card view by a double-click or ⏎ (`CardPane.tsx`), a new card written
// in a sheet over the window in the session's two boxes, and `study`. The model is deck.ts,
// cardEdit.ts, and study.ts; the writes are deckOps.ts. A list of more than 200 rows is
// drawn through a window (windowed.ts): the cursor, a range, a reveal go by a row's place
// in the list, never by its being in the DOM.

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { PRI_DEFAULT, PRI_MAX, PRI_MIN, cardFields, meta, parsePri, type Card, type CardForm } from '../format/index.js';
import type { Dir } from '../reader/index.js';
import { FaceField, pressIntoFace } from './FaceField.js';
import { whenToDate } from '../schedule/index.js';
import { runBlockHooks, usePlugins } from '../plugins/index.js';
import { revealIndex } from './chrome.js';
import { asks, facesText, planEdit, switchForm, type Faces } from './cardEdit.js';
import {
  CARD_FORMS, DEFAULT_VIEW, FORM_CHIPS, NO_SELECTION, SORTS, STATE_CHIPS, clickSelect, countLabel, deckRows, docTargets, docsUnder, filterRows, fold,
  findCard, followSelection, rowFinder, selectAll, selectedRows, sortRows, type BulkAction, type CardRef, type DeckRow, type DeckSort, type DeckView, type Selection, type StateChip,
} from './deck.js';
import { bulkCards, newCardAt, studyDeck } from './deckOps.js';
import { FORM_LABEL, dueWhen, fmtDays, pathLabel, dueTone } from './items.js';
import { MENU_W, placeMenu, onPage } from './NodeMenu.js';
import { GLYPH, kindOf, titleOf } from './names.js';
import { blankAnswers, clozeHTML, faceDir, richHTML } from './Reader.js';
import { useApp } from './store.js';
import { failed } from './land.js';
import { docsOf, note, openCard, openCards, setDeckView } from './vault.js';
import { canLink, cardFaces, type SameCard } from './same.js';
import { currentPairs, linkCards, mergeCards, notTheSame } from './sameOps.js';
import './session.css';
import './deck.css';
import { appNow } from './clock.js';
import { Glyph, Plus } from './icons.js';
import { Heights, WHOLE, anchorAt, clampWin, holds, probe, topFor, topOf, windowOf, type Anchor, type Win } from './windowed.js';

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const refOf = (r: DeckRow): CardRef => (r.id === undefined ? { path: r.path, block: r.block, text: r.text } : { path: r.path, block: r.block, id: r.id, text: r.text });

type RowFaces = { front: string; back: string; frontDir?: Dir | undefined; backDir?: Dir | undefined };

/** A row's two faces as HTML: a cloze's text with its blanks lit in place (its answers are not repeated as a back). */
function drawFaces(text: string): RowFaces {
  const f = cardFields(text);
  if (!f) return { front: richHTML(text), back: '', frontDir: faceDir(text) };
  if (f.form === 'qa') return { front: richHTML(f.front), back: richHTML(f.back), frontDir: faceDir(f.front), backDir: faceDir(f.back) };
  if (f.form === 'bidir') return { front: richHTML(f.left), back: richHTML(f.right), frontDir: faceDir(f.left), backDir: faceDir(f.right) };
  return { front: clozeHTML(text, () => 'revealed', () => 'cz'), back: '', frontDir: faceDir(text) };
}

/**
 * The faces by text, drawn once: a click or a key redraws every row, and
 * KaTeX over 750 rows each time was most of the deck browser's cost
 * (milestone 40: a click over the whole collection 99 ms before).
 */
const facesCache = new Map<string, RowFaces>();
export function facesHTML(text: string): RowFaces {
  let f = facesCache.get(text);
  if (!f) {
    if (facesCache.size > 5000) facesCache.clear();
    f = drawFaces(text);
    facesCache.set(text, f);
  }
  return f;
}

// ── the editor ───────────────────────────────────────────────────

const FORMS = CARD_FORMS;

/** A press on a button of the editor's foot leaves the caret in its face, as a press on the span it was did. */
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

/** Whether anything is written in either face. */
const written = (f: Faces): boolean => f.front.trim() !== '' || f.back.trim() !== '';

interface EditorProps {
  /** The card as it is in the file; absent for a new one. */
  card?: Card;
  initial: Faces;
  /** The card's own priority, else the document's. */
  pri: number;
  onSave(text: string, pri: number | null, again: boolean): void;
  /** Let go, by Escape or `cancel`: `draft` is what the faces held then. */
  onCancel(draft?: Faces): void;
}

/**
 * A card open in the list: the two faces live, the form switch, the
 * priority. ⌘⏎ or a click outside saves, ⇧⌘⏎ saves and opens a new card
 * after it, Escape cancels (handing back what was typed). A press outside
 * faces that are no card yet lets them go only when both are empty. A save
 * that would drop a reviewed blank's schedule asks first.
 */
export function CardEditor({ card, initial, pri: initialPri, onSave, onCancel }: EditorProps) {
  const [faces, setFaces] = useState<Faces>(initial);
  const [gen, setGen] = useState(0);
  const [pri, setPri] = useState(String(initialPri));
  const [asking, setAsking] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const text = facesText(faces);
  const plan = card && text !== null ? planEdit(card, text) : null;

  const save = (again: boolean, sure = false) => {
    if (text === null) return;
    if (plan && asks(plan) && !sure && asking === null) {
      const lost = plan.dropped.filter((d) => d.reps > 0).map((d) => `${d.reverse ? 'the reverse' : `blank ${d.n}`} (${plural(d.reps, 'review')})`).join(', ');
      setAsking(`drops the schedule of ${lost}`);
      return;
    }
    onSave(text, parsePri(pri.trim()), again);
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  // a press outside saves, unless the editor is asking; faces that are no card yet stay as they are,
  // and are let go only when nothing is written in them
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      // a menu of a face's own (a table's, the text's, insert table) is not outside
      if ((e.target as HTMLElement | null)?.closest?.('.pop-menu, .blank-row')) return;
      if (asking !== null) return;
      if (facesText(faces) !== null) saveRef.current(false);
      else if (!written(faces)) onCancel();
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [faces, asking, onCancel]);

  const to = (form: CardForm) => {
    setFaces((f) => switchForm(f, form));
    setGen((g) => g + 1);
    setAsking(null);
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (asking !== null) setAsking(null); else onCancel(faces); }
    else if (mod && (e.key === '1' || e.key === '2' || e.key === '3')) { e.preventDefault(); to(FORMS[Number(e.key) - 1]![0]); }
  };
  // ⌘⏎ before the face sees it: in a table's cell it would add a row
  const onKeyDownCapture = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    e.stopPropagation();
    save(e.shiftKey, asking !== null);
  };
  const two = faces.form !== 'cloze';
  return (
    <div className="composer deck-edit" ref={ref} onKeyDownCapture={onKeyDownCapture} onKeyDown={onKeyDown} data-form={faces.form}>
      <div className="hd">
        <span>{card ? 'edit card' : 'new card'}</span>
        <div className="type-toggle">
          {FORMS.map(([key, label], i) => (
            <button key={key} type="button" data-active={faces.form === key ? '1' : '0'} onClick={() => to(key)}>
              {label}<sup className="tt-num">{i + 1}</sup>
            </button>
          ))}
        </div>
      </div>
      <div className="card" data-faces={two ? '2' : '1'}>
        <div className="face front" onMouseDown={pressIntoFace}>
          <FaceField
            key={`f${gen}`}
            value={faces.front}
            placeholder={two ? 'front' : 'text, ⌘B for a blank'}
            autoFocus
            blanks={!two}
            onChange={(front) => { setFaces((f) => ({ ...f, front })); setAsking(null); }}
          />
        </div>
        {two && (
          <div className="face back" onMouseDown={pressIntoFace}>
            <FaceField key={`b${gen}`} value={faces.back} placeholder="back" onChange={(back) => { setFaces((f) => ({ ...f, back })); setAsking(null); }} />
          </div>
        )}
      </div>
      <div className="ft">
        <label className="pri-pick">
          priority
          <input type="number" inputMode="numeric" min={PRI_MIN} max={PRI_MAX} step={1} value={pri} onChange={(e) => setPri(e.target.value)} onBlur={() => { if (parsePri(pri.trim()) === null) setPri(String(initialPri)); }} />
        </label>
        <span className="grow" />
        {asking !== null ? (
          <>
            <span className="de-ask">{asking}</span>
            <button type="button" className="act" onMouseDown={keepFocus} onClick={() => save(false, true)}><kbd>⌘↵</kbd> save anyway</button>
            <span>·</span>
            <button type="button" className="act" onMouseDown={keepFocus} onClick={() => setAsking(null)}><kbd>esc</kbd> back</button>
          </>
        ) : (
          <>
            <button type="button" className="act" data-able={text ? '1' : '0'} onMouseDown={keepFocus} onClick={() => save(false)}><kbd>⌘↵</kbd> save</button>
            <span>·</span>
            <button type="button" className="act" onMouseDown={keepFocus} onClick={() => onCancel(faces)}><kbd>esc</kbd> cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── similar: the same fact twice ─────────────────────────────────

/** One side of a pair: the card as a row draws it, where it lives, its schedule, and `keep this`. */
function SameSide({ c, card, now, onKeep }: { c: SameCard; card: Card | null; now: Date; onKeep(): void }) {
  const f = facesHTML(c.text);
  const s = card?.sched;
  const form = cardFields(c.text)?.form;
  const suspended = !!s?.suspended;
  return (
    <div className="sp-side" data-key={c.key} data-path={c.path} data-block={c.block}>
      <div className="sp-head">
        <span className="dr-form" data-form={form}>{form ? FORM_LABEL[form] : ''}</span>
        <button type="button" className="sp-path" title="open the card" onClick={() => openCard(c.path, c.block, c.id)}>{pathLabel(c.path)}</button>
      </div>
      <div className="cs-body dr-faces">
        <span className="dr-front" dir={f.frontDir} dangerouslySetInnerHTML={{ __html: f.front }} />
        {f.back && <span className="dr-back" dir={f.backDir} dangerouslySetInnerHTML={{ __html: f.back }} />}
      </div>
      <div className="sp-sched">
        <span className="dr-due" data-due={!suspended && (!s?.due || whenToDate(s.due) <= now) ? '1' : '0'} data-st={dueTone(suspended ? 'suspended' : dueWhen(s?.due, now))}>{suspended ? 'suspended' : dueWhen(s?.due, now)}</span>
        {s?.ivl !== undefined && s.ivl >= 1 && <span>{fmtDays(s.ivl)}</span>}
        <span>{plural(s?.reps ?? 0, 'review')}</span>
        {(s?.lapses ?? 0) > 0 && <span>{plural(s!.lapses!, 'lapse')}</span>}
        <span className="grow" />
        <button type="button" className="sp-keep" data-act="keep" onClick={onKeep}>keep this</button>
      </div>
    </div>
  );
}

/** Pairs that seem to test the same fact, where either card is under the lens: side by side, best first, each to merge, link, or leave. */
function SimilarList({ paths, q, now }: { paths: readonly string[]; q: string; now: Date }) {
  const docs = useApp((s) => s.docs);
  const notSame = useApp((s) => s.notSame);
  const [limit, setLimit] = useState(60);
  const pairs = useMemo(() => {
    const under = new Set(paths);
    const words = fold(q).split(/\s+/).filter(Boolean);
    const hay = (c: SameCard) => fold(cardFaces(c.text)?.whole ?? c.text);
    return currentPairs().filter((p) => (under.has(p.a.path) || under.has(p.b.path)) && (!words.length || words.every((w) => hay(p.a).includes(w) || hay(p.b).includes(w))));
  // the pairs are found again when the files or the pairs said not the same change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths, q, docs, notSame]);
  const cardOf = (c: SameCard): Card | null => {
    const body = docsOf([c.path])[0]?.[1];
    return body ? findCard(body, c.id === undefined ? { path: c.path, block: c.block, text: c.text } : { path: c.path, block: c.block, id: c.id, text: c.text }) : null;
  };
  if (!pairs.length) return <div className="empty">no similar cards</div>;
  return (
    <div className="same-list">
      {pairs.slice(0, limit).map((p) => {
        const [ca, cb] = [cardOf(p.a), cardOf(p.b)];
        return (
          <div key={`${p.a.key}|${p.b.key}`} className="same-pair" data-a={p.a.key} data-b={p.b.key} data-score={p.score.toFixed(3)}>
            <div className="sp-sides">
              <SameSide c={p.a} card={ca} now={now} onKeep={() => { mergeCards(p.a, p.b).catch(failed('merge')); }} />
              <SameSide c={p.b} card={cb} now={now} onKeep={() => { mergeCards(p.b, p.a).catch(failed('merge')); }} />
            </div>
            <div className="sp-acts">
              {ca && cb && canLink(ca, cb) && <button type="button" data-act="link" title="one schedule for both, one of them a day" onClick={() => { linkCards(p.a, p.b).catch(failed('link')); }}>link</button>}
              <button type="button" data-act="not-same" onClick={() => { notTheSame(p.a, p.b).catch(failed('not the same')); }}>not the same</button>
            </div>
          </div>
        );
      })}
      {pairs.length > limit && <button type="button" className="same-more" onClick={() => setLimit((l) => l + 60)}>{pairs.length - limit} more</button>}
    </div>
  );
}

// ── the rows, through a window ───────────────────────────────────

/** What a row does, the same functions for the life of the browser (so a row is drawn again only when it changes). */
interface RowActs {
  click(r: DeckRow, e: ReactMouseEvent): void;
  open(r: DeckRow): void;
  menu(r: DeckRow, e: ReactMouseEvent): void;
  remove(r: DeckRow): void;
}

interface RowProps {
  r: DeckRow;
  selected: boolean;
  cursor: boolean;
  menu: boolean;
  /** More than one file under the lens: each row says its own. */
  multi: boolean;
  now: Date;
  /** The plugins' version: every plugin's block hook sees the row again when it changes. */
  hooks: unknown;
  acts: RowActs;
  put(key: string, el: HTMLDivElement | null): void;
}

const Row = memo(function Row({ r, selected, cursor, menu, multi, now, hooks, acts, put }: RowProps) {
  const own = useRef<HTMLDivElement | null>(null);
  // the row, drawn: every plugin's block hook sees it
  useEffect(() => {
    if (own.current) runBlockHooks(own.current, { path: r.path, block: r.block, where: 'deck' });
  }, [r, hooks]);
  const f = facesHTML(r.text);
  const ivl = r.sched?.ivl && r.sched.ivl >= 1 ? fmtDays(r.sched.ivl) : '';
  const when = r.suspended ? 'suspended' : dueWhen(r.sched?.due, now);
  return (
    <div>
      <div
        ref={(el) => { own.current = el; put(r.key, el); }}
        className={`card-span deck-row${selected ? ' selected' : ''}${cursor ? ' cursor' : ''}`}
        data-key={r.key}
        data-path={r.path}
        data-block={r.block}
        data-form={r.form}
        data-suspended={r.suspended ? '1' : '0'}
        data-menu={menu ? '1' : '0'}
        onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
        onClick={(e) => acts.click(r, e)}
        onDoubleClick={() => acts.open(r)}
        onContextMenu={(e) => acts.menu(r, e)}
      >
        <span className="dr-form" data-form={r.form}>{FORM_LABEL[r.form]}</span>
        <span className="cs-body dr-faces">
          <span className="dr-front" dir={f.frontDir} dangerouslySetInnerHTML={{ __html: f.front }} />
          {f.back && <span className="dr-back" dir={f.backDir} dangerouslySetInnerHTML={{ __html: f.back }} />}
          {multi && <span className="dr-path">{pathLabel(r.path)}</span>}
        </span>
        {r.reverse && !r.suspended ? (
          // both ways: each direction's due on a line of its own, front to back first
          <span className="dr-when" data-dirs="2">
            <span className="dr-due" data-dir="f" data-due={r.sched?.due === undefined || r.dueAt <= now ? '1' : '0'} title={ivl ? `front to back, interval ${ivl}` : 'front to back'} data-st={dueTone(when)}><span className="dr-dir">→</span> <span className="dw">{when}</span></span>
            <span className="dr-due" data-dir="r" data-due={r.reverse.isDue ? '1' : '0'} title={r.reverse.sched?.ivl && r.reverse.sched.ivl >= 1 ? `back to front, interval ${fmtDays(r.reverse.sched.ivl)}` : 'back to front'} data-st={dueTone(r.reverse.suspended ? 'suspended' : dueWhen(r.reverse.sched?.due, now))}>
              <span className="dr-dir">←</span> <span className="dw">{r.reverse.suspended ? 'suspended' : dueWhen(r.reverse.sched?.due, now)}</span>
            </span>
          </span>
        ) : (
          <span className="dr-when" title={ivl && !r.suspended ? `interval ${ivl}` : undefined}>
            <span className="dr-due" data-due={r.isDue ? '1' : '0'} data-st={dueTone(when)}><span className="dw">{when}</span></span>
          </span>
        )}
        <button type="button" className="cs-del" title="delete card" aria-label="delete card" onClick={(e) => { e.stopPropagation(); acts.remove(r); }}><Glyph g="×" /></button>
      </div>
    </div>
  );
});

/** What the browser asks of its rows. */
interface RowsHandle {
  /**
   * The row `key` into view, as `scrollIntoView` would: at once when it is
   * drawn, else the window is moved to where it is reckoned to be and the
   * row brought in once it is there. False when the row is not in the list.
   */
  bring(key: string, block: 'nearest' | 'center'): boolean;
}

interface RowsProps {
  shown: DeckRow[];
  /** Each shown row's place, by key. */
  index: ReadonlyMap<string, number>;
  selSet: ReadonlySet<string>;
  cursorKey: string | null;
  menuKey: string | null;
  multi: boolean;
  now: Date;
  hooks: unknown;
  acts: RowActs;
  mem: DeckMemory;
  handle: RefObject<RowsHandle | null>;
}

/**
 * The rows near the view, in a box padded above and below to the height of
 * the whole list (windowed.ts). Each row drawn is measured after every
 * draw; the rest stand at the average. A list of up to `WHOLE` rows is
 * drawn whole, unmeasured, as every list was before.
 */
const DeckRows = memo(function DeckRows({ shown, index, selSet, cursorKey, menuKey, multi, now, hooks, acts, mem, handle }: RowsProps) {
  const box = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLElement | null>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const put = useCallback((key: string, el: HTMLDivElement | null) => { if (el) els.current.set(key, el); else els.current.delete(key); }, []);
  // the heights of this list: made again when the list is (read again, searched, sorted), from what was measured before
  const made = useRef<{ shown: DeckRow[]; model: Heights } | null>(null);
  if (made.current?.shown !== shown) made.current = { shown, model: new Heights(shown.length, mem.guess, (i) => mem.heights.get(shown[i]!.key)) };
  const model = made.current.model;
  // back in front: the window opens on the row that was under the top of the view
  const cameTo = (): number | undefined => {
    const a = model.count <= WHOLE ? null : mem.at;
    const i = !a ? undefined : shown[a.index]?.key === a.key ? a.index : index.get(a.key);
    return i === undefined ? undefined : topOf(model, { index: i, into: a!.into });
  };
  const [win, setWin] = useState<Win>(() => windowOf(model, cameTo() ?? 0, window.innerHeight || 800));
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const w = clampWin(model, win);
  const winNow = useRef(w);
  winNow.current = w;
  /** A row to bring into view once it is drawn. */
  const want = useRef<{ key: string; block: 'nearest' | 'center' } | null>(null);

  /** The window for where the view is now, and the row under its top remembered. */
  const sync = () => {
    const pane = paneRef.current;
    const list = box.current;
    if (!pane || !list) return;
    const vp = probe.viewport(pane);
    const top = probe.scrollTop(pane) - probe.listTop(list, pane);
    if (!holds(model, winNow.current, top, vp)) {
      const next = windowOf(model, top, vp);
      winNow.current = next;
      setWin(next);
    }
    // a list drawn whole comes back by the pane's own offset, as it always did
    const a = model.count <= WHOLE ? null : anchorAt(model, top);
    mem.at = a ? { ...a, key: shown[a.index]!.key } : null;
  };
  const syncNow = useRef(sync);
  syncNow.current = sync;

  const bring = (key: string, block: 'nearest' | 'center'): boolean => {
    const i = index.get(key);
    const pane = paneRef.current;
    const list = box.current;
    if (i === undefined || !pane || !list) return false;
    const el = els.current.get(key);
    if (el) { el.scrollIntoView({ block }); return true; }
    // not drawn: by its place in the list, then exactly once it is there
    const vp = probe.viewport(pane);
    const above = probe.listTop(list, pane);
    const y = topFor(model, i, probe.scrollTop(pane) - above, vp, block);
    probe.scrollTo(pane, above + y);
    want.current = { key, block };
    const next = windowOf(model, y, vp);
    winNow.current = next;
    setWin(next);
    return true;
  };

  useLayoutEffect(() => {
    const list = box.current;
    const pane = list?.closest<HTMLElement>('.pane-body') ?? list?.parentElement?.parentElement ?? null;
    paneRef.current = pane;
    if (!list || !pane) return;
    const y = cameTo();
    if (y !== undefined) probe.scrollTo(pane, probe.listTop(list, pane) + y);
    const onScroll = () => syncNow.current();
    pane.addEventListener('scroll', onScroll, { passive: true });
    // a row grown (an image in, the pane narrower) or the view taller: measured again
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => redraw());
    ro?.observe(list);
    ro?.observe(pane);
    return () => { pane.removeEventListener('scroll', onScroll); ro?.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mem]);

  // after every draw: the rows there are measured, the scroll held where it was, the window set for the view
  useLayoutEffect(() => {
    handle.current = { bring };
    const pane = paneRef.current;
    const list = box.current;
    if (!pane || !list) return;
    // a list drawn whole needs no heights: every row is there
    const whole = model.count <= WHOLE;
    // the row under the top of the view, by the heights as they were drawn
    const held = whole ? null : anchorAt(model, probe.scrollTop(pane) - probe.listTop(list, pane));
    let changed = false;
    const fresh = model.measured === 0;
    const width = whole ? 0 : probe.width(list);
    if (width > 0 && width !== mem.width) {
      // every row wraps anew at another width
      if (mem.width > 0) { mem.heights.clear(); model.clear(); changed = true; }
      mem.width = width;
    }
    for (let i = whole ? w.end : w.start; i < w.end; i++) {
      const key = shown[i]!.key;
      const el = els.current.get(key)?.parentElement;
      if (!el) continue;
      const px = probe.height(el);
      if (model.set(i, px)) { mem.heights.set(key, px); changed = true; }
    }
    // the estimate follows the average only when that moves nothing in view: the first rows measured, or no row above the view
    if (changed && (fresh || !held) && model.settle()) changed = true;
    if (changed) {
      mem.guess = model.average;
      if (held) {
        const top = probe.scrollTop(pane) - probe.listTop(list, pane);
        const by = topOf(model, held) - top;
        if (Math.abs(by) >= 1) probe.scrollTo(pane, probe.scrollTop(pane) + by);
      }
      // drawn again with the padding the heights now give; the row asked for waits for that
      redraw();
    }
    sync();
    const p = want.current;
    if (p && !changed) {
      const el = els.current.get(p.key);
      if (el) { want.current = null; el.scrollIntoView({ block: p.block }); sync(); }
      else if (!index.has(p.key)) want.current = null;
    }
  });
  useEffect(() => () => { handle.current = null; }, [handle]);

  return (
    <div className="deck-rows" ref={box} style={{ paddingTop: model.offset(w.start), paddingBottom: model.total - model.offset(w.end) }}>
      {shown.slice(w.start, w.end).map((r) => (
        <Row key={r.key} r={r} selected={selSet.has(r.key)} cursor={cursorKey === r.key} menu={menuKey === r.key} multi={multi} now={now} hooks={hooks} acts={acts} put={put} />
      ))}
    </div>
  );
});

// ── the browser ──────────────────────────────────────────────────

/** A right-click on a row: where, and whether the move list shows. */
interface RowMenu { x: number; y: number; key: string; sub: boolean }

/** A new card's editor open in the list (a card that is there is edited in the card view). */
type Editing = { after: CardRef | null; path: string } | null;

/**
 * What a deck keeps while its tab is away (the canvas draws only the tab in
 * front, so the lens is unmounted behind another): its search, the card
 * under the cursor, how far it was scrolled (`top` the pane's own offset,
 * for a view still above the rows; `at` the row under the top of the view
 * and how far into it, which is what the window comes back to), the row
 * heights measured so far and the width they were measured at, and a new
 * card let go by Escape with something written. For the session, per
 * collection and lens.
 */
interface DeckMemory {
  q: string;
  cursor: CardRef | null;
  top: number;
  at: (Anchor & { key: string }) | null;
  heights: Map<string, number>;
  width: number;
  /** The average height of the rows measured, for those that are not. */
  guess: number;
  draft: Faces | null;
}
const memories = new Map<string, DeckMemory>();
function memoryOf(root: string | null, home: string): DeckMemory {
  const k = `${root ?? ''}\n${home}`;
  let m = memories.get(k);
  if (!m) { m = { q: '', cursor: null, top: 0, at: null, heights: new Map(), width: 0, guess: 0, draft: null }; memories.set(k, m); }
  return m;
}

interface BrowserProps {
  /** The lens: a document, a folder, a document's children directory, `''` the root. */
  home: string;
  active: boolean;
}

export function DeckBrowser({ home, active }: BrowserProps) {
  const tree = useApp((s) => s.tree);
  const order = useApp((s) => s.order);
  const files = useApp((s) => s.files);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const cursor = useApp((s) => s.selectedCard);
  const reveal = useApp((s) => s.reveal);
  const view: DeckView = useApp((s) => s.deckViews[home]) ?? DEFAULT_VIEW;
  const plugins = usePlugins();
  // a phone's `+` is at its foot, and starts on the deck in front (`quick.ts`)
  const phone = useApp((s) => s.phone);
  const mem = useMemo(() => memoryOf(root, home), [root, home]);
  const [q, setQText] = useState(mem.q);
  const setQ = (v: string) => { mem.q = v; setQText(v); };
  const [editing, setEditing] = useState<Editing>(null);
  const [cram, setCram] = useState(false);
  const [similar, setSimilar] = useState(false);
  const [menu, setMenu] = useState<RowMenu | null>(null);
  const [bulkMenu, setBulkMenu] = useState<'move' | 'pri' | 'reset' | null>(null);
  const [priText, setPriText] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<RowsHandle | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const byKey = useRef(false);
  /** A new card's write on its way: a second save waits for it. */
  const saving = useRef(false);

  const paths = useMemo(() => docsUnder(tree, home, order, files), [tree, home, order, files]);
  // `docs` changes with every write the vault reports: the bodies are read again then
  const bodies = useMemo(() => docsOf(paths), [paths, docs]);
  const now = useMemo(() => appNow(), [bodies]);
  const rows = useMemo(() => deckRows(bodies, now), [bodies, now]);
  const shown = useMemo(() => sortRows(filterRows(rows, q, view), view.sort), [rows, q, view]);
  const keys = useMemo(() => shown.map((r) => r.key), [shown]);
  // the rows by key, and each shown row's place: the cursor, a range and a reveal go by these, not by what is drawn
  const index = useMemo(() => { const m = new Map<string, number>(); keys.forEach((k, i) => m.set(k, i)); return m; }, [keys]);
  const rowOf = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  // another lens, search, chips or sort: a card on its way into view is let go
  const listFor = useRef({ home, q, view });
  useEffect(() => {
    const d = listFor.current;
    if (d.home === home && d.q === q && d.view === view) return;
    listFor.current = { home, q, view };
    arrive.current = null;
  }, [home, q, view]);
  const multi = paths.length > 1;
  // the selection is held by `path#block`, and follows its cards when the files are read again
  // (a card gone above moves every block after it)
  const [held, setHeld] = useState<{ sel: Selection; rows: DeckRow[] }>(() => ({ sel: NO_SELECTION, rows }));
  const sel = held.rows === rows ? held.sel : followSelection(held.sel, held.rows, rows);
  if (held.rows !== rows) setHeld((h) => (h.rows === rows ? h : { sel: followSelection(h.sel, h.rows, rows), rows }));
  const setSel = (next: Selection | ((s: Selection) => Selection)) => setHeld((h) => ({ ...h, sel: typeof next === 'function' ? next(h.sel) : next }));
  const selSet = useMemo(() => new Set(sel.keys), [sel]);
  const chosen = useMemo(() => (similar ? [] : selectedRows(sel, shown)), [similar, sel, shown]);
  const cursorKey = cursor && paths.includes(cursor.path) ? `${cursor.path}#${cursor.index}` : null;
  // a revealed row not in the list yet when it was selected: scrolled to once it is
  const pendingReveal = useRef<string | null>(null);
  // a card just written from the sheet: brought into view once its row is drawn (the row there before
  // the files are read again is another card's)
  const arrive = useRef<{ key: string; text: string } | null>(null);
  useLayoutEffect(() => {
    const k = pendingReveal.current;
    if (k !== null && list.current?.bring(k, 'center')) pendingReveal.current = null;
    const a = arrive.current;
    const at = a ? index.get(a.key) : undefined;
    if (a && at !== undefined && shown[at]!.text === a.text && list.current?.bring(a.key, 'nearest')) arrive.current = null;
  });
  const homeDoc = home.endsWith('.md') ? home : files.includes(`${home}.md`) ? `${home}.md` : null;

  const setView = (patch: Partial<DeckView>) => setDeckView(home, { ...view, ...patch });
  const toggle = <T,>(list: T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  /**
   * The card the cursor is on, to find again when the files are read anew: the store names it by
   * `path` and block, which is another card once one above has gone. `held` while the deck itself
   * has said where the cursor goes next (the row that took a deleted card's place, a card just made).
   */
  const follow = useRef<{ rows: DeckRow[]; ref: CardRef | null; held: boolean }>({ rows, ref: null, held: false });
  const point = (r: DeckRow | undefined) => {
    follow.current.held = false;
    useApp.setState({ selectedCard: r ? { path: r.path, index: r.block } : null });
  };

  // back in front: the cursor where it was left, and the scroll (the search came back with the state)
  useLayoutEffect(() => {
    const pane = top.current?.closest<HTMLElement>('.pane-body') ?? top.current?.parentElement ?? null;
    if (!pane) return;
    // the rows have come back to the row that was under the top of the view (`DeckRows`); a view still above them, to its offset
    if (mem.at === null && mem.top > 0) pane.scrollTop = mem.top;
    const onScroll = () => { mem.top = pane.scrollTop; };
    pane.addEventListener('scroll', onScroll, { passive: true });
    return () => pane.removeEventListener('scroll', onScroll);
  }, [mem]);
  useEffect(() => {
    if (!active || !mem.cursor || useApp.getState().reveal) return;
    const r = rowFinder(rows)(mem.cursor);
    if (r) point(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mem]);

  // the cursor follows its card
  useEffect(() => {
    const f = follow.current;
    // the store as it is now: an effect before this one may have just moved the cursor
    const cur = useApp.getState().selectedCard;
    const cursorKey = cur && paths.includes(cur.path) ? `${cur.path}#${cur.index}` : null;
    if (f.rows !== rows) {
      f.rows = rows;
      const r = f.ref ? rowFinder(rows)(f.ref) : undefined;
      if (r) {
        f.held = false;
        f.ref = refOf(r);
        mem.cursor = f.ref;
        if (r.key !== cursorKey) { useApp.setState({ selectedCard: { path: r.path, index: r.block } }); return; }
      }
    }
    if (!f.held) {
      const at = cursorKey === null ? undefined : rowOf.get(cursorKey);
      f.ref = at ? refOf(at) : null;
    }
    mem.cursor = f.ref;
  });

  // the cursor goes with the lens
  useEffect(() => () => {
    const cur = useApp.getState().selectedCard;
    if (cur && paths.includes(cur.path)) useApp.setState({ selectedCard: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home]);

  // a row moved to by key comes into view
  useEffect(() => {
    if (!byKey.current || cursorKey === null) return;
    byKey.current = false;
    list.current?.bring(cursorKey, 'nearest');
  }, [cursorKey]);

  // a card opened from the palette or a query lands selected, in view
  useEffect(() => {
    if (!reveal || !paths.includes(reveal.path)) return;
    const body = bodies.find(([p]) => p === reveal.path);
    if (!body) return;
    const i = revealIndex(body[1].blocks, reveal);
    if (i >= 0) {
      const key = `${reveal.path}#${i}`;
      follow.current.held = false;
      useApp.setState({ selectedCard: { path: reveal.path, index: i } });
      setSel({ keys: [key], anchor: key });
      if (!list.current?.bring(key, 'center')) pendingReveal.current = key;
    }
    useApp.setState({ reveal: null });
  }, [reveal, bodies, paths]);

  // the row menu closes on any outside press or escape
  useLayoutEffect(() => { placeMenu(menuRef.current); }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', onKey); };
  }, [menu]);

  /**
   * A bulk action, its notice holding the undo. Cards that go (deleted, moved) leave the selection,
   * the rest of it staying on its own cards, and the cursor on one of them goes to the row that
   * takes its place (the next one shown, else the one before); anything else keeps the selection.
   */
  const run = (refs: CardRef[], action: BulkAction) => {
    setBulkMenu(null);
    setMenu(null);
    const gone = action.kind === 'delete' || action.kind === 'move';
    const was = cursorKey;
    if (gone) {
      const out = new Set(refs.filter((r) => action.kind !== 'move' || r.path !== action.to).map((r) => `${r.path}#${r.block}`));
      setSel((s) => ({ keys: s.keys.filter((k) => !out.has(k)), anchor: s.anchor !== null && out.has(s.anchor) ? null : s.anchor }));
      const f = follow.current;
      if (was !== null && out.has(was)) {
        const at = index.get(was) ?? -1;
        const next = at < 0 ? undefined : shown.slice(at + 1).find((r) => !out.has(r.key)) ?? shown.slice(0, at).reverse().find((r) => !out.has(r.key));
        f.ref = next ? refOf(next) : null;
      }
      // the store lets the cursor go with the write; it comes back on `f.ref` when the files are read again
      f.held = f.ref !== null;
    }
    bulkCards(refs, action).catch((e: unknown) => {
      failed(action.kind === 'pri' ? 'priority' : action.kind)(e);
      if (gone && was !== null) point(rowOf.get(was));
    });
  };
  /** One card deleted (×, ⌫, the menu): as two are, with the undo. */
  const removeOne = (r: DeckRow) => run([refOf(r)], { kind: 'delete' });

  /** Where `m` puts a new card: after the cursor's row in its file, else at the end of the lens's own document (or its first). */
  const newCard = () => {
    const at = cursorKey === null ? undefined : shown[index.get(cursorKey) ?? -1];
    if (at) setEditing({ after: refOf(at), path: at.path });
    else if (homeDoc ?? paths[0]) setEditing({ after: null, path: (homeDoc ?? paths[0])! });
  };

  /** A row edited: the card view on its document's cards, at this one (`CardPane.tsx`). */
  const editIn = (r: DeckRow) => openCards(r.path, r.block, r.id);

  const study = (only?: ReadonlySet<string>) => {
    studyDeck(home, { cram, ...(only ? { only } : {}) });
  };

  // keys while no field has focus: / search, j k move, ⏎ edit, m new, ⌫ delete (the selection, else the cursor's row), ⌘A all, escape lets go
  useEffect(() => {
    if (!active || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || inField(e.target) || useApp.getState().paletteOpen) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); if (!similar) setSel(selectAll(keys)); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const at = cursorKey === null ? -1 : index.get(cursorKey) ?? -1;
      const go = (i: number) => {
        const r = shown[i];
        if (!r) return;
        byKey.current = true;
        point(r);
        setSel({ keys: [r.key], anchor: r.key });
      };
      if (e.key === '/') { e.preventDefault(); search.current?.focus(); }
      // the pairs have no cursor of their own: the rows' keys wait
      else if (similar) return;
      else if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); go(at < 0 ? 0 : Math.min(shown.length - 1, at + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); go(at < 0 ? 0 : Math.max(0, at - 1)); }
      else if (e.key === 'Enter' && at >= 0) { e.preventDefault(); editIn(shown[at]!); }
      else if (e.key === 'm') { e.preventDefault(); newCard(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        // what is shown as selected is what goes; with nothing selected, the cursor's row
        if (chosen.length) { e.preventDefault(); run(chosen.map(refOf), { kind: 'delete' }); }
        else if (at >= 0) { e.preventDefault(); removeOne(shown[at]!); }
      } else if (e.key === 'Escape' && !menu) {
        if (sel.keys.length || cursorKey) { e.preventDefault(); setSel(NO_SELECTION); point(undefined); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onRowClick = (r: DeckRow, e: React.MouseEvent) => {
    if (e.shiftKey) e.preventDefault();
    setSel((s) => clickSelect(s, r.key, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey }, keys));
    point(r);
  };

  // the rows' own functions, the same ones for good: each calls what this draw of the browser would
  const live = useRef<RowActs | null>(null);
  live.current = {
    click: onRowClick,
    open: editIn,
    menu: (r, e) => {
      e.preventDefault();
      // the row's menu alone: under a folder's lens the press would open the folder's menu too
      e.stopPropagation();
      if (!selSet.has(r.key)) setSel({ keys: [r.key], anchor: r.key });
      point(r);
      setMenu({ x: Math.min(e.clientX, window.innerWidth - MENU_W), y: e.clientY, key: r.key, sub: false });
    },
    remove: removeOne,
  };
  const acts = useMemo<RowActs>(() => ({
    click: (r, e) => live.current!.click(r, e),
    open: (r) => live.current!.open(r),
    menu: (r, e) => live.current!.menu(r, e),
    remove: (r) => live.current!.remove(r),
  }), []);

  const docPri = (path: string) => docs[path]?.pri ?? PRI_DEFAULT;
  const titleIn = (p: string) => titleOf(p, docs, root);

  const newEditor = (e: { after: CardRef | null; path: string }) => {
    const body = bodies.find(([p]) => p === e.path)?.[1];
    const form = (body && meta(body).defaultCard) || 'qa';
    return (
      <CardEditor
        key={`n:${e.path}:${e.after?.block ?? 'end'}:${e.after?.text ?? ''}`}
        initial={mem.draft ?? { form, front: '', back: '' }}
        pri={docPri(e.path)}
        onCancel={(draft) => {
          // Escape with something written: kept for the next `m` in this deck
          mem.draft = draft && written(draft) ? draft : null;
          if (mem.draft) note('draft kept · m reopens it');
          setEditing(null);
        }}
        onSave={(text, pri, again) => {
          // the sheet stays until the write lands (a failure leaves what was typed); one write at a time
          if (saving.current) return;
          saving.current = true;
          newCardAt(e.path, e.after, text, pri).then((block) => {
            mem.draft = null;
            const made: CardRef = { path: e.path, block, text };
            follow.current.ref = made;
            follow.current.held = true;
            arrive.current = { key: `${e.path}#${block}`, text };
            useApp.setState({ selectedCard: { path: e.path, index: block } });
            setEditing(again ? { after: made, path: e.path } : null);
          }).catch(failed('new card')).finally(() => { saving.current = false; });
        }}
      />
    );
  };

  const editingNew = editing;
  const [allSuspended, anySuspended] = useMemo(() => [chosen.length > 0 && chosen.every((r) => r.suspended), chosen.some((r) => r.suspended)], [chosen]);
  const [due, notSuspended] = useMemo(() => [rows.filter((r) => r.isDue).length, rows.filter((r) => !r.suspended).length], [rows]);
  const menuRow = menu ? rowOf.get(menu.key) : undefined;
  const targets = bulkMenu === 'move' || menu?.sub ? docTargets(tree, order) : [];

  return (
    <div className="deck-browser" ref={top}>
      <div className="deck-study">
        <button type="button" className="ds-study" data-able={rows.length ? '1' : '0'} onClick={() => study()}>
          study <span className="ds-n">{cram ? notSuspended : due}</span>
        </button>
        <label className="ds-cram">
          <input type="checkbox" checked={cram} onChange={(e) => setCram(e.target.checked)} />
          <span className="lbl">include not due</span>
        </label>
        <span className="grow" />
        {!phone && <button type="button" className="deck-add" onClick={newCard}><Plus text="+ card" /> <kbd className="kbd">m</kbd></button>}
      </div>
      <div className="deck-bar">
        <div className="db-row">
          <span className="db-g"><Glyph g="⌕" /></span>
          <input
            ref={search}
            className="db-search"
            dir="auto"
            value={q}
            placeholder="search both faces"
            spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); if (e.key === 'Escape' && q) setQ(''); } }}
          />
          <kbd className="kbd">/</kbd>
          <select className="db-sort" value={view.sort} onChange={(e) => setView({ sort: e.target.value as DeckSort })}>
            {SORTS.map(([s, label]) => <option key={s} value={s}>{label}</option>)}
          </select>
          <span className="db-count">{similar ? 'pairs' : countLabel(shown.length, rows.length)}</span>
        </div>
        <div className="db-row db-chips">
          {FORM_CHIPS.map(([f, label]) => (
            <button key={f} type="button" className="chip" data-on={view.forms.includes(f) ? '1' : '0'} data-chip={f} onClick={() => setView({ forms: toggle(view.forms, f) })}>{label}</button>
          ))}
          <span className="chip-gap" />
          {STATE_CHIPS.map((s: StateChip) => (
            <button key={s} type="button" className="chip" data-on={view.states.includes(s) ? '1' : '0'} data-chip={s} onClick={() => setView({ states: toggle(view.states, s) })}>{s}</button>
          ))}
          <span className="chip-gap" />
          <button type="button" className="chip" data-on={similar ? '1' : '0'} data-chip="similar" title="cards that seem to test the same fact" onClick={() => { setSimilar(!similar); setSel(NO_SELECTION); }}>similar</button>
        </div>
        {!similar && chosen.length > 0 && (
          <div className="db-row db-actions">
            <span className="db-sel">{chosen.length} selected</span>
            <button type="button" data-act="move" onClick={() => setBulkMenu(bulkMenu === 'move' ? null : 'move')}>move to…</button>
            <button type="button" data-act="delete" onClick={() => run(chosen.map(refOf), { kind: 'delete' })}>delete</button>
            {!allSuspended && <button type="button" data-act="suspend" onClick={() => run(chosen.map(refOf), { kind: 'suspend' })}>suspend</button>}
            {anySuspended && <button type="button" data-act="unsuspend" onClick={() => run(chosen.map(refOf), { kind: 'unsuspend' })}>unsuspend</button>}
            {bulkMenu === 'reset'
              ? <button type="button" data-act="reset" className="asking" onClick={() => run(chosen.map(refOf), { kind: 'reset' })}>reset {plural(chosen.length, 'card')} to new?</button>
              : <button type="button" data-act="reset" onClick={() => setBulkMenu('reset')}>reset</button>}
            {bulkMenu === 'pri' ? (
              <input
                className="db-pri"
                autoFocus
                type="number"
                min={PRI_MIN}
                max={PRI_MAX}
                placeholder="priority"
                value={priText}
                onChange={(e) => setPriText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); setBulkMenu(null); }
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const t = priText.trim();
                  const pri = t === '' ? null : parsePri(t);
                  if (t !== '' && pri === null) return;
                  run(chosen.map(refOf), { kind: 'pri', pri });
                }}
              />
            ) : (
              <button type="button" data-act="pri" onClick={() => { setPriText(''); setBulkMenu('pri'); }}>set priority</button>
            )}
            <button type="button" data-act="study" onClick={() => study(new Set(chosen.map((r) => r.key)))}>study these</button>
            {bulkMenu === 'move' && (
              <div className="db-move sub-scroll">
                {targets.map((t) => (
                  <div key={t.path} className="ci" data-path={t.path} style={{ paddingLeft: 10 + t.depth * 12 }} onClick={() => run(chosen.map(refOf), { kind: 'move', to: t.path })}>
                    <span className="cg"><Glyph g={GLYPH[kindOf(t.path, docs)]} /></span>{titleIn(t.path)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {similar && <SimilarList paths={paths} q={q} now={now} />}
      {/* a new card is written in a sheet over the window, its two faces the session's two boxes (the user's ask) */}
      {!similar && editingNew && <div className="card-sheet" role="dialog" aria-label="new card"><div className="card-sheet-in">{newEditor(editingNew)}</div></div>}
      {!similar && rows.length === 0 && !editingNew && <div className="empty">no cards</div>}
      {!similar && rows.length > 0 && shown.length === 0 && <div className="empty">nothing matches</div>}
      {!similar && (
        <DeckRows handle={list} shown={shown} index={index} selSet={selSet} cursorKey={cursorKey} menuKey={menu?.key ?? null} multi={multi} now={now} hooks={plugins?.version} acts={acts} mem={mem} />
      )}

      {menu && menuRow && onPage(
        <div className="ctx-menu" ref={menuRef} style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          {!menu.sub ? (
            <>
              <div className="ci" onClick={() => { setMenu(null); editIn(menuRow); }}><span className="cg"><Glyph g="✎" /></span>edit<span className="ck">⏎</span></div>
              <div className="ci has-sub" onClick={(e) => { e.stopPropagation(); setMenu({ ...menu, sub: true }); }}><span className="cg"><Glyph g="→" /></span>move to…<span className="ck"><Glyph g="▸" /></span></div>
              <div className="ci" onClick={() => run([refOf(menuRow)], { kind: menuRow.suspended ? 'unsuspend' : 'suspend' })}><span className="cg"><Glyph g="‖" /></span>{menuRow.suspended ? 'unsuspend' : 'suspend'}</div>
              <div className="cd" />
              <div className="ci danger" onClick={() => { setMenu(null); removeOne(menuRow); }}><span className="cg"><Glyph g="⌫" /></span>delete card</div>
            </>
          ) : (
            <div className="sub-wrap">
              <div className="ci back" onClick={(e) => { e.stopPropagation(); setMenu({ ...menu, sub: false }); }}><span className="cg"><Glyph g="◂" /></span>move to…</div>
              <div className="cd" />
              <div className="sub-scroll">
                {targets.filter((t) => t.path !== menuRow.path).map((t) => (
                  <div key={t.path} className="ci" data-path={t.path} style={{ paddingLeft: 10 + t.depth * 12 }} onClick={() => run([refOf(menuRow)], { kind: 'move', to: t.path })}>
                    <span className="cg"><Glyph g={GLYPH[kindOf(t.path, docs)]} /></span>{titleIn(t.path)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
