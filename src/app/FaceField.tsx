// One face of a card, live: the reader's editor over the face's text (inline
// Markdown, math chips, 26's rules), shared by the deck's inline editor and
// the card view's two boxes. A face's pipe lines (FORMAT.md §5, tables in a
// face) are a table edited as the reader edits one: its cells, its `···`, a
// right-click's menu. The face is written back line for line: its prose as
// typed, an untouched table as it was read, a changed one as the normalized
// pipe table. A cloze's face holds no table: its text stays one paragraph.

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import type { Block } from '../format/index.js';
import { makeState, nodeToRaw, schema, textOf } from '../reader/index.js';
import { editorMenu, handleClickOn, nodeViews } from './Reader.js';

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

/** Each face's editor by its `.face-host`: for a test or a smoke to type into. */
export const faceViews = new WeakMap<Element, EditorView>();

interface FaceProps {
  value: string;
  placeholder: string;
  autoFocus?: boolean;
  /** ⌘B makes a blank of the selection (a cloze's face); such a face holds no table. */
  blanks?: boolean;
  onChange(text: string): void;
}

/** A face as the reader edits text: inline Markdown and math chips, a table as a table. */
export function FaceField({ value, placeholder, autoFocus, blanks, onChange }: FaceProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const v = new EditorView(mount, {
      state: makeState(faceFieldBlocks(value, !blanks), { frozen: () => false, pos: null }),
      nodeViews,
      handleClickOn,
      attributes: { class: 'draft-doc face-field', 'data-placeholder': placeholder },
      handleDOMEvents: {
        // a cell's menu, or cut, copy, paste and `insert table` (not in a cloze)
        contextmenu: (ev, e) => editorMenu(ev, e, { table: !blanks }),
      },
      dispatchTransaction(tr) {
        const next = v.state.apply(tr);
        v.updateState(next);
        if (tr.docChanged) change.current(faceFieldText(next.doc));
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
    if (!blanks || !v || !(e.metaKey || e.ctrlKey) || (e.key !== 'b' && e.key !== 'B')) return;
    e.preventDefault();
    const { from, to } = v.state.selection;
    v.dispatch(v.state.tr.insertText('}}', to).insertText('{{', from));
  };
  return <div className="face-host" ref={host} onKeyDown={onKeyDown} />;
}
