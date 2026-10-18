// The reader: one document as one continuous surface. Prose is editable
// ProseMirror, cards and raw blocks sit in the flow as atoms, math renders
// as KaTeX chips, and the reading marker runs down the left margin. Every
// change goes through the vault as blocks; nothing here string-edits a file.

import katex from 'katex';
import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, Selection, type EditorState, type Transaction } from 'prosemirror-state';
import { EditorView, type NodeView } from 'prosemirror-view';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PRI_DEFAULT, cardFields, clozeSegments, meta, serialize, setField, type Blank, type Block, type Card, type Doc, type MathSeg } from '../format/index.js';
import {
  blockAt, blocksEqual, cardDue, cursorIndex, editMath, editorialRanges, fromDoc, insertCard, makeState, markerKey, markerPos,
  mathSplit, passage, pickPos, proseIndices, schema, setReadPos, type Band, type Passage,
} from '../reader/index.js';
import { advanceWrite, whenToDate } from '../schedule/index.js';
import { dirOf, nameOf, type Loaded, type Vault } from '../vault/index.js';
import { CueActions } from '../plugins/CueActions.js';
import { publishSelection as publishPluginSelection, runBlockHooks, toPluginSelection, usePlugins, wantsBlocks, type PluginSelection } from '../plugins/index.js';
import { Composer } from './Composer.js';
import { dueLabel } from './items.js';
import { titleOf } from './names.js';
import { useApp, type DocInfo } from './store.js';
import { currentVault, enrolReading, extractNode } from './vault.js';
import 'katex/dist/katex.min.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import './reader.css';

/** How long after the last keystroke the file is written. */
const WRITE_DELAY = 500;

// ── writing ──────────────────────────────────────────────────────

/**
 * Writes for one document, one at a time, a little after the last change.
 * Remembers the text each write will produce, so the vault's report of it
 * can be told from an external change.
 */
class Writer {
  private own = new Map<string, number>();
  private chain: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: (() => Block[]) | null = null;
  /** Bumped by the caller on every document change; each write records the value it saw. */
  version = 0;

  constructor(private readonly vault: Vault, private readonly path: string) {}

  /** The version a write of `text` saw, if `text` is ours; the entry is consumed. */
  claim(text: string): number | undefined {
    const v = this.own.get(text);
    if (v !== undefined) this.own.delete(text);
    return v;
  }

  update(mutate: (doc: Doc) => void): Promise<Loaded | null> {
    const version = this.version;
    const run = this.chain.then(async () => {
      const cur = await this.vault.read(this.path);
      const next = structuredClone(cur.doc);
      mutate(next);
      const text = serialize(next);
      if (text === cur.text) return null;
      this.own.set(text, version);
      return this.vault.update(this.path, mutate);
    });
    this.chain = run.catch((e: unknown) => console.error(this.path, e));
    return run;
  }

  /** Write the body `blocks()` gives, after a pause; the latest call wins. */
  schedule(blocks: () => Block[]): void {
    this.pending = blocks;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), WRITE_DELAY);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const pending = this.pending;
    this.pending = null;
    if (!pending) return;
    const blocks = pending();
    void this.update((doc) => { doc.blocks = blocks; });
  }

  /** Run `fn` once everything scheduled so far has been written. */
  run<T>(fn: () => Promise<T>): Promise<T> {
    this.flush();
    const run = this.chain.then(fn);
    this.chain = run.catch((e: unknown) => console.error(this.path, e));
    return run;
  }

  /** Drop what has not been written yet: the file changed under us and wins. */
  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}

// ── rendering pieces shared by node views ────────────────────────

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function mathHTML(raw: string): string {
  const display = raw.startsWith('$$');
  const tex = display ? raw.slice(2, -2) : raw.slice(1, -1);
  let inner: string;
  try {
    inner = katex.renderToString(tex, { throwOnError: false, displayMode: display });
  } catch {
    inner = escapeHtml(raw);
  }
  return `<span class="math${display ? ' display' : ''}" data-tex="${escapeHtml(raw)}">${inner}</span>`;
}

function markedHTML(text: string): string {
  let out = '';
  let last = 0;
  for (const r of editorialRanges(text)) {
    out += escapeHtml(text.slice(last, r.from));
    out += `<span class="ed-mark ${r.kind}">${escapeHtml(text.slice(r.from, r.to))}</span>`;
    last = r.to;
  }
  return out + escapeHtml(text.slice(last));
}

