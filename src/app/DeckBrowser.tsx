// The deck lens: a browser over every card under a deck, a folder, or a
// document with children (each row its form, its faces, its due and
// interval, and its file's path when there is more than one file), with a
// search, chips, a sort, a selection with bulk actions, a card edited in
// place in the session's two-face look, and `study`. The model is deck.ts,
// cardEdit.ts, and study.ts; the writes are deckOps.ts.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { PRI_DEFAULT, PRI_MAX, PRI_MIN, cardFields, meta, parsePri, type Card, type CardForm } from '../format/index.js';
import { makeState, textOf, type Dir } from '../reader/index.js';
import { whenToDate } from '../schedule/index.js';
import { runBlockHooks, usePlugins } from '../plugins/index.js';
import { revealIndex } from './chrome.js';
import { asks, facesOf, facesText, planEdit, switchForm, type Faces } from './cardEdit.js';
import {
  DEFAULT_VIEW, FORM_CHIPS, NO_SELECTION, SORTS, STATE_CHIPS, clickSelect, countLabel, deckRows, docTargets, docsUnder, filterRows, fold,
  findCard, selectAll, selectedRows, sortRows, type BulkAction, type CardRef, type DeckRow, type DeckSort, type DeckView, type Selection, type StateChip,
} from './deck.js';
import { bulkCards, newCardAt, saveCardEdit, studyDeck } from './deckOps.js';
import { FORM_LABEL, dueWhen, fmtDays, pathLabel, dueTone } from './items.js';
import { MENU_W, placeMenu } from './NodeMenu.js';
import { GLYPH, kindOf, titleOf } from './names.js';
import { blankAnswers, clozeHTML, faceDir, handleClickOn, nodeViews, richHTML } from './Reader.js';
import { useApp } from './store.js';
import { docsOf, openCard, removeCard, setDeckView } from './vault.js';
import { canLink, cardFaces, type SameCard } from './same.js';
import { currentPairs, linkCards, mergeCards, notTheSame } from './sameOps.js';
import './session.css';
import './deck.css';
import { appNow } from './clock.js';
import { Glyph, Plus } from './icons.js';

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const refOf = (r: DeckRow): CardRef => (r.id === undefined ? { path: r.path, block: r.block, text: r.text } : { path: r.path, block: r.block, id: r.id, text: r.text });

/** Rows drawn at first, and added per timer tick after. */
const ROW_CHUNK = 200;

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

// ── one face, live ───────────────────────────────────────────────

/** Every textblock's text, a line each: what a face field holds. */
function fieldText(doc: PMNode): string {
  const lines: string[] = [];
  doc.descendants((n) => {
    if (n.isTextblock) { lines.push(textOf(n)); return false; }
    return true;
  });
  return lines.join('\n').replace(/\n{2,}/g, '\n');
}

interface FaceProps {
  value: string;
  placeholder: string;
  autoFocus?: boolean;
  /** ⌘B makes a blank of the selection (a cloze's face). */
  blanks?: boolean;
  onChange(text: string): void;
}

/** A face as the reader edits text: inline Markdown and math chips (26's rules), one paragraph. */
function FaceField({ value, placeholder, autoFocus, blanks, onChange }: FaceProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const v = new EditorView(mount, {
      state: makeState([{ kind: 'paragraph', text: value }], { frozen: () => false, pos: null }),
      nodeViews,
      handleClickOn,
      attributes: { class: 'draft-doc face-field', 'data-placeholder': placeholder },
      dispatchTransaction(tr) {
        const next = v.state.apply(tr);
        v.updateState(next);
        if (tr.docChanged) change.current(fieldText(next.doc));
      },
    });
    view.current = v;
    if (autoFocus) v.focus();
    return () => { v.destroy(); view.current = null; };
  // the field is remounted (by key) when the form switch rewrites it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const v = view.current;
    if (!blanks || !v || !(e.metaKey || e.ctrlKey) || (e.key !== 'b' && e.key !== 'B')) return;
    e.preventDefault();
    const { from, to } = v.state.selection;
    v.dispatch(v.state.tr.insertText('}}', to).insertText('{{', from));
  };
  return <div className="face-host" ref={host} onKeyDown={onKeyDown} />;
}

// ── the editor ───────────────────────────────────────────────────

const FORMS: [CardForm, string][] = [['qa', 'q&a'], ['bidir', 'both ways'], ['cloze', 'cloze']];

interface EditorProps {
  /** The card as it is in the file; absent for a new one. */
  card?: Card;
  initial: Faces;
  /** The card's own priority, else the document's. */
  pri: number;
  onSave(text: string, pri: number | null, again: boolean): void;
  onCancel(): void;
}

