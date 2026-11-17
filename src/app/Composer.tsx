// The card composer, after the prototype's MakeCard: one box with the three
// forms, ⌘B for a blank, ⌘↵ to save, and the prototype's priority picker as
// a number. It hands back the card's text as the format will read it, and
// a priority only when it differs from the document's; where the card goes
// is the caller's business. On a phone (`quick`, milestone 56) it has no keys
// to name: buttons at its foot, `blank` for ⌘B, front and back, no priority.

import { makeBlank } from '../reader/index.js';
import { FaceField, faceViews, pressIntoFace } from './FaceField.js';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PRI_MAX, PRI_MIN, clozeParts, mathSpanEnd, nextGroup, parsePri, type CardForm } from '../format/index.js';
import { cardText, type CardSpec } from '../reader/index.js';
import { CARD_FORMS } from './deck.js';
import { hapticTick } from './haptics.js';

interface Props {
  seed: string;
  form?: CardForm | undefined;
  /** The document's priority: what the card gets when the picker is left alone. */
  pri: number;
  onSave(text: string, again: boolean, pri?: number): void;
  onClose(): void;
  /** A quick card: what goes over its buttons (the deck it lands in). */
  quick?: ReactNode;
}

const FORMS = CARD_FORMS;

/** Whether `[from, to]` sits inside a math span of `text`, its delimiters excluded. */
export function insideMath(text: string, from: number, to: number): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '$') continue;
    const e = mathSpanEnd(text, i);
    if (e < 0) continue;
    const d = text[i + 1] === '$' ? 2 : 1;
    if (from >= i + d && to <= e - d) return true;
    i = e - 1;
  }
  return false;
}

/** The text with `[from, to]` made a blank: inside a formula the numbered form, the only one that is a blank there (FORMAT.md §5.1). */
export function withBlank(text: string, from: number, to: number): { text: string; open: string } {
  const open = insideMath(text, from, to) ? `{{c${nextGroup(text)}::` : '{{';
  return { text: `${text.slice(0, from)}${open}${text.slice(from, to)}}}${text.slice(to)}`, open };
}

