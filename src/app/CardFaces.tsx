// A card's two boxes made live, in the session's look (`session.css`): the
// question's box over the answer's, a cloze one box, each a `FaceField`; the
// form switch and what the edit stands at in the quiet strip under them.
// The card view (`CardPane.tsx`) holds one always; the session turns its
// card into one on `e` or a click on a revealed box. The rules are the deck
// editor's (`cardEdit.ts`, PLAN 32): the card's lines change, its id and
// `sr` lines stay, a form change that would drop a reviewed schedule asks
// first. ⌘⏎ or a press outside saves, Escape puts the faces back as saved,
// and the parent saves what is left (`flush`) before it moves on. Boxes let
// go without that (another tab, another card picked in the tree, the
// session moving on) write what they can; an edit that would drop a
// reviewed schedule, or that the format would not read back, is kept for
// the card's return (`keep`), the question asked again there: an edit goes
// unwritten only by Escape.

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type ReactNode } from 'react';
import type { Card, CardForm } from '../format/index.js';
import { asks, facesOf, facesText, planEdit, switchForm, type Faces, type Plan } from './cardEdit.js';
import { FaceField } from './FaceField.js';

const FORMS: [CardForm, string][] = [['qa', 'q&a'], ['bidir', 'bidir'], ['cloze', 'cloze']];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What the parent asks of the boxes before it moves on. */
export interface FacesHandle {
  /** Save what is unsaved; false when it cannot yet (the editor is asking first). `sure` saves past the asking. */
  flush(sure?: boolean): boolean;
}

/** Edits let go unwritten, by the card's `keep`, until its boxes are drawn again. */
export const keptEdits = new Map<string, Faces>();

/** The faces a card's text opens as: a paragraph that is no card (it should not be one here) as a q&a front. */
const facesFor = (text: string): Faces => facesOf(text) ?? { form: 'qa', front: text, back: '' };

/** The words that ask first: which reviewed schedules the edit drops. */
export function askLine(plan: Plan): string {
  const lost = plan.dropped.filter((d) => d.reps > 0).map((d) => `${d.reverse ? 'the reverse' : `blank ${d.n}`} (${plural(d.reps, 'review')})`).join(', ');
  return `drops the schedule of ${lost}`;
}

interface Props {
  /** The card as the file holds it now. */
  card: Card;
  /** Write `text` as the card's; `was` is its text in the file before (to find it by when it has no id). */
  onSave(text: string, was: string): void;
  /** After ⌘⏎, Escape, or a save by a press outside: the session goes back to the revealed card. */
  onDone?: () => void;
  /** Put the caret in the question's box at once. */
  autoFocus?: boolean;
  handle?: MutableRefObject<FacesHandle | null>;
  /** The strip's own words after the form switch (the schedule). */
  children?: ReactNode;
  /** The card's name for an edit kept while its boxes are away (`keptEdits`): its document and its id, else its block. */
  keep?: string;
}

