// The inspector: what the active tab is, read from the vault, and the few
// things worth changing from the side: a source's freeze, a deck's default
// card, a draft's done, a document's or a card's priority, a topic's growth,
// and the text of the card under review or selected in the reader. After the
// prototype's Inspector, with its prose removed. A clipped page's address is
// a link that opens in the browser (the opener plugin).

import { openUrl } from '@tauri-apps/plugin-opener';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AF_MIN, PRI_DEFAULT, PRI_MAX, PRI_MIN, READ_AF, RETENTION_MAX, RETENTION_MIN, WRITE_AF, cardForm, docPri, meta, parse, parseAf, parseCount, parsePri, parseRetention, setField,
  type Block, type Card, type CardForm, type CardSchedule, type Doc, type ReadSchedule, type WriteSchedule,
} from '../format/index.js';
import { advanceWrite, inScope, nextIntervals, type CardItem, type OptionKey } from '../schedule/index.js';
import { baseOf, childDirOf, childrenAt, dirOf, isDoc, pageOfBlock, type TreeNode } from '../vault/index.js';
import { cardName, formLabel } from './chrome.js';
import { breakdown, countsUnder, dueItems, plainMath } from './chromeText.js';
import { MathText } from './MathText.js';
import { FORM_LABEL, dueLabel, dueWhen, fmtDays } from './items.js';
import { INTAKE, QUEUE_TITLE, SESSION, findNode, queueScope, titleOf } from './names.js';
import { activeTab } from './panes.js';
import { useApp, type DocInfo } from './store.js';
import { useDoc } from './useDoc.js';
import { currentVault, openNode, optionsAt, resetCard } from './vault.js';
import { docsUnder } from './deck.js';
import { notebookOf, outline } from './tabs.js';
import { goToHeading } from './headings.js';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const words = (blocks: Block[]) => blocks.reduce((n, b) => (b.kind === 'card' ? n : n + b.text.split(/\s+/).filter(Boolean).length), 0);

/** An address as the row shows it: without its scheme and a leading `www.`. */
export const urlLabel = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

/** Open a clipped page's address in the browser; outside Tauri, in a new tab. */
export function openInBrowser(url: string): void {
  openUrl(url).catch(() => { window.open(url, '_blank', 'noopener'); });
}

/** The `url` row: the address as a link. */
function UrlLink({ url }: { url: string }) {
  return <button type="button" className="insp-link" title={url} onClick={() => openInBrowser(url)}>{urlLabel(url)}</button>;
}

function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <span key={k} className="kvr"><dt>{k}</dt><dd>{v}</dd></span>
      ))}
    </dl>
  );
}

function Block({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="block">
      <h6>{title}</h6>
      {children}
    </div>
  );
}

interface NumFieldProps {
  className: string;
  value: number | undefined;
  /** What applies when the field is empty; shown as the placeholder. */
  fallback: number | string;
  min: number;
  max?: number;
  step: number;
  /** The text as a number in range, or null. */
  parse(t: string): number | null;
  /** A value that means the same as empty, so the field clears when it is typed. */
  none?: number;
  onCommit(n: number | null): void;
}

/**
 * A number field that commits on blur or ⏎, empty for none (the placeholder
 * says what applies then). Escape puts back what was there. Nothing is
 * written while typing.
 */
function NumField({ className, value, fallback, min, max, step, parse: parseNum, none, onCommit }: NumFieldProps) {
  const shown = value === undefined ? '' : String(value);
  const [text, setText] = useState(shown);
  useEffect(() => { setText(shown); }, [shown]);
  const commit = () => {
    const t = text.trim();
    const n = t === '' ? null : parseNum(t);
    if (t !== '' && n === null) { setText(shown); return; }
    if (n === null || n === none) { setText(''); if (value !== undefined) onCommit(null); return; }
    if (n !== value) onCommit(n);
  };
  return (
    <input
      className={className}
      type="number"
      inputMode={step === 1 ? 'numeric' : 'decimal'}
      min={min}
      max={max}
      step={step}
      placeholder={String(fallback)}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); setText(shown); e.currentTarget.blur(); }
      }}
    />
  );
}

