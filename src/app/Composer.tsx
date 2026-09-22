// The card composer, after the prototype's MakeCard: one box with the three
// forms, ⌘B for a blank, ⌘↵ to save. It hands back the card's text as the
// format will read it; where the card goes is the caller's business.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clozeParts, type CardForm } from '../format/index.js';
import { cardText, type CardSpec } from '../reader/index.js';

interface Props {
  seed: string;
  form?: CardForm | undefined;
  onSave(text: string, again: boolean): void;
  onClose(): void;
}

const FORMS: [CardForm, string][] = [['cloze', 'cloze'], ['qa', 'q&a'], ['bidir', 'bidir']];

export function Composer({ seed, form: initial, onSave, onClose }: Props) {
  const [form, setForm] = useState<CardForm>(initial ?? 'cloze');
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
    onSave(out, again);
    if (again) {
      setText(''); setFront(''); setBack(''); setLeft(''); setRight('');
      ref.current?.focus();
    }
  };

  // wrap the selection, or the caret, in {{ }}
  const wrapBlank = () => {
    const el = ref.current;
    if (!el || form !== 'cloze') return;
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? s;
    setText(`${text.slice(0, s)}{{${text.slice(s, e)}}}${text.slice(e)}`);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + 2, e + 2); });
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
            <button key={key} type="button" data-active={form === key ? '1' : '0'} onClick={() => setForm(key)}>
              {label}<sup className="tt-num">{i + 1}</sup>
            </button>
          ))}
        </div>
      </div>

      {form === 'cloze' && (
        <>
          <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} placeholder="passage" />
          <div className="preview"><span className="preview-tag">preview</span>{preview}</div>
        </>
      )}
      {form === 'qa' && (
        <div className="qa-fields">
          <textarea ref={ref} value={front} onChange={(e) => setFront(e.target.value)} placeholder="question" />
          <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="answer" />
        </div>
      )}
      {form === 'bidir' && (
        <div className="qa-fields">
          <input ref={ref} value={left} onChange={(e) => setLeft(e.target.value)} placeholder="term a" />
          <input value={right} onChange={(e) => setRight(e.target.value)} placeholder="term b" />
        </div>
      )}

      <div className="ft">
        <span className="grow" />
        <span className="act" data-able={out ? '1' : '0'} onClick={() => save(false)}><kbd>⌘↵</kbd> save</span>
        <span>·</span>
        <span className="act" data-able={out ? '1' : '0'} onClick={() => save(true)}><kbd>⇧⌘↵</kbd> save, another</span>
        <span>·</span>
        <span className="act" onClick={onClose}><kbd>esc</kbd> cancel</span>
      </div>
    </div>
  );
}
