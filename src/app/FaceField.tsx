// One face of a card, live: the reader's editor over the face's text (inline
// Markdown, math chips, 26's rules), shared by the deck's inline editor and
// the card view's two boxes. A face's pipe lines (FORMAT.md §5, tables in a
// face) are a table edited as the reader edits one: its cells, its `···`, a
// right-click's menu. The face is written back line for line: its prose as
// typed, an untouched table as it was read, a changed one as the normalized
// pipe table. A cloze's face holds no table: its text stays one paragraph.

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import type { Block } from '../format/index.js';
import { blankAround, groupsHere, makeBlank, makeState, nodeToRaw, removeBlank, schema, textOf } from '../reader/index.js';
import { createPortal } from 'react-dom';
import { hapticTick } from './haptics.js';
import { useApp } from './store.js';
import type { Command, EditorState } from 'prosemirror-state';
import { caretToPress, editorMenu, handleClickOn, nodeViews } from './Reader.js';

const pipe = (line: string): boolean => /^ {0,3}\|/.test(line);

/** A face's text as the editor's blocks: each run of pipe lines a table (with `tables`), each run of other lines one paragraph. */
export function faceFieldBlocks(text: string, tables = true): Block[] {
  if (!tables || !text.split('\n').some(pipe)) return [{ kind: 'paragraph', text }];
  const out: Block[] = [];
  let cur: string[] = [];
  let inTable = false;
  const flush = () => {
    if (!cur.length) return;
    out.push(inTable ? { kind: 'raw', text: cur.join('\n') } : { kind: 'paragraph', text: cur.join('\n') });
    cur = [];
  };
  for (const line of text.split('\n')) {
    const t = pipe(line);
    if (t !== inTable) flush();
    inTable = t;
    cur.push(line);
  }
  flush();
  return out;
}

/** What a face field holds: every textblock's text a line, a table as its pipe lines, empty lines run together. */
export function faceFieldText(doc: PMNode): string {
  const lines: string[] = [];
  const visit = (n: PMNode) => {
    if (n.type === schema.nodes.table) { lines.push(nodeToRaw(n)); return; }
    if (n.type === schema.nodes.raw) { lines.push(n.attrs.text as string); return; }
    if (n.isTextblock) { lines.push(textOf(n)); return; }
    n.forEach(visit);
  };
  doc.forEach(visit);
  return lines.join('\n').replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '');
}

/** What a cloze's row of buttons offers for the selection as it is: a blank of its own, the groups it can join or grow, and taking the blank at the caret away. */
export interface BlankChoices { blank: boolean; withGroups: number[]; remove: boolean }
export function blankChoices(state: EditorState): BlankChoices {
  return {
    blank: makeBlank()(state),
    withGroups: groupsHere(state).slice(0, 9).filter((g) => makeBlank(g)(state)),
    remove: blankAround(state) !== null,
  };
}

/**
 * A cloze's blanks under a finger: a row of plain buttons that belongs to the field while it has the caret. A long
 * press in text being typed brings the system's own bubble, never the editor's menu, so on an iPad and a phone the
 * menu's `blank`, `blank · with N` and `remove blank` had no way to be reached. `with N` puts the selection in the
 * group N, and grows a blank of that group it touches (`makeBlank`): the word that was missed. A press on a button
 * leaves the caret and the selection where they are. The row sits on the keyboard (the foot of what is left of the
 * glass), or in place where its host draws it (`inline`: a phone's new card, whose own buttons are on the keyboard).
 */
export function BlankRow({ view, inline }: { view: EditorView; inline?: boolean; /** Changes with the selection: the row is drawn again for it. */ tick?: number }) {
  const c = blankChoices(view.state);
  const run = (cmd: Command) => () => { if (cmd(view.state, view.dispatch.bind(view))) hapticTick(); view.focus(); };
  const keep = (e: { preventDefault(): void }) => e.preventDefault();
  const row = (
    <div className="blank-row" data-inline={inline ? '1' : undefined} role="toolbar" aria-label="blanks" onMouseDown={keep} onTouchStart={keep} onPointerDown={keep}>
      <button type="button" data-act="blank" disabled={!c.blank} onClick={run(makeBlank())}>blank</button>
      {c.withGroups.map((g) => <button key={g} type="button" data-act={`blank-${g}`} onClick={run(makeBlank(g))}>with {g}</button>)}
      {c.remove && <button type="button" data-act="unblank" onClick={run(removeBlank)}>remove blank</button>}
    </div>
  );
  return inline ? row : createPortal(row, document.body);
}