/** A priority, 0–100. */
function PriField({ value, fallback, onCommit }: { value: number | undefined; fallback: number; onCommit(n: number | null): void }) {
  return <NumField className="pri-field" value={value} fallback={fallback} min={PRI_MIN} max={PRI_MAX} step={1} parse={parsePri} onCommit={onCommit} />;
}

/** The document's priority row: the field, written through `setField`; empty clears it. */
function docPriRow(path: string, m: ReturnType<typeof meta>): [string, ReactNode] {
  const write = (n: number | null) => currentVault()?.update(path, (d) => setField(d, 'pri', n)).catch(console.error);
  // with no field, a `pri=` left on a read / write line is what the queue uses for that loop
  const fallback = m.read?.pri ?? m.write?.pri ?? PRI_DEFAULT;
  return ['priority', <PriField key={path} value={m.pri} fallback={fallback} onCommit={write} />];
}

/**
 * A topic's growth row: the `af` on its `read` / `write` line (empty means
 * the loop's default), and the next three intervals from where it stands.
 * Written through `setField`; the default, or nothing, takes `af` off the line.
 */
function growthRow(path: string, key: 'read' | 'write', s: ReadSchedule | WriteSchedule): [string, ReactNode] {
  const def = key === 'read' ? READ_AF : WRITE_AF;
  const write = (n: number | null) => currentVault()?.update(path, (d) => {
    const m = meta(d);
    const cur = key === 'read' ? m.read : m.write;
    if (!cur) return;
    const { af: _, ...rest } = cur;
    setField(d, key, n === null ? rest : { ...rest, af: n });
  }).catch(console.error);
  const preview = nextIntervals(s.ivl, s.af ?? def).map(fmtDays).join(', ');
  return ['growth', (
    <>
      <NumField className="af-field" value={s.af} fallback={def} min={AF_MIN} step={0.1} parse={parseAf} none={def} onCommit={write} />
      <span className="dim af-next">{preview}</span>
    </>
  )];
}

// ── options ──────────────────────────────────────────────────────

const OPTION_FIELD: Record<Exclude<OptionKey, 'leechAction'>, 'new-per-day' | 'reviews-per-day' | 'retention' | 'leech'> = {
  newPerDay: 'new-per-day', reviewsPerDay: 'reviews-per-day', retention: 'retention', leech: 'leech',
};

/**
 * The study options where they apply (`schedule/options.ts`): each one's
 * value, and where it comes from when it is not set here, dimmed (`from
 * quantum II`); nothing for a default. On a document each is a field that
 * writes its front-matter (empty takes it off, so the one above applies);
 * on a folder, which has no front-matter, they read only.
 */