export function Composer({ seed, form: initial, pri: docPri, onSave, onClose, quick }: Props) {
  const [form, setForm] = useState<CardForm>(initial ?? 'cloze');
  const [pri, setPri] = useState(String(docPri));
  const [text, setText] = useState(seed);
  const [front, setFront] = useState(seed);
  const [back, setBack] = useState('');
  const [left, setLeft] = useState(seed);
  const [right, setRight] = useState('');
  /** The passage's editor, and a count that starts it afresh (save, another). */
  const faceRef = useRef<HTMLDivElement>(null);
  const [gen, setGen] = useState(0);


  const spec: CardSpec = form === 'cloze' ? { form, text } : form === 'qa' ? { form, front, back } : { form, left, right };
  const out = cardText(spec);

  const save = (again: boolean) => {
    if (out === null) return;
    const own = parsePri(pri.trim());
    // the priority stays across "save, another"
    if (own !== null && own !== docPri) onSave(out, again, own); else onSave(out, again);
    if (again) {
      setText(''); setFront(''); setBack(''); setLeft(''); setRight('');
      setGen((g) => g + 1);
    }
  };

  // wrap the selection, or the caret, in {{ }}; inside a formula, in {{cN:: }}
  const wrapBlank = () => {
    if (form !== 'cloze') return;
    // the passage is the reader's editor (`FaceField`): the selection, or the word at the caret, a blank of a group of its own
    const host = faceRef.current?.querySelector('.face-host');
    const v = host ? faceViews.get(host) : undefined;
    if (!v) return;
    if (makeBlank()(v.state, v.dispatch.bind(v))) hapticTick();
    v.focus();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Enter' && mod) { e.preventDefault(); save(e.shiftKey); }
      else if (mod && (e.key === 'b' || e.key === 'B')) { if (!e.defaultPrevented) { e.preventDefault(); wrapBlank(); } }
      else if (mod && (e.key === '1' || e.key === '2' || e.key === '3')) { e.preventDefault(); setForm(FORMS[Number(e.key) - 1]![0]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // the passage shows its own blanks; with none yet, how one is made
  const hasBlank = form === 'cloze' && clozeParts(text).some((p) => typeof p !== 'string');
  const preview: ReactNode = <span className="hint">select the words, then <kbd className="kbd">⌘B</kbd> or right-click · blank</span>;

  return (
    <div className="composer">
      <div className="hd">
        <span>new card</span>
        <div className="type-toggle">
          {FORMS.map(([key, label], i) => (
            <button key={key} type="button" data-form={key} data-active={form === key ? '1' : '0'} onClick={() => setForm(key)}>
              {label}{quick === undefined && <sup className="tt-num">{i + 1}</sup>}
            </button>
          ))}
        </div>
      </div>

      {form === 'cloze' && (
        <>
          <div className="composer-face" dir="auto" ref={faceRef} onMouseDown={pressIntoFace}>
            <FaceField key={gen} value={text} placeholder="passage" autoFocus blanks onChange={setText} />
          </div>
          {quick === undefined
            ? (hasBlank ? null : <div className="preview">{preview}</div>)
            : <button type="button" className="quick-blank" onMouseDown={(e) => e.preventDefault()} onClick={wrapBlank}>blank</button>}
        </>
      )}
      {form !== 'cloze' && (
        // each side is the reader's editor, as a note's text is: formatting, math, a table, the same menu (a phone's too)
        <div className="qa-fields" key={`${form}${gen}`}>
          <div className="composer-face side" dir="auto" onMouseDown={pressIntoFace}>
            <FaceField value={form === 'qa' ? front : left} placeholder={quick !== undefined ? 'front' : form === 'qa' ? 'question' : 'term a'} autoFocus onChange={form === 'qa' ? setFront : setLeft} />
          </div>
          <div className="composer-face side" dir="auto" onMouseDown={pressIntoFace}>
            <FaceField value={form === 'qa' ? back : right} placeholder={quick !== undefined ? 'back' : form === 'qa' ? 'answer' : 'term b'} onChange={form === 'qa' ? setBack : setRight} />
          </div>
        </div>
      )}

      {quick !== undefined ? (
        <div className="quick-ft">
          {quick}
          <div className="qf-acts">
            <button type="button" data-act="cancel" onMouseDown={(e) => e.preventDefault()} onClick={onClose}>cancel</button>
            <button type="button" data-act="again" disabled={!out} onMouseDown={(e) => e.preventDefault()} onClick={() => save(true)}>save, another</button>
            <button type="button" data-act="save" disabled={!out} onMouseDown={(e) => e.preventDefault()} onClick={() => save(false)}>save</button>
          </div>
        </div>
      ) : (
      <div className="ft">
        <label className="pri-pick">
          priority
          <input type="number" inputMode="numeric" min={PRI_MIN} max={PRI_MAX} step={1} value={pri} onChange={(e) => setPri(e.target.value)} onBlur={() => { if (parsePri(pri.trim()) === null) setPri(String(docPri)); }} />
        </label>
        <span className="grow" />
        <button type="button" className="act" data-able={out ? '1' : '0'} onMouseDown={(e) => e.preventDefault()} onClick={() => save(false)}><kbd>⌘↵</kbd> save</button>
        <span>·</span>
        <button type="button" className="act" data-able={out ? '1' : '0'} onMouseDown={(e) => e.preventDefault()} onClick={() => save(true)}><kbd>⇧⌘↵</kbd> save, another</button>
        <span>·</span>
        <button type="button" className="act" onMouseDown={(e) => e.preventDefault()} onClick={onClose}><kbd>esc</kbd> cancel</button>
      </div>
      )}
    </div>
  );
}