/** Each face's editor by its `.face-host`: for a test or a smoke to type into. */
export const faceViews = new WeakMap<Element, EditorView>();

/**
 * A press on a face's box anywhere off its text (its padding, the room under
 * or beside its lines) types there: the caret as near the press as the text
 * allows (`caretToPress`). A press on the text is the editor's own.
 */
export function pressIntoFace(e: ReactMouseEvent<HTMLElement>): void {
  if (e.button !== 0) return;
  const t = e.target as HTMLElement;
  if (t.closest('.ProseMirror, button, input, select, textarea, a')) return;
  const host = e.currentTarget.querySelector('.face-host');
  const v = host ? faceViews.get(host) : undefined;
  if (v && caretToPress(v, e.clientX, e.clientY)) e.preventDefault();
}

/** The caret put in a face's box at a point, once it is drawn (a press that opened the editor). */
export function caretInFace(face: Element | null | undefined, x: number, y: number): boolean {
  const host = face?.querySelector('.face-host');
  const v = host ? faceViews.get(host) : undefined;
  return !!v && caretToPress(v, x, y);
}

interface FaceProps {
  value: string;
  placeholder: string;
  autoFocus?: boolean;
  /** ⌘B makes a blank of the selection (a cloze's face); such a face holds no table. */
  blanks?: boolean;
  onChange(text: string): void;
  /** A cloze's row of blank buttons under a finger: on the keyboard (the default), in place under the field, or not drawn. */
  blankRow?: 'inline' | 'none' | undefined;
}

/** A face as the reader edits text: inline Markdown and math chips, a table as a table. */
export function FaceField({ value, placeholder, autoFocus, blanks, blankRow, onChange }: FaceProps) {
  const mobile = useApp((s) => s.mobile);
  const [focused, setFocused] = useState(false);
  const [tick, setTick] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const v = new EditorView(mount, {
      state: makeState(faceFieldBlocks(value, !blanks), { frozen: () => false, pos: null, blanks: !!blanks }),
      nodeViews,
      handleClickOn,
      // `data-empty` says when the placeholder shows (a rule that looked at the page's own children went stale on a phone)
      attributes: (state) => ({ class: 'draft-doc face-field', 'data-placeholder': placeholder, 'data-empty': state.doc.childCount <= 1 && state.doc.textContent === '' && !state.doc.firstChild?.childCount ? '1' : '0' }),
      // Tab in a face's plain text goes to the card's other face (⇧Tab back), as a form's fields do; in a cell or a list it is the editor's
      handleKeyDown(ev, e) {
        if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return false;
        const { $from } = ev.state.selection;
        if ($from.depth !== 1 || $from.parent.type.name !== 'paragraph') return false;
        const faces = Array.from(document.querySelectorAll<HTMLElement>('.face-field'));
        const other = faces[faces.indexOf(ev.dom as HTMLElement) + (e.shiftKey ? -1 : 1)];
        if (!other) return false;
        e.preventDefault();
        other.focus();
        return true;
      },
      handleDOMEvents: {
        // a cell's menu, or cut, copy, paste and `insert table` (not in a cloze)
        contextmenu: (ev, e) => editorMenu(ev, e, { table: !blanks, blanks: !!blanks }),
        focus: () => { setFocused(true); return false; },
        blur: () => { setFocused(false); return false; },
      },
      dispatchTransaction(tr) {
        const next = v.state.apply(tr);
        v.updateState(next);
        if (tr.docChanged) change.current(faceFieldText(next.doc));
        // the row of blanks is for the selection as it is now
        if (blanks) setTick((t) => t + 1);
      },
    });
    view.current = v;
    faceViews.set(mount, v);
    if (autoFocus) v.focus();
    return () => { faceViews.delete(mount); v.destroy(); view.current = null; };
  // the field is remounted (by key) when the form switch rewrites it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const v = view.current;
    // the editor's own key made the blank already (`blanksDeco.ts`); this is for a press that did not reach it
    if (!blanks || !v || e.defaultPrevented || !(e.metaKey || e.ctrlKey) || (e.key !== 'b' && e.key !== 'B')) return;
    e.preventDefault();
    // the selection (or the word at the caret) a blank of a group of its own
    makeBlank()(v.state, v.dispatch.bind(v));
  };
  // under a finger a cloze's blanks are a row of buttons, there while the field has the caret (`BlankRow`)
  const row = blanks && mobile && focused && view.current && blankRow !== 'none';
  return (
    <>
      <div className="face-host" ref={host} onKeyDown={onKeyDown} />
      {row && <BlankRow tick={tick} view={view.current!} inline={blankRow === 'inline'} />}
    </>
  );
}
