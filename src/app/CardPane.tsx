// The card view (`:cards/<document>`): a document's cards one at a time, in
// document order, in the session's two boxes (`session.css`), both live
// (`CardFaces.tsx`). `[` `]` and ‹ › move through them, saving first; `o`
// goes to the card in its document. Opened from a card's row in the tree,
// a double-click (or ⏎) on a deck row, or a double-click on a card in a
// note (`openCards`); where it stands is the store's `cardAt`.

import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { PRI_DEFAULT, cardFields, type Card } from '../format/index.js';
import { whenToDate } from '../schedule/index.js';
import { cardDue } from '../reader/index.js';
import { CardFaces, type FacesHandle } from './CardFaces.js';
import { cardIndex, cardOf, cardSet, countOf, stepIn, type CardLine } from './cardSet.js';
import { saveCardEdit } from './deckOps.js';
import { FORM_LABEL, dueLabel, dueTone } from './items.js';
import { MathText } from './MathText.js';
import { titleOf } from './names.js';
import type { OpenOpts } from './panes.js';
import { Nav } from './Session.js';
import { useApp } from './store.js';
import { docsOf } from './vault.js';
import { appNow } from './clock.js';
import './session.css';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
};

/** `due today`, `due +3d`; `new` and `overdue 2d` stand alone. */
const dueWord = (due: string | undefined, now: Date): string => {
  const l = dueLabel(due, now);
  return l === 'new' || l.startsWith('overdue') ? l : `due ${l}`;
};

/** The card's schedule, as the session's strip says it: its reviews (every line's), its stability, its own priority, when it is due. */
function Schedule({ card, docPri }: { card: Card; docPri: number }) {
  const now = appNow();
  const lines = [card.sched, ...Object.values(card.blanks ?? {}), card.reverse].filter((s) => s !== undefined);
  const reps = lines.reduce((n, s) => n + (s.reps ?? 0), 0);
  const stab = card.sched?.stability;
  const pri = card.sched?.pri ?? docPri;
  const due = cardDue(card);
  const when = card.sched?.suspended ? 'suspended' : dueWord(due, now);
  return (
    <>
      <span>{plural(reps, 'review')}</span>
      {stab !== undefined && <span>stability {Math.round(stab)}d</span>}
      {pri !== PRI_DEFAULT && <span>p {pri}</span>}
      <span className="cm-due" data-due={due === undefined || whenToDate(due) <= now ? '1' : '0'} data-st={dueTone(when)}>{when}</span>
    </>
  );
}

/** The headings over block `block`, outermost first: where the card sits in its document. */
function headingsOver(blocks: readonly { kind: string; level?: number; text?: string }[], block: number): string[] {
  const out: { level: number; text: string }[] = [];
  for (let i = 0; i < block && i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.kind !== 'heading') continue;
    while (out.length && out[out.length - 1]!.level >= (b.level ?? 1)) out.pop();
    out.push({ level: b.level ?? 1, text: b.text ?? '' });
  }
  return out.map((h) => h.text);
}

interface Props {
  /** The document whose cards these are. */
  path: string;
  active: boolean;
  onOpen(path: string, opts: OpenOpts): void;
}

export function CardPane({ path, active, onOpen }: Props) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const at = useApp((s) => s.cardAt[path]);
  // `docs` moves with every write the vault reports: the body is read again then
  const body = useMemo(() => docsOf([path])[0]?.[1] ?? null, [path, docs]);
  const set = useMemo(() => cardSet(body), [body]);
  const i = cardIndex(set, at);
  const line: CardLine | undefined = set[i];
  const card = cardOf(body, line);
  const handle = useRef<FacesHandle | null>(null);
  const docPri = docs[path]?.pri ?? PRI_DEFAULT;

  const stand = (l: CardLine) => useApp.setState((s) => ({ cardAt: { ...s.cardAt, [path]: l.id === undefined ? { block: l.block } : { block: l.block, id: l.id } } }));
  const go = (d: number) => {
    // what is unsaved is saved first; a save that asks keeps the card
    if (handle.current && !handle.current.flush()) return;
    const next = set[stepIn(i, d, set.length)];
    if (next && next !== line) stand(next);
  };
  const toSource = (opts: OpenOpts = {}) => {
    if (!line) return;
    if (handle.current && !handle.current.flush()) return;
    useApp.setState({ reveal: line.id === undefined ? { path, index: line.block } : { path, index: line.block, id: line.id } });
    onOpen(path, opts);
  };

  // the inspector shows the card on show
  useEffect(() => {
    if (!active || !line) return;
    const cur = useApp.getState().selectedCard;
    if (cur?.path !== path || cur.index !== line.block) useApp.setState({ selectedCard: { path, index: line.block } });
  }, [active, path, line?.block]);
  useEffect(() => () => {
    if (useApp.getState().selectedCard?.path === path) useApp.setState({ selectedCard: null });
  }, [path]);

  // [ ] through the cards, o to the source, while no face has the caret
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || inField(e.target) || useApp.getState().paletteOpen) return;
      if (e.key === '[') { e.preventDefault(); go(-1); }
      else if (e.key === ']') { e.preventDefault(); go(1); }
      else if (e.key === 'o') { e.preventDefault(); toSource(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const title = titleOf(path, docs, root);
  if (!body) return <div className="recall-wrap card-view"><div className="empty center">no longer in the collection</div></div>;
  const trail = [title, ...(line ? headingsOver(body.blocks, line.block) : [])];
  const form = card ? cardFields(card.text)?.form : undefined;
  const onSource = (e: MouseEvent) => toSource({ cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey });
  return (
    <div className="recall-wrap card-view" data-path={path}>
      <div className="recall-meta">
        <Nav idx={Math.max(0, i)} total={set.length} onPrev={() => go(-1)} onNext={() => go(1)} />
        <span className="sess-count cv-count">{countOf(i, set.length)}</span>
        {form && <span className="el-tag" data-el="card" data-form={form}>{FORM_LABEL[form]}</span>}
        <button type="button" className="meta-srclink card-trail" onClick={onSource} title={`${trail.join(' › ')}  o`}>
          {trail.map((t, k) => <bdi key={k} className={k ? 'ct-h' : 'ct-doc'}><MathText text={t} title={false} /></bdi>)}
          <span className="ms-arrow">↗</span>
        </button>
      </div>
      {card && line ? (
        <CardFaces
          key={`${path}#${line.id ?? line.block}`}
          card={card}
          handle={handle}
          keep={`${path}#${line.id ?? line.block}`}
          onSave={(text, was) => {
            const ref = line.id === undefined ? { path, block: line.block, text: was } : { path, block: line.block, id: line.id, text: was };
            saveCardEdit(ref, text, card.sched?.pri ?? null).catch((e: unknown) => console.error(e));
          }}
        >
          <Schedule card={card} docPri={docPri} />
        </CardFaces>
      ) : (
        <div className="empty center">no cards</div>
      )}
    </div>
  );
}