export function OptionsBlock({ path }: { path: string }) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const { opts, from } = optionsAt(path);
  const own = isDoc(path);
  const where = (k: OptionKey) => {
    const f = from[k];
    if (f === undefined) return null;
    if (own && f === path) return null;
    return <span className="dim opt-from" data-from={f}>from {titleOf(f, docs, root)}</span>;
  };
  const isOwn = (k: OptionKey) => own && from[k] === path;
  const write = (field: 'new-per-day' | 'reviews-per-day' | 'retention' | 'leech' | 'leech-action', v: number | string | null) =>
    currentVault()?.update(path, (d) => setField(d, field as 'leech', v as number | null)).catch(console.error);
  const num = (k: Exclude<OptionKey, 'leechAction'>, label: string, min: number, max: number | undefined, step: number, parse: (t: string) => number | null, unit?: string): [string, ReactNode] => {
    const value = opts[k];
    const shown = value === null ? 'none' : String(value);
    if (!own) return [label, <span key={k} data-opt={k}>{shown}{unit && value !== null ? ` ${unit}` : ''} {where(k)}</span>];
    return [label, (
      <span key={k} className="opt-row" data-opt={k}>
        <NumField className="pri-field opt-field" value={isOwn(k) ? value ?? undefined : undefined} fallback={shown} min={min} {...(max !== undefined ? { max } : {})} step={step} parse={parse} onCommit={(n) => void write(OPTION_FIELD[k], n)} />
        {unit && <span className="dim">{unit}</span>} {where(k)}
      </span>
    )];
  };
  const rows: [string, ReactNode][] = [
    num('newPerDay', 'new a day', 0, 9999, 1, (t) => parseCount(t, 0)),
    num('reviewsPerDay', 'reviews a day', 1, 9999, 1, (t) => parseCount(t, 1)),
    num('retention', 'retention', RETENTION_MIN, RETENTION_MAX, 0.01, parseRetention),
    num('leech', 'leech at', 1, 9999, 1, (t) => parseCount(t, 1), 'lapses'),
  ];
  const action = opts.leechAction;
  return (
    <Block title="options">
      <KV rows={rows} />
      <div className="frozen-row" data-opt="leechAction">
        <span className="fr-state">a leech is {where('leechAction')}</span>
        {own ? (
          <div className="opt-action">
            {(['suspend', 'tag'] as const).map((a) => (
              <button key={a} type="button" data-active={action === a ? '1' : '0'} onClick={() => void write('leech-action', isOwn('leechAction') && action === a ? null : a)}>{a === 'suspend' ? 'suspended' : 'marked'}</button>
            ))}
          </div>
        ) : <span className="opt-val">{action === 'suspend' ? 'suspended' : 'marked'}</span>}
      </div>
    </Block>
  );
}

/** Whether `path` (a document or a folder) has cards in it or under it: where options apply. */
function hasCardsUnder(path: string): boolean {
  const s = useApp.getState();
  return docsUnder(s.tree, path, s.order, s.files).some((p) => (s.docs[p]?.cards ?? 0) > 0);
}

/** The card as this render knew it: at its index, else by id. Not whatever slid into the index since. */
function cardAt(doc: Doc, index: number, card: Card): Card | undefined {
  const same = (b: Block) => b.kind === 'card' && (card.id !== undefined ? b.id === card.id : b.text === card.text);
  const at = doc.blocks[index];
  const b = at && same(at) ? at : card.id !== undefined ? doc.blocks.find(same) : undefined;
  return b?.kind === 'card' ? b : undefined;
}

/** Anything the scheduler wrote; a line carrying only `pri` is not a schedule. */
const hasSchedule = (s: CardSchedule | undefined): boolean => !!s && Object.keys(s).some((k) => k !== 'pri' && k !== 'extra');

/** Cards of a document as a list, each with when it comes up. */
function CardList({ title, doc, now }: { title: string; doc: Doc; now: Date }) {
  const cards = doc.blocks.filter((b): b is Card => b.kind === 'card');
  if (!cards.length) return null;
  const due = (c: Card): string | undefined => {
    const dues = c.blanks ? Object.values(c.blanks).map((b) => b.due ?? c.sched?.due) : cardForm(c.text) === 'bidir' ? [c.sched?.due, c.reverse?.due] : [c.sched?.due];
    return dues.some((d) => d === undefined) ? undefined : [...(dues as string[])].sort()[0];
  };
  return (
    <Block title={title}>
      <ul className="insp-cards">
        {cards.map((c, i) => {
          const d = due(c);
          const isDueNow = d === undefined || new Date(d.length === 10 ? `${d}T00:00` : d) <= now;
          return (
            <li key={c.id ?? i} data-due={isDueNow ? '1' : '0'}>
              <MathText className="cl-t" text={cardName(c.text)} dir="auto" />
              <span className="cl-due">{dueWhen(d, now)}</span>
            </li>
          );
        })}
      </ul>
    </Block>
  );
}

// ── the card editor ──────────────────────────────────────────────

/** True when the format reads `text` as one card. */
function readsAsCard(text: string): boolean {
  const { doc } = parse(text);
  return doc.blocks.length === 1 && doc.blocks[0]?.kind === 'card' && cardForm(text) !== null;
}