/** Text with math as chips and editorial marks lit, for the read-only parts. */
export function richHTML(text: string): string {
  return mathSplit(text).map((p) => (typeof p === 'string' ? markedHTML(p) : mathHTML(p.math))).join('');
}

// A formula holding blanks (FORMAT.md §5.1) is rendered by KaTeX once per
// state: a hidden blank is a box over a phantom of its answer, a revealed
// one its answer on the accent, another group's blank plain. KaTeX takes a
// colour, not a class, and `trust` stays off, so two sentinel colours go in
// and the theme's variables come out.

export type BlankState = 'hidden' | 'revealed' | 'plain';

const HIDE = '#010203';
const SHOW = '#040506';

/** An answer split at its top-level `&` and `\\`, the separators kept at the odd indices. */
function alignPieces(tex: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let j = 0; j < tex.length; j++) {
    const c = tex[j]!;
    if (c === '\\') {
      if (tex[j + 1] === '\\' && depth === 0) { out.push(cur, '\\\\'); cur = ''; j++; continue; }
      cur += c + (tex[j + 1] ?? '');
      j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (c === '&' && depth === 0) { out.push(cur, '&'); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** The answer boxed, piece by piece so an alignment mark stays outside the box. */
function boxed(answer: string, state: 'hidden' | 'revealed', display: boolean): string {
  return alignPieces(answer).map((p, i) => {
    if (i % 2 === 1 || !p.trim()) return p;
    const inner = state === 'hidden' ? `\\phantom{${p}}` : p;
    return `\\colorbox{${state === 'hidden' ? HIDE : SHOW}}{$${display ? '\\displaystyle ' : ''}${inner}$}`;
  }).join('');
}

/**
 * A formula holding blanks, rendered once with each blank in its state. The
 * chip says how many blanks are the card's own (`data-blanks`) and whether
 * they all show (`data-revealed`); its source is kept only while nothing is
 * hidden. TeX that KaTeX refuses falls back to the source as text, its
 * blanks as text blanks of `cls(state)`.
 */
export function mathBlanksHTML(seg: MathSeg, stateOf: (b: Blank) => BlankState, cls: (s: BlankState) => string): string {
  const states: BlankState[] = [];
  const tex = seg.parts.map((p) => {
    if (typeof p === 'string') return p;
    const s = stateOf(p);
    states.push(s);
    return s === 'plain' ? p.answer : boxed(p.answer, s, seg.display);
  }).join('');
  const own = states.filter((s) => s !== 'plain');
  const hidden = own.includes('hidden');
  const attrs = `class="math${seg.display ? ' display' : ''} blanks" data-blanks="${own.length}" data-revealed="${own.length && !hidden ? '1' : '0'}"${hidden ? '' : ` data-tex="${escapeHtml(seg.span)}"`}`;
  try {
    const html = katex.renderToString(tex, { throwOnError: true, displayMode: seg.display, output: 'html' });
    return `<span ${attrs}>${html.split(HIDE).join('var(--fg-5)').split(SHOW).join('var(--accent-soft)')}</span>`;
  } catch {
    let k = 0;
    const body = seg.parts.map((p) => (typeof p === 'string' ? escapeHtml(p) : `<span class="${cls(states[k++]!)}">${escapeHtml(p.answer)}</span>`)).join('');
    return `<span ${attrs}><code class="tex">${body}</code></span>`;
  }
}

/** A cloze card's text: blanks in text as spans of `cls(state)`, formulas holding blanks through KaTeX. */
export function clozeHTML(text: string, stateOf: (b: Blank, index: number) => BlankState, cls: (s: BlankState) => string): string {
  let index = -1;
  return clozeSegments(text).map((seg) => {
    if (typeof seg === 'string') return richHTML(seg);
    if ('span' in seg) return mathBlanksHTML(seg, (b) => stateOf(b, ++index), cls);
    return `<span class="${cls(stateOf(seg, ++index))}">${richHTML(seg.answer)}</span>`;
  }).join('');
}

/** A blank's answer on its own: TeX as math, an align line through `aligned`. */
export function answerHTML(b: Blank, display = false): string {
  if (!b.math) return richHTML(b.answer);
  const tex = /&|\\\\/.test(b.answer) ? `\\begin{aligned}${b.answer}\\end{aligned}` : b.answer;
  let inner: string;
  try {
    inner = katex.renderToString(`${display ? '\\displaystyle ' : ''}${tex}`, { throwOnError: false, output: 'html' });
  } catch {
    inner = escapeHtml(b.answer);
  }
  return `<span class="math">${inner}</span>`;
}

export function cardHTML(card: Card): string {
  const f = cardFields(card.text);
  if (!f) return richHTML(card.text);
  switch (f.form) {
    case 'cloze':
      return clozeHTML(card.text, () => 'revealed', () => 'cz');
    case 'qa':
      return `<span class="cs-q">${richHTML(f.front)}</span><span class="cs-a">${richHTML(f.back)}</span>`;
    case 'bidir':
      return `<span>${richHTML(f.left)} <span class="cs-arrow">⇄</span> ${richHTML(f.right)}</span>`;
  }
}

// ── node views ───────────────────────────────────────────────────

class CardView implements NodeView {
  dom: HTMLElement;

  constructor(node: PMNode) {
    this.dom = document.createElement('div');
    this.dom.setAttribute('contenteditable', 'false');
    this.render(node);
  }

  render(node: PMNode): void {
    const card = node.attrs.card as Card;
    const now = new Date();
    const due = cardDue(card);
    const isDue = due === undefined || whenToDate(due) <= now;
    this.dom.className = `card-span${isDue ? ' due' : ''}`;
    this.dom.innerHTML =
      `<div class="cs-body">${cardHTML(card)}</div>` +
      `<div class="cs-foot"><span class="cs-state" data-due="${isDue ? '1' : '0'}">${escapeHtml(dueLabel(due, now))}</span></div>`;
  }

  update(node: PMNode): boolean {
    if (node.type !== schema.nodes.card) return false;
    this.render(node);
    return true;
  }

  selectNode(): void { this.dom.classList.add('selected'); }
  deselectNode(): void { this.dom.classList.remove('selected'); }
  ignoreMutation(): boolean { return true; }
}

class MathView implements NodeView {
  dom: HTMLElement;

  constructor(node: PMNode) {
    const tmp = document.createElement('div');
    tmp.innerHTML = mathHTML(node.attrs.raw as string);
    this.dom = tmp.firstElementChild as HTMLElement;
    this.dom.setAttribute('contenteditable', 'false');
  }

  update(node: PMNode): boolean {
    if (node.type !== schema.nodes.math) return false;
    const tmp = document.createElement('div');
    tmp.innerHTML = mathHTML(node.attrs.raw as string);
    const next = tmp.firstElementChild as HTMLElement;
    this.dom.className = next.className;
    this.dom.dataset.tex = next.dataset.tex ?? '';
    this.dom.innerHTML = next.innerHTML;
    return true;
  }

  selectNode(): void { this.dom.classList.add('selected'); }
  deselectNode(): void { this.dom.classList.remove('selected'); }
  ignoreMutation(): boolean { return true; }
}

export const nodeViews = {
  card: (node: PMNode) => new CardView(node),
  math: (node: PMNode) => new MathView(node),
};

// ── the component ────────────────────────────────────────────────

interface Rule {
  top: number;
  height: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!el?.isContentEditable;
};

/** The selection, as a passage plus where it ends and where it sits on screen. */
interface Sel extends Passage {
  end: number;
  rect: DOMRect;
}

/** An open composer: what it starts with, the block its card goes after, and where it sits. */
interface Compose {
  seed: string;
  index: number | null;
  rect: DOMRect | null;
}

const sameSel = (a: Sel | null, b: Sel | null): boolean =>
  a === b || (!!a && !!b && a.text === b.text && a.end === b.end && a.rect.top === b.rect.top && a.rect.left === b.rect.left && a.rect.bottom === b.rect.bottom);

const words = (blocks: Block[]) =>
  blocks.reduce((n, b) => (b.kind === 'card' ? n : n + b.text.split(/\s+/).filter(Boolean).length), 0);

/** Where the document sits: its folders, and its parent when it is an extract. */
export function crumbOf(path: string, docs: Record<string, DocInfo>): string {
  const dir = dirOf(path);
  if (!dir) return '';
  const parts: string[] = [];
  let at = '';
  for (const seg of dir.split('/')) {
    at = at ? `${at}/${seg}` : seg;
    parts.push(docs[`${at}.md`] ? titleOf(`${at}.md`, docs, null) : nameOf(at));
  }
  return parts.join('  /  ');
}

/** Where the card at child `index` is, or the card with `id` when that one has moved; null when neither is there. */
function cardPos(doc: PMNode, at: { index: number; id?: string }): number | null {
  let byId: number | null = null;
  let off = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const here = off;
    off += node.nodeSize;
    if (node.type !== schema.nodes.card) continue;
    const id = (node.attrs.card as Card).id;
    if (i === at.index && (at.id === undefined || id === at.id)) return here;
    if (at.id !== undefined && id === at.id && byId === null) byId = here;
  }
  return byId;
}

/** Keep the caret where it was, as far as the new document allows. */
function withSelectionOf(prev: EditorState | null, state: EditorState): EditorState {
  if (!prev) return state;
  const head = Math.min(prev.selection.head, state.doc.content.size);
  return state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(head))));
}