/**
 * A card open in the list: the two faces live, the form switch, the
 * priority. ⌘⏎ or a click outside saves, ⇧⌘⏎ saves and opens a new card
 * after it, Escape cancels. A save that would drop a reviewed blank's
 * schedule asks first.
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

  // a press outside saves, unless the editor is asking; an edit the format would not read as a card is let go
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if (asking !== null) return;
      if (facesText(faces) === null) onCancel();
      else saveRef.current(false);
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
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (asking !== null) setAsking(null); else onCancel(); }
    else if (e.key === 'Enter' && mod) { e.preventDefault(); e.stopPropagation(); save(e.shiftKey, asking !== null); }
    else if (mod && (e.key === '1' || e.key === '2' || e.key === '3')) { e.preventDefault(); to(FORMS[Number(e.key) - 1]![0]); }
  };
  const two = faces.form !== 'cloze';
  return (
    <div className="composer deck-edit" ref={ref} onKeyDown={onKeyDown} data-form={faces.form}>
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
        <div className="face front">
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
          <div className="face back">
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
            <span className="act" onClick={() => save(false, true)}><kbd>⌘↵</kbd> save anyway</span>
            <span>·</span>
            <span className="act" onClick={() => setAsking(null)}><kbd>esc</kbd> back</span>
          </>
        ) : (
          <>
            <span className="act" data-able={text ? '1' : '0'} onClick={() => save(false)}><kbd>⌘↵</kbd> save</span>
            <span>·</span>
            <span className="act" onClick={onCancel}><kbd>esc</kbd> cancel</span>
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
  const fail = (e: unknown) => console.error(e);
  if (!pairs.length) return <div className="empty">nothing alike</div>;
  return (
    <div className="same-list">
      {pairs.slice(0, limit).map((p) => {
        const [ca, cb] = [cardOf(p.a), cardOf(p.b)];
        return (
          <div key={`${p.a.key}|${p.b.key}`} className="same-pair" data-a={p.a.key} data-b={p.b.key} data-score={p.score.toFixed(3)}>
            <div className="sp-sides">
              <SameSide c={p.a} card={ca} now={now} onKeep={() => { mergeCards(p.a, p.b).catch(fail); }} />
              <SameSide c={p.b} card={cb} now={now} onKeep={() => { mergeCards(p.b, p.a).catch(fail); }} />
            </div>
            <div className="sp-acts">
              {ca && cb && canLink(ca, cb) && <button type="button" data-act="link" title="one schedule for both, one of them a day" onClick={() => { linkCards(p.a, p.b).catch(fail); }}>link</button>}
              <button type="button" data-act="not-same" onClick={() => { notTheSame(p.a, p.b).catch(fail); }}>not the same</button>
            </div>
          </div>
        );
      })}
      {pairs.length > limit && <button type="button" className="same-more" onClick={() => setLimit((l) => l + 60)}>{pairs.length - limit} more</button>}
    </div>
  );
}

// ── the browser ──────────────────────────────────────────────────

/** A right-click on a row: where, and whether the move list shows. */
interface RowMenu { x: number; y: number; key: string; sub: boolean }