/** The card's text, written back a little after each change when it still reads as a card. */
function CardEditor({ path, index, card }: { path: string; index: number; card: Card }) {
  const [text, setText] = useState(card.text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ok = readsAsCard(text);

  // the file changed under the editor (a grade, an edit elsewhere): follow it unless mid-edit
  useEffect(() => { if (!timer.current) setText(card.text); }, [card.text]);

  const write = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!readsAsCard(next)) return;
      currentVault()?.update(path, (doc) => {
        const b = cardAt(doc, index, card);
        if (b && b.text !== next) b.text = next;
      }).catch(console.error);
    }, 400);
  };

  return (
    <div className="card-editor">
      <textarea
        className="ce-field ce-area"
        dir="auto"
        value={text}
        spellCheck
        onChange={(e) => { setText(e.target.value); write(e.target.value); }}
        onBlur={() => { if (timer.current) { clearTimeout(timer.current); timer.current = null; write(text); } }}
      />
      <div className="ce-note" data-ok={ok ? '1' : '0'}>{ok ? formLabel(text) : 'not a card'}</div>
    </div>
  );
}

// ── per kind ─────────────────────────────────────────────────────

/**
 * The page's headings (levels 1 to 3, the list the rail's outline shows),
 * a click bringing one into view, opening any fold it is in. Not drawn
 * while the page's tab rail is shown, which lists them under the tab.
 */
function Outline({ id, doc }: { id: string; doc: Doc }) {
  const docs = useApp((s) => s.docs);
  const railFolded = useApp((s) => s.railFolded);
  const nb = notebookOf(id, docs);
  if (nb !== null && !railFolded[nb]) return null;
  const heads = outline(doc.blocks);
  if (!heads.length) return null;
  const top = Math.min(...heads.map((h) => h.level));
  return (
    <Block title="outline">
      <ul className="insp-outline">
        {heads.map((h) => (
          <li key={h.index} data-heading={h.index} data-level={h.level} style={{ paddingInlineStart: (h.level - top) * 12 }} title={plainMath(h.text)} onClick={() => goToHeading(id, h.index)}>
            <MathText className="io-t" dir="auto" text={h.text} title={false} />
          </li>
        ))}
      </ul>
    </Block>
  );
}

function Gone({ kind }: { kind: string }) {
  return <Block title={kind}><p className="insp-line">no longer in the collection</p></Block>;
}

function FolderInspector({ id }: { id: string }) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const found = childrenAt(tree, id);
  if (!found) return <Gone kind="folder" />;
  const children: TreeNode[] = found;
  // what is under it, all the way down: the cards and what is due among them
  const under = children.reduce((c, n) => { const k = countsUnder(n, docs); return { cards: c.cards + k.cards, due: c.due + k.due }; }, { cards: 0, due: 0 });
  const rows: [string, ReactNode][] = [['items', children.length]];
  if (under.cards) rows.push(['cards', under.cards]);
  if (under.due) rows.push(['due', under.due]);
  return <><Block title="folder"><KV rows={rows} /></Block>{under.cards > 0 && <OptionsBlock path={id} />}</>;
}

/** The `children` line of a document that has any: how many, a click opening them as a folder lens. */
function childrenRow(id: string, tree: TreeNode[]): [string, ReactNode][] {
  const node = findNode(tree, id);
  const n = node?.kind === 'doc' ? node.children?.length ?? 0 : 0;
  if (!n) return [];
  return [['children', <button key="children" type="button" className="insp-link" onClick={() => openNode(childDirOf(id))}>{plural(n, 'item')}</button>]];
}

function toggleField(path: string, key: 'frozen', value: boolean) {
  currentVault()?.update(path, (doc) => setField(doc, key, value)).catch(console.error);
}