export function CardFaces({ card, onSave, onDone, autoFocus, handle, children, keep }: Props) {
  // an edit kept from the last time comes back as it was left, asking again when it asked
  const [faces, setFaces] = useState<Faces>(() => (keep !== undefined && keptEdits.get(keep)) || facesFor(card.text));
  const [gen, setGen] = useState(0);
  const [asking, setAsking] = useState<string | null>(() => {
    const kept = keep === undefined ? undefined : keptEdits.get(keep);
    const t = kept && facesText(kept);
    if (!t || t === facesText(facesFor(card.text))) return null;
    const p = planEdit(card, t);
    return asks(p) ? askLine(p) : null;
  });
  // the text the faces were saved as (or opened as), as the editor writes it: what dirty is measured from
  const [base, setBase] = useState<string | null>(() => facesText(facesFor(card.text)));
  // the card's text in the file, for the save to find it by
  const fileText = useRef(card.text);
  const root = useRef<HTMLDivElement>(null);
  const text = facesText(faces);
  const dirty = text !== base;
  const plan = text !== null ? planEdit(card, text) : null;

  // the file changed under the boxes (the inspector, a sync, this editor's own save come back):
  // an edit in hand is kept; otherwise the faces follow, redrawn only when they say something else
  useEffect(() => {
    fileText.current = card.text;
    const now = facesText(facesFor(card.text));
    if (now === base) return;
    if (dirty) return;
    setBase(now);
    if (now !== text) { setFaces(facesFor(card.text)); setGen((g) => g + 1); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.text]);

  const revert = () => {
    setFaces(facesFor(fileText.current));
    setBase(facesText(facesFor(fileText.current)));
    setGen((g) => g + 1);
    setAsking(null);
  };

  const flush = (sure = false): boolean => {
    if (!dirty) return true;
    // what the format would not read back as this card is let go, as the deck's editor does
    if (text === null) { revert(); return true; }
    if (plan && asks(plan) && !sure) { setAsking(askLine(plan)); return false; }
    const was = fileText.current;
    fileText.current = text;
    setBase(text);
    setAsking(null);
    onSave(text, was);
    return true;
  };
  const latest = useRef({ flush, asking, dirty, text, plan, onSave, faces });
  latest.current = { flush, asking, dirty, text, plan, onSave, faces };
  if (handle) handle.current = { flush: (sure) => latest.current.flush(sure) };

  // a press outside saves, unless the editor is asking
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (root.current?.contains(e.target as Node)) return;
      // a menu of a face's own (a table's, the text's) is not outside
      if ((e.target as HTMLElement | null)?.closest?.('.pop-menu')) return;
      const st = latest.current;
      if (st.asking !== null || !st.dirty) return;
      if (st.flush(false)) onDone?.();
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [onDone]);

  // leaving (another card, another tab): what is unsaved is written, unless it would drop a reviewed
  // schedule unasked or cannot be read back; then it is kept for the card's return
  useEffect(() => {
    if (keep !== undefined) keptEdits.delete(keep);
    return () => {
      const st = latest.current;
      if (!st.dirty) return;
      if (st.text === null || (st.plan && asks(st.plan))) { if (keep !== undefined) keptEdits.set(keep, st.faces); return; }
      st.onSave(st.text, fileText.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const to = (form: CardForm) => {
    setFaces((f) => switchForm(f, form));
    setGen((g) => g + 1);
    setAsking(null);
  };
  const leave = () => { (document.activeElement as HTMLElement | null)?.blur?.(); onDone?.(); };
  // ⌘⏎ before the face sees it: in a table's cell it would add a row
  const onKeyDownCapture = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    e.stopPropagation();
    if (flush(asking !== null)) leave();
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') {
      if (e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      if (asking !== null) setAsking(null);
      else { revert(); leave(); }
    } else if (mod && (e.key === '1' || e.key === '2' || e.key === '3')) {
      e.preventDefault();
      to(FORMS[Number(e.key) - 1]![0]);
    }
  };
  // a press on a box's padding puts the caret in its text
  const intoFace = (e: React.MouseEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    (e.currentTarget.querySelector('.ProseMirror') as HTMLElement | null)?.focus();
  };
  const two = faces.form !== 'cloze';
  return (
    <div className="card-edit" ref={root} data-dirty={dirty ? '1' : '0'} data-form={faces.form} onKeyDownCapture={onKeyDownCapture} onKeyDown={onKeyDown}>
      <div className="card editing" data-faces={two ? '2' : '1'}>
        <div className="face front" onMouseDown={intoFace}>
          <FaceField
            key={`f${gen}`}
            value={faces.front}
            placeholder={two ? 'front' : 'text, ⌘B for a blank'}
            autoFocus={!!autoFocus}
            blanks={!two}
            onChange={(front) => { setFaces((f) => ({ ...f, front })); setAsking(null); }}
          />
        </div>
        {two && (
          <div className="face back" onMouseDown={intoFace}>
            <FaceField key={`b${gen}`} value={faces.back} placeholder="back" onChange={(back) => { setFaces((f) => ({ ...f, back })); setAsking(null); }} />
          </div>
        )}
      </div>
      <div className="card-meta">
        <span className="cm-forms" role="radiogroup" aria-label="form">
          {FORMS.map(([key, label]) => (
            <button key={key} type="button" data-form={key} data-active={faces.form === key ? '1' : '0'} onMouseDown={(e) => e.preventDefault()} onClick={() => to(key)}>{label}</button>
          ))}
        </span>
        {children}
        <span className="grow" />
        {asking !== null ? (
          <>
            <span className="cm-ask">{asking}</span>
            <button type="button" className="cm-act" onClick={() => { if (flush(true)) leave(); }}><kbd>⌘↵</kbd> save anyway</button>
            <button type="button" className="cm-act" onClick={() => setAsking(null)}><kbd>esc</kbd> back</button>
          </>
        ) : dirty ? (
          <>
            <button type="button" className="cm-act" data-act="save" onClick={() => { if (flush(false)) leave(); }}><kbd>⌘↵</kbd> save</button>
            <button type="button" className="cm-act" data-act="revert" onClick={() => { revert(); leave(); }}><kbd>esc</kbd> revert</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