type Editing = { key: string } | { after: CardRef | null; path: string } | null;

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
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Selection>(NO_SELECTION);
  const [editing, setEditing] = useState<Editing>(null);
  const [cram, setCram] = useState(false);
  const [similar, setSimilar] = useState(false);
  const [menu, setMenu] = useState<RowMenu | null>(null);
  const [bulkMenu, setBulkMenu] = useState<'move' | 'pri' | 'reset' | null>(null);
  const [priText, setPriText] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  const menuRef = useRef<HTMLDivElement>(null);
  const byKey = useRef(false);

  const paths = useMemo(() => docsUnder(tree, home, order, files), [tree, home, order, files]);
  // `docs` changes with every write the vault reports: the bodies are read again then
  const bodies = useMemo(() => docsOf(paths), [paths, docs]);
  const now = useMemo(() => appNow(), [bodies]);
  const rows = useMemo(() => deckRows(bodies, now), [bodies, now]);
  const shown = useMemo(() => sortRows(filterRows(rows, q, view), view.sort), [rows, q, view]);
  const keys = useMemo(() => shown.map((r) => r.key), [shown]);
  // rows drawn in chunks on timers (never frames: a covered window holds them back), so a lens over
  // the whole collection opens at once and fills in; the cursor's row is always among those drawn
  const [limit, setLimit] = useState(ROW_CHUNK);
  useEffect(() => { setLimit(ROW_CHUNK); }, [home, q, view]);
  useEffect(() => {
    if (limit >= shown.length) return;
    const t = setTimeout(() => setLimit((l) => l + ROW_CHUNK), 0);
    return () => clearTimeout(t);
  }, [limit, shown.length]);
  const multi = paths.length > 1;
  const chosen = selectedRows(sel, shown);
  const cursorKey = cursor && paths.includes(cursor.path) ? `${cursor.path}#${cursor.index}` : null;
  const drawnTo = Math.max(limit, cursorKey === null ? 0 : keys.indexOf(cursorKey) + 1);
  // a revealed row not drawn yet when it was selected: scrolled to once it is
  const pendingReveal = useRef<string | null>(null);
  useLayoutEffect(() => {
    const k = pendingReveal.current;
    const el = k === null ? undefined : rowEls.current.get(k);
    if (el) { pendingReveal.current = null; el.scrollIntoView({ block: 'center' }); }
  });
  const homeDoc = home.endsWith('.md') ? home : files.includes(`${home}.md`) ? `${home}.md` : null;

  const setView = (patch: Partial<DeckView>) => setDeckView(home, { ...view, ...patch });
  const toggle = <T,>(list: T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const point = (r: DeckRow | undefined) => useApp.setState({ selectedCard: r ? { path: r.path, index: r.block } : null });

  // the rows, drawn: every plugin's block hook sees each
  useEffect(() => {
    for (const r of shown) {
      const el = rowEls.current.get(r.key);
      if (el) runBlockHooks(el, { path: r.path, block: r.block, where: 'deck' });
    }
  }, [shown, plugins?.version]);

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
    rowEls.current.get(cursorKey)?.scrollIntoView({ block: 'nearest' });
  }, [cursorKey]);

  // a card opened from the palette or a query lands selected, in view
  useEffect(() => {
    if (!reveal || !paths.includes(reveal.path)) return;
    const body = bodies.find(([p]) => p === reveal.path);
    if (!body) return;
    const i = revealIndex(body[1].blocks, reveal);
    if (i >= 0) {
      const key = `${reveal.path}#${i}`;
      useApp.setState({ selectedCard: { path: reveal.path, index: i } });
      setSel({ keys: [key], anchor: key });
      const el = rowEls.current.get(key);
      if (el) el.scrollIntoView({ block: 'center' });
      else pendingReveal.current = key;
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

  const fail = (e: unknown) => console.error(e);
  const run = (refs: CardRef[], action: BulkAction) => {
    setBulkMenu(null);
    setMenu(null);
    setSel(NO_SELECTION);
    bulkCards(refs, action).catch(fail);
  };
  const removeOne = (r: DeckRow) => {
    setSel((s) => ({ ...s, keys: s.keys.filter((k) => k !== r.key) }));
    removeCard(r.path, r.block, r.id, r.text).catch(fail);
  };

  /** Where `m` puts a new card: after the cursor's row in its file, else at the end of the lens's own document (or its first). */
  const newCard = () => {
    const at = shown.find((r) => r.key === cursorKey);
    if (at) setEditing({ after: refOf(at), path: at.path });
    else if (homeDoc ?? paths[0]) setEditing({ after: null, path: (homeDoc ?? paths[0])! });
  };

  const study = (only?: ReadonlySet<string>) => {
    studyDeck(home, { cram, ...(only ? { only } : {}) });
  };

  // keys while no field has focus: / search, j k move, ⏎ edit, m new, ⌫ delete, ⌘A all, escape lets go
  useEffect(() => {
    if (!active || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || inField(e.target) || useApp.getState().paletteOpen) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); setSel(selectAll(keys)); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const at = cursorKey === null ? -1 : keys.indexOf(cursorKey);
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
      else if (e.key === 'Enter' && at >= 0) { e.preventDefault(); setEditing({ key: shown[at]!.key }); }
      else if (e.key === 'm') { e.preventDefault(); newCard(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (chosen.length > 1) { e.preventDefault(); run(chosen.map(refOf), { kind: 'delete' }); }
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

  const docPri = (path: string) => docs[path]?.pri ?? PRI_DEFAULT;
  const titleIn = (p: string) => titleOf(p, docs, root);

  const editorFor = (r: DeckRow) => {
    const body = bodies.find(([p]) => p === r.path)?.[1];
    const card = body ? findCard(body, refOf(r)) : null;
    const faces = facesOf(r.text);
    if (!card || !faces) return null;
    return (
      <CardEditor
        key={`e:${r.key}`}
        card={card}
        initial={faces}
        pri={card.sched?.pri ?? docPri(r.path)}
        onCancel={() => setEditing(null)}
        onSave={(text, pri, again) => {
          const changed = text !== card.text || (pri ?? docPri(r.path)) !== (card.sched?.pri ?? docPri(r.path));
          setEditing(again ? { after: { ...refOf(r), text }, path: r.path } : null);
          if (changed) saveCardEdit(refOf(r), text, pri).catch(fail);
        }}
      />
    );
  };

  const newEditor = (e: { after: CardRef | null; path: string }) => {
    const body = bodies.find(([p]) => p === e.path)?.[1];
    const form = (body && meta(body).defaultCard) || 'qa';
    return (
      <CardEditor
        key={`n:${e.path}:${e.after?.block ?? 'end'}:${e.after?.text ?? ''}`}
        initial={{ form, front: '', back: '' }}
        pri={docPri(e.path)}
        onCancel={() => setEditing(null)}
        onSave={(text, pri, again) => {
          newCardAt(e.path, e.after, text, pri).then((block) => {
            useApp.setState({ selectedCard: { path: e.path, index: block } });
            setEditing(again ? { after: { path: e.path, block, text }, path: e.path } : null);
          }).catch(fail);
          if (!again) setEditing(null);
        }}
      />
    );
  };

  const editingNew = editing && 'after' in editing ? editing : null;
  const editingKey = editing && 'key' in editing ? editing.key : null;
  // the new card's editor sits under the row it goes after, else above the list
  const newAfterKey = editingNew?.after ? `${editingNew.after.path}#${editingNew.after.block}` : null;
  const allSuspended = chosen.length > 0 && chosen.every((r) => r.suspended);
  const anySuspended = chosen.some((r) => r.suspended);
  const due = rows.filter((r) => r.isDue).length;
  const menuRow = menu ? rows.find((r) => r.key === menu.key) : undefined;
  const targets = bulkMenu === 'move' || menu?.sub ? docTargets(tree, order) : [];

  return (
    <div className="deck-browser">
      <div className="deck-study">
        <button type="button" className="ds-study" data-able={rows.length ? '1' : '0'} onClick={() => study()}>
          study <span className="ds-n">{cram ? rows.filter((r) => !r.suspended).length : due}</span>
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
        {chosen.length > 0 && (
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
      {!similar && editingNew && newAfterKey === null && newEditor(editingNew)}
      {!similar && rows.length === 0 && !editingNew && <div className="empty">no cards</div>}
      {!similar && rows.length > 0 && shown.length === 0 && <div className="empty">nothing matches</div>}
      {!similar && shown.slice(0, drawnTo).map((r) => {
        if (editingKey === r.key) return <div key={r.key}>{editorFor(r)}</div>;
        const f = facesHTML(r.text);
        const ivl = r.sched?.ivl && r.sched.ivl >= 1 ? fmtDays(r.sched.ivl) : '';
        const when = r.suspended ? 'suspended' : dueWhen(r.sched?.due, now);
        const isSel = sel.keys.includes(r.key);
        return (
          <div key={r.key}>
            <div
              ref={(el) => { if (el) rowEls.current.set(r.key, el); else rowEls.current.delete(r.key); }}
              className={`card-span deck-row${isSel ? ' selected' : ''}${cursorKey === r.key ? ' cursor' : ''}`}
              data-key={r.key}
              data-path={r.path}
              data-block={r.block}
              data-form={r.form}
              data-suspended={r.suspended ? '1' : '0'}
              data-menu={menu?.key === r.key ? '1' : '0'}
              onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
              onClick={(e) => onRowClick(r, e)}
              onDoubleClick={() => setEditing({ key: r.key })}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!sel.keys.includes(r.key)) setSel({ keys: [r.key], anchor: r.key });
                point(r);
                setMenu({ x: Math.min(e.clientX, window.innerWidth - MENU_W), y: e.clientY, key: r.key, sub: false });
              }}
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
              <button type="button" className="cs-del" title="delete card" aria-label="delete card" onClick={(e) => { e.stopPropagation(); removeOne(r); }}><Glyph g="×" /></button>
            </div>
            {editingNew && newAfterKey === r.key && newEditor(editingNew)}
          </div>
        );
      })}
      {!similar && editingNew && newAfterKey !== null && !keys.includes(newAfterKey) && newEditor(editingNew)}

      {menu && menuRow && (
        <div className="ctx-menu" ref={menuRef} style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          {!menu.sub ? (
            <>
              <div className="ci" onClick={() => { setMenu(null); setEditing({ key: menuRow.key }); }}><span className="cg"><Glyph g="✎" /></span>edit<span className="ck">⏎</span></div>
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