function DocInspector({ id, info, doc, now }: { id: string; info: DocInfo; doc: Doc; now: Date }) {
  const docs = useApp((s) => s.docs);
  const tree = useApp((s) => s.tree);
  const m = meta(doc);
  const cards = doc.blocks.filter((b) => b.kind === 'card').length;
  const cardsRow: [string, ReactNode] = ['cards', info.due ? `${cards}, ${info.due} due` : cards];

  if (info.type === 'deck') {
    const setDefault = (form: CardForm) => currentVault()?.update(id, (d) => setField(d, 'default-card', form)).catch(console.error);
    return (
      <>
        <Block title="deck">
          <KV rows={[['cards', cards], ['due', info.due], docPriRow(id, m), ...childrenRow(id, tree)]} />
          <div className="frozen-row">
            <span className="fr-state">new cards</span>
            <div className="deck-default">
              {(Object.keys(FORM_LABEL) as CardForm[]).map((f) => (
                <button key={f} type="button" data-active={(m.defaultCard ?? 'cloze') === f ? '1' : '0'} onClick={() => void setDefault(f)}>{FORM_LABEL[f]}</button>
              ))}
            </div>
          </div>
        </Block>
        <OptionsBlock path={id} />
      </>
    );
  }

  if (info.type === 'draft') {
    const w = m.write;
    const state = !w ? 'not enrolled' : w.done ? 'done' : w.reps ? `pass ${w.reps + 1}` : 'first pass';
    const toggle = () => { if (w) currentVault()?.update(id, (d) => { advanceWrite(d, w.done ? 'on' : 'done', new Date()); }).catch(console.error); };
    return (
      <>
        <Block title="draft">
          <KV rows={[['path', <span className="mono">{id}</span>], ['length', plural(words(doc.blocks), 'word')], ...(cards ? [cardsRow] : []), docPriRow(id, m), ...childrenRow(id, tree)]} />
          {w && (
            <div className="frozen-row">
              <span className="fr-state">{state}</span>
              <button type="button" className="fr-toggle" onClick={toggle}>{w.done ? 'reopen' : 'done'}</button>
            </div>
          )}
        </Block>
        {w && (
          <Block title="spaced composition">
            <KV rows={[['passes', w.reps ?? 0], ['interval', `${w.ivl ?? 1} d`], growthRow(id, 'write', w), [w.done ? 'state' : 'due', w.done ? 'done' : dueLabel(w.due, now)]]} />
          </Block>
        )}
        <Outline id={id} doc={doc} />
        <CardList title="cards" doc={doc} now={now} />
      </>
    );
  }

  // a note, a source, or an extract
  const parent = info.type === 'extract' ? `${dirOf(id)}.md` : null;
  const node = findNode(tree, id);
  const extracts = (node?.kind === 'doc' ? node.children ?? [] : []).filter((c) => c.kind === 'doc' && docs[c.path]?.type === 'extract');
  const rows: [string, ReactNode][] = [];
  if (parent && docs[parent]) rows.push(['of', titleOf(parent, docs, null)]);
  rows.push(['path', <span className="mono">{id}</span>]);
  if (info.pdf) rows.push(['pages', <span className="mono">{baseOf(info.pdf)}</span>]);
  if (m.imported) rows.push(['imported', m.imported]);
  if (m.url) rows.push(['url', <UrlLink key="url" url={m.url} />]);
  if (m.author) rows.push(['author', m.author]);
  if (m.published) rows.push(['published', m.published.slice(0, 10)]);
  rows.push(['length', plural(words(doc.blocks), 'word')]);
  if (cards) rows.push(cardsRow);
  if (m.read && info.type === 'note') rows.push(['revisit', `${m.read.reps ? `pass ${m.read.reps + 1}` : 'first pass'}, ${dueLabel(m.read.due, now)}`]);
  else if (m.read && info.pdf) rows.push(['reading', `${m.read.pos ? `p. ${m.read.pos}` : 'not started'}, ${dueLabel(m.read.due, now)}`]);
  else if (m.read) rows.push(['reading', `${m.read.pos ?? 0} of ${doc.blocks.filter((b) => b.kind !== 'card').length}, ${dueLabel(m.read.due, now)}`]);
  rows.push(docPriRow(id, m));
  if (m.read) rows.push(growthRow(id, 'read', m.read));
  rows.push(...childrenRow(id, tree));
  return (
    <>
      <Block title={info.type}>
        <KV rows={rows} />
        <div className="frozen-row">
          <span className="fr-state">{info.frozen ? 'frozen' : 'editable'}</span>
          <button type="button" className="fr-toggle" data-frozen={info.frozen ? '1' : '0'} onClick={() => toggleField(id, 'frozen', !info.frozen)}>{info.frozen ? 'thaw' : 'freeze'}</button>
        </div>
      </Block>
      {(cards > 0 || hasCardsUnder(id)) && <OptionsBlock path={id} />}
      {!info.pdf && <Outline id={id} doc={doc} />}
      {extracts.length > 0 && (
        <Block title="extracts">
          <ul className="insp-cards">
            {extracts.map((ex) => {
              const r = docs[ex.path]?.read;
              const due = r ? (!r.due || new Date(r.due.length === 10 ? `${r.due}T00:00` : r.due) <= now) : false;
              return (
                <li key={ex.path} data-due={due ? '1' : '0'}>
                  <MathText className="cl-t" dir="auto" text={titleOf(ex.path, docs, null)} />
                  <span className="cl-due">{r ? dueWhen(r.due, now) : ''}</span>
                </li>
              );
            })}
          </ul>
        </Block>
      )}
      <CardList title="cards" doc={doc} now={now} />
    </>
  );
}

