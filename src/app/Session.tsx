// The session: the outstanding queue walked one element at a time, after the
// prototype's recall.jsx. A card is revealed and graded; a reading topic
// opens whole in the reader with the marker live and is read on, postponed,
// or done; a draft opens whole and is worked on, postponed, or done. Every
// result is written to the file the element came from.

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { cardFields, clozeParts, type Block, type Card } from '../format/index.js';
import { GRADES, advanceRead, advanceWrite, gradeItem, type CardItem, type Grade, type QueueItem, type ReadItem, type WriteItem } from '../schedule/index.js';
import { EL_WORD, FORM_LABEL, dueLabel, gapLabels, ownBlank, sourceLabel } from './items.js';
import type { OpenOpts } from './panes.js';
import { Reader, richHTML } from './Reader.js';
import { useApp, type El } from './store.js';
import { useDoc } from './useDoc.js';
import { currentVault, note } from './vault.js';
import './session.css';

interface Props {
  active: boolean;
  onOpen(path: string, opts: OpenOpts): void;
}

const GRADE_WORD: Record<Grade, string> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

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
      if (e.metaKey || e.ctrlKey || e.altKey || inField(e.target)) return;
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
}

function Nav({ idx, total, onPrev, onNext }: NavProps) {
  return (
    <span className="sess-nav">
      <button type="button" className="sn-btn" onClick={onPrev} disabled={idx === 0}>‹</button>
      <button type="button" className="sn-btn" onClick={onNext} disabled={idx >= total - 1}>›</button>
    </span>
  );
}

interface BarProps extends NavProps {
  kind: El;
  children: ReactNode;
}

/** The control bar at the foot of a reading or writing element. */
function SessionBar({ idx, total, kind, children, onPrev, onNext }: BarProps) {
  return (
    <div className="session-bar">
      <div className="sb-inner">
        <div className="sb-meta">
          <Nav idx={idx} total={total} onPrev={onPrev} onNext={onNext} />
          <span className="sb-count">{idx + 1} / {total}</span>
          <span className="sb-kind" data-el={kind}>{EL_WORD[kind]}</span>
        </div>
        <div className="sb-actions">{children}</div>
      </div>
    </div>
  );
}

// ── a card ───────────────────────────────────────────────────────

/** The item's card in the document as it is now: where it was, else by id. */
function liveCard(blocks: Block[] | undefined, item: CardItem): Card | null {
  if (!blocks) return null;
  const at = blocks[item.block];
  if (at?.kind === 'card' && (item.id !== undefined ? at.id === item.id : at.text === item.text)) return at;
  if (item.id !== undefined) return blocks.find((b): b is Card => b.kind === 'card' && b.id === item.id) ?? null;
  return null;
}

interface CardProps {
  item: CardItem;
  active: boolean;
  onGrade(g: Grade): void;
}

