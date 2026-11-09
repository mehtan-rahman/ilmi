// The card composer, after the prototype's MakeCard: one box with the three
// forms, ⌘B for a blank, ⌘↵ to save, and the prototype's priority picker as
// a number. It hands back the card's text as the format will read it, and
// a priority only when it differs from the document's; where the card goes
// is the caller's business. On a phone (`quick`, milestone 56) it has no keys
// to name: buttons at its foot, `blank` for ⌘B, front and back, no priority.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PRI_MAX, PRI_MIN, clozeParts, mathSpanEnd, nextGroup, parsePri, type CardForm } from '../format/index.js';
import { cardText, type CardSpec } from '../reader/index.js';

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

const FORMS: [CardForm, string][] = [['cloze', 'cloze'], ['qa', 'q&a'], ['bidir', 'bidir']];

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
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, [form]);

  const spec: CardSpec = form === 'cloze' ? { form, text } : form === 'qa' ? { form, front, back } : { form, left, right };
  const out = cardText(spec);

  const save = (again: boolean) => {
    if (out === null) return;
    const own = parsePri(pri.trim());
    // the priority stays across "save, another"
    if (own !== null && own !== docPri) onSave(out, again, own); else onSave(out, again);
    if (again) {
      setText(''); setFront(''); setBack(''); setLeft(''); setRight('');
      ref.current?.focus();
    }
  };

  // wrap the selection, or the caret, in {{ }}; inside a formula, in {{cN:: }}
  const wrapBlank = () => {
    const el = ref.current;
    if (!el || form !== 'cloze') return;
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? s;
    const next = withBlank(text, s, e);
    setText(next.text);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + next.open.length, e + next.open.length); });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Enter' && mod) { e.preventDefault(); save(e.shiftKey); }
      else if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); wrapBlank(); }
      else if (mod && (e.key === '1' || e.key === '2' || e.key === '3')) { e.preventDefault(); setForm(FORMS[Number(e.key) - 1]![0]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let preview: ReactNode;
  if (form === 'cloze') {
    const parts = clozeParts(text);
    preview = parts.some((p) => typeof p !== 'string')
      ? parts.map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : <span key={i} className="cloze-mark">{p.answer}</span>))
      : <span className="hint"><kbd className="kbd">⌘B</kbd> blank</span>;
  }

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
          <textarea dir="auto" ref={ref} value={text} onChange={(e) => setText(e.target.value)} placeholder="passage" />
          {quick === undefined
            ? <div className="preview"><span className="preview-tag">preview</span>{preview}</div>
            : <button type="button" className="quick-blank" onMouseDown={(e) => e.preventDefault()} onClick={wrapBlank}>blank</button>}
        </>
      )}
      {form === 'qa' && (
        <div className="qa-fields">
          <textarea dir="auto" ref={ref} value={front} onChange={(e) => setFront(e.target.value)} placeholder={quick === undefined ? 'question' : 'front'} />
          <textarea dir="auto" value={back} onChange={(e) => setBack(e.target.value)} placeholder={quick === undefined ? 'answer' : 'back'} />
        </div>
      )}
      {form === 'bidir' && (
        <div className="qa-fields">
          <input dir="auto" ref={ref} value={left} onChange={(e) => setLeft(e.target.value)} placeholder={quick === undefined ? 'term a' : 'front'} />
          <input dir="auto" value={right} onChange={(e) => setRight(e.target.value)} placeholder={quick === undefined ? 'term b' : 'back'} />
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
        <span className="act" data-able={out ? '1' : '0'} onClick={() => save(false)}><kbd>⌘↵</kbd> save</span>
        <span>·</span>
        <span className="act" data-able={out ? '1' : '0'} onClick={() => save(true)}><kbd>⇧⌘↵</kbd> save, another</span>
        <span>·</span>
        <span className="act" onClick={onClose}><kbd>esc</kbd> cancel</span>
      </div>
      )}
    </div>
  );
}