interface ReaderProps {
  id: string;
  /** In the active pane: keys that need no selection (`r`) reach this document. */
  active?: boolean;
  /** Set when this is the text of a document with pages: the meta row offers the pages back. */
  onPages?: () => void;
}

export function Reader({ id, active = true, onPages }: ReaderProps) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const info = docs[id];
  const reveal = useApp((s) => s.reveal);
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone'>('loading');
  const [rule, setRule] = useState<Rule | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const writerRef = useRef<Writer | null>(null);
  const frozenRef = useRef(false);
  const dragRef = useRef(false);
  frozenRef.current = info?.frozen ?? false;
  const [sel, setSel] = useState<Sel | null>(null);
  const [composer, setComposer] = useState<Compose | null>(null);
  const selRef = useRef<Sel | null>(null);
  selRef.current = sel;
  const composerRef = useRef<Compose | null>(null);
  composerRef.current = composer;
  // extracts come out of sources and extracts; drafts only make cards
  const canExtract = info?.type === 'source' || info?.type === 'extract';
  const canExtractRef = useRef(false);
  canExtractRef.current = canExtract;
  const actRef = useRef<(key: string) => boolean>(() => false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const readingRef = useRef(false);
  readingRef.current = !!info?.read;

  /** The inspector edits the card node that is selected here. */
  const publishSelection = (state: EditorState) => {
    const sel = state.selection;
    const idx = sel instanceof NodeSelection && sel.node.type === schema.nodes.card ? state.doc.resolve(sel.from).index() : null;
    const cur = useApp.getState().selectedCard;
    if (idx === null ? cur !== null && cur.path === id : cur?.path !== id || cur.index !== idx) {
      useApp.setState({ selectedCard: idx === null ? null : { path: id, index: idx } });
    }
  };

  // ── the plugins' block hooks, after the surface is drawn ──
  const plugins = usePlugins();
  const hookFrame = useRef<number | null>(null);
  const hookBlocks = useCallback(() => {
    if (hookFrame.current !== null) return;
    hookFrame.current = requestAnimationFrame(() => {
      hookFrame.current = null;
      const view = viewRef.current;
      if (!view || !wantsBlocks()) return;
      // a hook's change to a block's DOM must not reach ProseMirror's observer,
      // which would mark the block dirty and draw it again without the change
      const observer = (view as unknown as { domObserver?: { stop(): void; start(): void } }).domObserver;
      observer?.stop();
      try {
        view.state.doc.forEach((_node, off, i) => {
          const el = view.nodeDOM(off) as HTMLElement | null;
          if (el) runBlockHooks(el, { path: id, block: i, where: 'reader' });
        });
      } finally {
        observer?.start();
      }
    });
  }, [id]);
  useEffect(() => { hookBlocks(); }, [plugins?.version, hookBlocks]);
  useEffect(() => () => {
    // StrictMode mounts twice: the frame is cancelled and the slot freed, so the next build schedules a new one
    if (hookFrame.current !== null) cancelAnimationFrame(hookFrame.current);
    hookFrame.current = null;
  }, []);

  // ── the marker's geometry, from the blocks' boxes ──
  const measure = useCallback(() => {
    const view = viewRef.current;
    const wrap = wrapRef.current;
    const pos = view ? markerPos(view.state) : null;
    if (!view || !wrap || pos === null) { setRule(null); return; }
    const doc = view.state.doc;
    const first = view.nodeDOM(0) as HTMLElement | null;
    if (!first) { setRule(null); return; }
    const idx = cursorIndex(proseIndices(doc), pos);
    const wr = wrap.getBoundingClientRect();
    const fr = first.getBoundingClientRect();
    if (idx < 0) { setRule({ top: fr.top - wr.top, height: 0 }); return; }
    let at = 0;
    for (let i = 0; i < idx; i++) at += doc.child(i).nodeSize;
    const boundary = view.nodeDOM(at) as HTMLElement | null;
    if (!boundary) { setRule(null); return; }
    const br = boundary.getBoundingClientRect();
    setRule({ top: fr.top - wr.top, height: Math.max(0, br.bottom - fr.top) });
  }, []);

  // ── the editor over the file, following the vault ──
  useEffect(() => {
    const vault = currentVault();
    const mount = mountRef.current;
    if (!vault || !mount) return;
    const writer = new Writer(vault, id);
    writerRef.current = writer;
    let live = true;

    const build = (loaded: Loaded) => {
      const state = makeState(loaded.doc.blocks, { frozen: () => frozenRef.current, pos: meta(loaded.doc).read?.pos ?? null });
      const view = viewRef.current;
      if (view) view.updateState(withSelectionOf(view.state, state));
      else {
        viewRef.current = new EditorView(mount, {
          state,
          nodeViews,
          editable: () => !frozenRef.current,
          attributes: { class: 'draft-doc', spellcheck: 'true' },
          dispatchTransaction(this: EditorView, tr: Transaction) {
            const next = this.state.apply(tr);
            this.updateState(next);
            if (tr.docChanged) {
              writer.version++;
              writer.schedule(() => fromDoc(this.state.doc));
            }
            if (tr.docChanged || tr.getMeta(markerKey) !== undefined) measure();
            if (tr.docChanged) hookBlocks();
            if (tr.selectionSet || tr.docChanged) publishSelection(next);
          },
          handleClickOn(view, _pos, node, nodePos, _event, direct) {
            if (!direct) return false;
            if (node.type === schema.nodes.card) {
              // a card selects on any document, frozen too, so the inspector can edit it
              view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)));
              return true;
            }
            if (node.type !== schema.nodes.math || !view.editable) return false;
            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)));
            editMath(view.state, view.dispatch);
            view.focus();
            return true;
          },
          handleKeyDown(view, event) {
            if (event.key === 'Escape') {
              view.dom.blur();
              return true;
            }
            if (!event.metaKey && !event.ctrlKey && !event.altKey && actRef.current(event.key)) {
              event.preventDefault();
              return true;
            }
            return false;
          },
          handleDOMEvents: {
            blur: () => { writer.flush(); return false; },
          },
        });
      }
      setBlocks(loaded.doc.blocks);
      measure();
      hookBlocks();
      if (viewRef.current) publishSelection(viewRef.current.state);
    };

    const onDoc = (loaded: Loaded) => {
      const view = viewRef.current;
      if (!view) { build(loaded); return; }
      const version = writer.claim(loaded.text);
      if (version === undefined) {
        // someone else changed the file: it wins over anything unwritten
        writer.cancel();
        build(loaded);
        return;
      }
      // our own write, read back. If nothing was typed since and the file
      // says something other than what the editor holds (a line that became
      // a card, a heading), the file is right.
      if (version === writer.version && !blocksEqual(fromDoc(view.state.doc), loaded.doc.blocks)) build(loaded);
      else setBlocks(loaded.doc.blocks);
    };

    vault.read(id).then(
      (loaded) => { if (live) { build(loaded); setStatus('ok'); } },
      () => { if (live) setStatus('gone'); },
    );
    const off = vault.subscribe((ev) => {
      if (!live) return;
      if (ev.kind === 'doc' && ev.path === id) onDoc(ev.loaded);
      else if (ev.kind === 'gone' && ev.path === id) {
        writer.cancel();
        viewRef.current?.destroy();
        viewRef.current = null;
        setStatus('gone');
      }
    });
    return () => {
      live = false;
      off();
      writer.flush();
      viewRef.current?.destroy();
      viewRef.current = null;
      writerRef.current = null;
      if (useApp.getState().selectedCard?.path === id) useApp.setState({ selectedCard: null });
    };
  }, [id, measure, hookBlocks]);

  // frozen or thawed: the view re-reads `editable`
  useEffect(() => {
    viewRef.current?.setProps({ editable: () => !frozenRef.current });
  }, [info?.frozen]);

  // a card opened from the palette or a query: once the document is built,
  // its node is selected (the inspector follows) and scrolled to; a card
  // that is gone is let go
  useEffect(() => {
    const view = viewRef.current;
    if (!reveal || reveal.path !== id || status !== 'ok' || !view) return;
    const pos = cardPos(view.state.doc, reveal);
    if (pos !== null) {
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
      (view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ block: 'center' });
    }
    useApp.setState({ reveal: null });
  }, [reveal, status, id]);

  // ── the selection: a passage to extract or make a card from ──
  // Read from the DOM, not the editor state, because a frozen document's
  // surface is not editable and never focused, yet its text still selects.
  useEffect(() => {
    const capture = () => {
      const view = viewRef.current;
      if (!view || composerRef.current) return;
      let next: Sel | null = null;
      const s = window.getSelection();
      if (s && s.rangeCount > 0 && !s.isCollapsed) {
        const range = s.getRangeAt(0);
        if (view.dom.contains(range.commonAncestorContainer)) {
          try {
            const a = view.posAtDOM(range.startContainer, range.startOffset);
            const b = view.posAtDOM(range.endContainer, range.endOffset);
            const p = passage(view.state.doc, Math.min(a, b), Math.max(a, b));
            if (p.text) next = { ...p, end: Math.max(a, b), rect: range.getBoundingClientRect() };
          } catch { /* not in the document */ }
        }
      }
      setSel((cur) => (sameSel(cur, next) ? cur : next));
    };
    document.addEventListener('selectionchange', capture);
    return () => document.removeEventListener('selectionchange', capture);
  }, []);

  // the selection as plugins see it: the block it ends in gives the sentence around it
  const plugSel = useMemo((): PluginSelection | null => {
    const view = viewRef.current;
    if (!sel || !view || composer) return null;
    const block = blockAt(view.state.doc, sel.end);
    const node = view.state.doc.maybeChild(block);
    return toPluginSelection({ path: id, text: sel.text, rect: sel.rect, block, blockText: node?.textContent ?? '' });
  }, [sel, composer, id]);
  useEffect(() => {
    publishPluginSelection(plugSel);
    return () => publishPluginSelection(null);
  }, [plugSel]);

  const openComposer = () => {
    const view = viewRef.current;
    const s = selRef.current;
    if (!view || !s) return;
    setComposer({ seed: s.text, index: blockAt(view.state.doc, s.end), rect: s.rect });
    setSel(null);
  };

  const doExtract = () => {
    const s = selRef.current;
    const writer = writerRef.current;
    if (!s || !writer || !canExtractRef.current) return;
    setSel(null);
    window.getSelection()?.removeAllRanges();
    writer.run(() => extractNode(id, { text: s.text, blocks: s.blocks })).catch(console.error);
  };

  const startReading = () => { if (canExtractRef.current && !readingRef.current) enrolReading(id).catch(console.error); };

  actRef.current = (key) => {
    if (composerRef.current) return false;
    if (key === 'r' && activeRef.current && canExtractRef.current && !readingRef.current) { startReading(); return true; }
    if (!selRef.current) return false;
    if (key === 'e' && canExtractRef.current) { doExtract(); return true; }
    if (key === 'm') { openComposer(); return true; }
    return false;
  };

  // `e` and `m` when the surface is not focused (a frozen document)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inField(e.target)) return;
      if (actRef.current(e.key)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const saveCard = (text: string, again: boolean, pri?: number) => {
    const view = viewRef.current;
    const c = composerRef.current;
    const writer = writerRef.current;
    if (!view || !c || !writer) return;
    const card: Card = { kind: 'card', text };
    if (pri !== undefined) card.sched = { pri };
    view.dispatch(insertCard(view.state, card, c.index));
    writer.flush();
    setComposer(again ? { ...c, index: c.index === null ? null : c.index + 1 } : null);
  };

  // the marker follows the text as it reflows
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [measure]);

  // ── the gutter: click or drag to set how far you have read ──
  const setFromY = (clientY: number) => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc;
    const bands: Band[] = [];
    let at = 0;
    doc.forEach((node) => {
      const el = view.nodeDOM(at) as HTMLElement | null;
      at += node.nodeSize;
      if (node.type.name === 'card' || !el) return;
      const r = el.getBoundingClientRect();
      bands.push({ top: r.top, height: r.height });
    });
    const pos = pickPos(bands, clientY);
    if (pos !== markerPos(view.state)) view.dispatch(view.state.tr.setMeta(markerKey, pos));
  };
  const gutterDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromY(e.clientY);
  };
  const gutterMove = (e: React.PointerEvent<HTMLDivElement>) => { if (dragRef.current) setFromY(e.clientY); };
  const gutterUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    const view = viewRef.current;
    const pos = view ? markerPos(view.state) : null;
    if (pos !== null) void writerRef.current?.update((doc) => setReadPos(doc, pos));
  };

  const toggleFrozen = () => {
    const next = !frozenRef.current;
    void writerRef.current?.update((doc) => setField(doc, 'frozen', next));
  };

  // a draft's row: where it is in spaced composition, and done / reopen
  const w = info?.type === 'draft' ? info.write : undefined;
  const writeState = w
    ? w.done ? 'done' : `${w.reps ? `pass ${w.reps + 1}` : 'first pass'}, ${dueLabel(w.due, new Date())}`
    : '';
  const toggleDone = () => {
    if (!w) return;
    const action = w.done ? 'on' : 'done';
    void writerRef.current?.update((doc) => { advanceWrite(doc, action, new Date()); });
  };

  if (status === 'gone' || (status === 'ok' && !info)) {
    return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the vault</div></div></div>;
  }

  const reading = !!info?.read;
  const cards = info?.cards ?? 0;
  const due = info?.due ?? 0;
  const counts = cards ? `${plural(cards, 'card')}${due ? `, ${due} due` : ''}` : '';
  const right = info?.type === 'draft' ? [plural(words(blocks), 'word'), counts].filter(Boolean).join(', ') : counts;

  return (
    <div className="reader-wrap">
      <div className={`reader doc-view${reading ? ' reading' : ''}`}>
        <div className="meta">
          <span className="crumb">{crumbOf(id, docs)}</span>
          {onPages && <button type="button" className="frozen-tag" onClick={onPages}>pages</button>}
          {info && info.type !== 'draft' && (
            <button type="button" className="frozen-tag" data-frozen={info.frozen ? '1' : '0'} onClick={toggleFrozen}>
              {info.frozen ? 'frozen' : 'editable'}
            </button>
          )}
          {info && canExtract && !reading && (
            <button type="button" className="frozen-tag enrol" onClick={startReading}>start reading <span className="kbd">r</span></button>
          )}
          <span className="right">{right}</span>
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        {w && (
          <div className="draft-sched" data-done={w.done ? '1' : '0'}>
            <span className="ds-state">{writeState}</span>
            <button type="button" className="ds-toggle" onClick={toggleDone}>{w.done ? 'reopen' : 'done'}</button>
          </div>
        )}
        <div className={`doc-wrap${reading ? ' reading' : ''}`} ref={wrapRef}>
          {reading && <div className="read-gutter" onPointerDown={gutterDown} onPointerMove={gutterMove} onPointerUp={gutterUp} />}
          {reading && rule && (
            <>
              <div className="read-rule" style={{ top: rule.top, height: rule.height }} />
              <div className="read-edge" style={{ top: rule.top + rule.height }}><span className="read-knob" /></div>
            </>
          )}
          <div className="doc-mount" ref={mountRef} />
          {sel && !composer && (
            <div className="sel-cue" style={{ top: sel.rect.bottom + 8, left: sel.rect.left }}>
              {canExtract && (
                <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); doExtract(); }}>
                  extract <span className="kbd">e</span>
                </button>
              )}
              <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); openComposer(); }}>
                make a card <span className="kbd">m</span>
              </button>
              {plugSel && <CueActions sel={plugSel} onRun={() => setSel(null)} />}
            </div>
          )}
          {composer && (
            <div
              className="card-pop"
              style={composer.rect ? { top: Math.min(composer.rect.bottom + 8, window.innerHeight - 280), left: Math.min(composer.rect.left, window.innerWidth - 440) } : undefined}
            >
              <Composer seed={composer.seed} pri={info?.pri ?? PRI_DEFAULT} onSave={saveCard} onClose={() => setComposer(null)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