function CardElement({ item, active, onGrade }: CardProps) {
  const loaded = useDoc(item.path);
  const [revealed, setRevealed] = useState(false);
  const now = new Date();
  const card = liveCard(loaded?.doc.blocks, item);
  const text = card?.text ?? item.text;
  const f = cardFields(text);
  const sched = item.group && 'n' in item.group && card?.blanks?.[item.group.n] ? card.blanks[item.group.n] : card?.sched ?? item.sched;
  const gaps = gapLabels(sched, now);
  const grade = (g: Grade) => { if (revealed) onGrade(g); else setRevealed(true); };

  useKeys(active, (key) => {
    if (key === ' ') { grade(3); return true; }
    if (key >= '1' && key <= '4') { grade(Number(key) as Grade); return true; }
    return false;
  }, [revealed, item]);

  if (loaded && !card) return <div className="empty center">no longer in the vault</div>;

  let body: ReactNode;
  if (!f) body = <span dangerouslySetInnerHTML={{ __html: richHTML(text) }} />;
  else if (f.form === 'cloze') {
    let index = -1;
    body = (
      <div className="cloze-text">
        {clozeParts(text).map((p, i) => {
          if (typeof p === 'string') return <span key={i} dangerouslySetInnerHTML={{ __html: richHTML(p) }} />;
          index++;
          const mine = ownBlank(item, p.n, index);
          const cls = `cloze${mine ? (revealed ? ' revealed' : '') : ' ctx'}`;
          return <span key={i} className={cls} onClick={() => { if (mine) setRevealed(true); }} dangerouslySetInnerHTML={{ __html: richHTML(p.answer) }} />;
        })}
      </div>
    );
  } else if (f.form === 'qa') {
    body = (
      <div>
        <div className="qa-q" dangerouslySetInnerHTML={{ __html: richHTML(f.front) }} />
        {revealed
          ? <div className="qa-a" dangerouslySetInnerHTML={{ __html: richHTML(f.back) }} />
          : <div className="qa-a hint" onClick={() => setRevealed(true)}>press <kbd className="kbd">space</kbd> to reveal</div>}
      </div>
    );
  } else {
    body = (
      <div className="bidir">
        <div><span className="lbl">a</span><span dangerouslySetInnerHTML={{ __html: richHTML(f.left) }} /></div>
        <div className="bidir-arrow"><span className="lbl"> </span>⇄</div>
        <div>
          <span className="lbl">b</span>
          <span className={`bidir-b${revealed ? ' revealed' : ''}`} onClick={() => setRevealed(true)} dangerouslySetInnerHTML={{ __html: richHTML(f.right) }} />
        </div>
      </div>
    );
  }

  const groupNo = item.group && item.groups > 1 ? ('n' in item.group ? item.group.n : item.group.blank + 1) : null;

  return (
    <>
      <div className="card">{body}</div>
      <div className="card-meta">
        <span className="cm-type">{f ? FORM_LABEL[f.form] : 'card'}</span>
        {groupNo !== null && <span>blank {groupNo} of {item.groups}</span>}
        <span>{plural(sched?.reps ?? 0, 'review')}</span>
        {sched?.stability !== undefined && <span>stability {Math.round(sched.stability)}d</span>}
        <span className="cm-due" data-due={!sched?.due || item.dueAt <= now ? '1' : '0'}>due {dueLabel(sched?.due, now)}</span>
      </div>
      <div className="grades" data-revealed={revealed ? '1' : '0'}>
        {GRADES.map((g) => (
          <button key={g} type="button" onClick={() => grade(g)}>
            <span className="label">{GRADE_WORD[g]}<kbd>{g}</kbd></span>
            <span className="gap">{gaps[g]}</span>
          </button>
        ))}
      </div>
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

type DocAction = 'on' | 'postpone' | 'done';

interface DocProps extends NavProps {
  item: ReadItem | WriteItem;
  active: boolean;
  onAct(action: DocAction, pos?: number): void;
}

function DocSession({ item, active, onAct, ...nav }: DocProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const reading = item.kind === 'read';
  const on = () => onAct('on', reading && barRef.current ? blocksAbove(barRef.current) : undefined);

  useKeys(active, (key) => {
    if (key === 'Enter') { on(); return true; }
    if (key === 'p') { onAct('postpone'); return true; }
    if (key === 'd') { onAct('done'); return true; }
    return false;
  }, [item]);

  return (
    <div className="doc-session" ref={barRef}>
      <Reader id={item.path} />
      <SessionBar kind={item.kind} {...nav}>
        <button type="button" onClick={on}><span className="ra-l">{reading ? 'read on' : 'worked on it'}</span><kbd>⏎</kbd></button>
        <button type="button" onClick={() => onAct('postpone')}><span className="ra-l">postpone</span><kbd>p</kbd></button>
        <button type="button" onClick={() => onAct('done')}><span className="ra-l">done</span><kbd>d</kbd></button>
      </SessionBar>
    </div>
  );
}

// ── the session ──────────────────────────────────────────────────

export function Session({ active, onOpen }: Props) {
  const session = useApp((s) => s.session);
  const docs = useApp((s) => s.docs);
  const [idx, setIdx] = useState(0);
  const items = session?.items ?? [];
  const total = items.length;
  const el = items[idx];

  // a new session starts from its first element
  useEffect(() => { setIdx(0); }, [session?.seq]);

  // the tab follows the element
  useEffect(() => {
    useApp.setState({ sessionEl: el ? { kind: el.kind, label: sourceLabel(el, docs) } : null });
  }, [el, docs]);
  useEffect(() => () => useApp.setState({ sessionEl: null }), []);

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(total - 1, i + 1));
  const advance = () => setIdx((i) => i + 1);

  useKeys(active, (key) => {
    if (key === '[') { goPrev(); return true; }
    if (key === ']') { goNext(); return true; }
    return false;
  }, [total]);

  const fail = (e: unknown) => console.error(e);

  const onGrade = (item: CardItem, g: Grade) => {
    const vault = currentVault();
    if (!vault) return;
    const now = new Date();
    vault.update(item.path, (doc) => { gradeItem(doc, item, g, now); }).then((loaded) => {
      // a card that had no id has one now, and a blank it numbered is numbered:
      // later items of the same card in this session follow
      const at = loaded.doc.blocks[item.block];
      if (at?.kind !== 'card' || item.id !== undefined) return;
      useApp.setState((s) => (s.session ? {
        session: {
          ...s.session,
          items: s.session.items.map((i) => (i.kind === 'card' && i.path === item.path && i.block === item.block && i.id === undefined ? { ...i, id: at.id, text: at.text } as CardItem : i)),
        },
      } : {}));
    }).catch(fail);
    advance();
  };

  const onDoc = (item: ReadItem | WriteItem, action: DocAction, pos?: number) => {
    const vault = currentVault();
    if (!vault) return;
    const now = new Date();
    const run = item.kind === 'read'
      ? vault.update(item.path, (doc) => { advanceRead(doc, action, now, pos); })
      : vault.update(item.path, (doc) => { advanceWrite(doc, action, now); });
    run.catch(fail);
    const word = action === 'postpone' ? 'tomorrow' : action === 'done' ? 'done' : item.kind === 'read' ? 'read on' : 'progress';
    note(`${item.kind === 'read' ? 'read' : 'wrote'} · ${word}`);
    advance();
  };

  if (!el) {
    return (
      <div className="recall-wrap">
        <div className="empty center">{total === 0 ? 'nothing due' : `done, ${plural(total, 'element')}`}</div>
      </div>
    );
  }

  const key = `${session?.seq}:${idx}`;
  if (el.kind !== 'card') {
    return <DocSession key={key} item={el} active={active} idx={idx} total={total} onPrev={goPrev} onNext={goNext} onAct={(a, pos) => onDoc(el, a, pos)} />;
  }

  const openSource = (e: MouseEvent) => onOpen(el.path, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey });
  return (
    <div className="recall-wrap">
      <div className="recall-meta">
        <Nav idx={idx} total={total} onPrev={goPrev} onNext={goNext} />
        <span className="sess-count">{idx + 1} / {total}</span>
        <span className="el-tag" data-el="card">{FORM_LABEL[el.form]}</span>
        <button type="button" className="meta-srclink" onClick={openSource}>{sourceLabel(el, docs)} <span className="ms-arrow">↗</span></button>
      </div>
      <CardElement key={key} item={el} active={active} onGrade={(g) => onGrade(el, g)} />
    </div>
  );
}