/** A card's block: its form, where it is, its schedule, and the editor. */
/** One schedule's numbers, or one quiet word. */
function SchedKV({ sched, none, now }: { sched: CardSchedule | undefined; none: string; now: Date }) {
  if (!sched) return <p className="insp-line">{none}</p>;
  return (
    <KV rows={[
      ['reviews', sched.reps ?? 0],
      ['lapses', sched.lapses ?? 0],
      ['stability', sched.stability !== undefined ? `${sched.stability.toFixed(2)} d` : ''],
      ['difficulty', sched.difficulty !== undefined ? sched.difficulty.toFixed(2) : ''],
      ['due', <>{dueLabel(sched.due, now)} {sched.due && <span className="dim">{sched.due}</span>}</>],
      ['last', sched.last ? sched.last.slice(0, 10) : 'never'],
    ]} />
  );
}

function CardBlock({ path, index, doc, group, dir, now }: { path: string; index: number; doc: Doc; group: CardItem['group'] | undefined; dir?: CardItem['dir']; now: Date }) {
  const docs = useApp((s) => s.docs);
  const b = doc.blocks[index];
  if (b?.kind !== 'card') return null;
  const own = group && 'n' in group && b.blanks?.[group.n] ? b.blanks[group.n] : b.sched;
  const sched = hasSchedule(own) ? own : undefined;
  // both ways: each direction's own schedule, the one this item asks first
  const both = cardForm(b.text) === 'bidir';
  const reverse = hasSchedule(b.reverse) ? b.reverse : undefined;
  // a cloze card may carry only per-blank schedules; it is scheduled all the same
  const scheduled = hasSchedule(b.sched) || b.blanks !== undefined || (both && reverse !== undefined);
  // in a document with pages, the card's page is named with the document
  const page = docs[path]?.pdf ? pageOfBlock(doc, index) : null;
  const rows: [string, ReactNode][] = [['type', formLabel(b.text)], ['in', page === null ? titleOf(path, docs, null) : `${titleOf(path, docs, null)}, p. ${page}`]];
  if (docs[path]?.frozen) rows.push(['text', 'frozen']);
  // the card's own priority, on its bare line; empty means the document's
  const setPri = (n: number | null) => currentVault()?.update(path, (d) => {
    const c = cardAt(d, index, b);
    if (!c) return;
    if (n !== null) c.sched = { ...c.sched, pri: n };
    else if (c.sched) { delete c.sched.pri; if (!Object.keys(c.sched).length) delete c.sched; }
  }).catch(console.error);
  rows.push(['priority', <PriField key={`${path}:${b.id ?? index}`} value={b.sched?.pri} fallback={docPri(meta(doc))} onCommit={setPri} />]);
  const reset = () => { resetCard(path, index, b.id, b.text).catch(console.error); };
  return (
    <>
      <Block title="card">
        <KV rows={rows} />
        <CardEditor key={`${path}:${index}`} path={path} index={index} card={b} />
      </Block>
      {(both ? (dir === 'r' ? ['r', 'f'] as const : ['f', 'r'] as const) : [null]).map((d, k, all) => (
        <Block key={d ?? 'one'} title={d === null ? 'schedule' : d === 'f' ? 'front to back' : 'back to front'}>
          {d === null
            ? <SchedKV sched={sched} none={scheduled ? 'per blank' : 'new'} now={now} />
            : <SchedKV sched={d === 'f' ? sched : reverse} none={d === 'r' && b.reverse?.suspended ? 'new, suspended' : 'new'} now={now} />}
          {scheduled && k === all.length - 1 && (
            <div className="frozen-row">
              <span className="fr-state">scheduled</span>
              <button type="button" className="fr-toggle" onClick={reset}>reset</button>
            </div>
          )}
        </Block>
      ))}
    </>
  );
}

/** The index of a session item's card in the document now. */
function cardIndex(doc: Doc, item: CardItem): number {
  const at = doc.blocks[item.block];
  if (at?.kind === 'card' && (item.id !== undefined ? at.id === item.id : at.text === item.text)) return item.block;
  return item.id === undefined ? -1 : doc.blocks.findIndex((b) => b.kind === 'card' && b.id === item.id);
}

function WithDoc({ id, render }: { id: string; render(doc: Doc, info: DocInfo): ReactNode }) {
  const loaded = useDoc(id);
  const info = useApp((s) => s.docs[id]);
  if (!loaded || !info) return <Gone kind={info?.type ?? 'document'} />;
  return <>{render(loaded.doc, info)}</>;
}

export function Inspector() {
  const panes = useApp((s) => s.panes);
  const docs = useApp((s) => s.docs);
  const queue = useApp((s) => s.queue);
  const session = useApp((s) => s.session);
  const sessionEl = useApp((s) => s.sessionEl);
  const selected = useApp((s) => s.selectedCard);
  const intakeDir = useApp((s) => s.intakeDir);
  const root = useApp((s) => s.vault);
  const now = new Date();
  const id = activeTab(panes)?.id;

  let body: ReactNode;
  if (id === undefined) body = null;
  else if (id === INTAKE) body = <Block title="intake"><KV rows={[['into', titleOf(intakeDir, docs, root)]]} /></Block>;
  else if (queueScope(id)) {
    // the sidebar has each query's count; here, what is due now in this one, by course
    const scope = queueScope(id)!;
    const name = (g: string) => titleOf(g, docs, root);
    const rows = breakdown(dueItems(queue.filter((i) => inScope(i, scope, now)), now), docs, name);
    body = rows.length ? (
      <Block title="due now">
        <ul className="insp-cards insp-groups">
          {rows.map(([g, n]) => <li key={g} data-path={g}><span className="cl-t" dir="auto">{name(g)}</span><span className="cl-due">{n}</span></li>)}
        </ul>
      </Block>
    ) : null;
  } else if (id === SESSION) {
    const cur = sessionEl?.item;
    if (!cur) body = <Block title="session"><p className="insp-line">{plural(session?.items.length ?? 0, 'element')}</p></Block>;
    else if (cur.kind === 'card') {
      body = <WithDoc id={cur.path} render={(doc) => { const i = cardIndex(doc, cur); return i < 0 ? <Gone kind="card" /> : <CardBlock path={cur.path} index={i} doc={doc} group={cur.group} {...(cur.dir ? { dir: cur.dir } : {})} now={now} />; }} />;
    } else {
      body = <WithDoc id={cur.path} render={(doc, info) => <DocInspector id={cur.path} info={info} doc={doc} now={now} />} />;
    }
  } else if (!isDoc(id)) body = <FolderInspector id={id} />;
  else {
    body = (
      <WithDoc id={id} render={(doc, info) => (
        <>
          {selected && selected.path === id && doc.blocks[selected.index]?.kind === 'card' && (
            <CardBlock path={id} index={selected.index} doc={doc} group={undefined} now={now} />
          )}
          <DocInspector id={id} info={info} doc={doc} now={now} />
        </>
      )} />
    );
  }

  return <div className="insp">{body}</div>;
}
