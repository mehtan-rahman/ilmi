// The queue: a saved query over the vault, after the prototype's views.jsx.
// One line by priority, every kind mixed (reading, sections that come back,
// drafts, cards), each row saying where it stands under its title.
// `today` is the outstanding queue and enters a session; the other scopes
// are lists that open one element at a time. `j` `k` move, `⏎` enters,
// `o` opens the one under the cursor. The day can be narrowed to one thing
// to do (`all · recall · read · write`, `f` round them): the same list, that
// kind only, and ⏎ walks it. A budget folds the day: the rows
// above the fold are the day's work, the rest sit dimmed below a rule, and
// `postpone the rest` pushes the backlog among the reading and writing out.

import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { PRI_DEFAULT, cardFields } from '../format/index.js';
import { counts, dayOf, examKey, inScope, overflow, type ExamAt, type QueueItem } from '../schedule/index.js';
import { FOCUSES, FOCUS_EMPTY, QUEUE_EMPTY, focusOf, inFocus, nextFocus, nextLook, nextUp, dayLabel, dueWhen, examName, examWhen, forExam, glyphOf, intervalLabel, isFresh, kindTag, markOf, paceWords, snippetOf, standing, dueTone } from './items.js';
import { pathParts, plainMath } from './chromeText.js';
import { MathText } from './MathText.js';
import type { DocInfo } from './store.js';
import { QUEUE_TITLE, SCOPES, queueId, type QueueScope } from './names.js';
import type { OpenOpts } from './panes.js';
import { clozeHTML, faceDir, richHTML } from './Reader.js';
import { dirAttr } from '../reader/index.js';
import { useApp } from './store.js';
import { currentVault, openCard, openNode, openSession, postponeRest, refreshQueue, setFocus, startSession, unlogReading } from './vault.js';
import { actOnDoc, actionWords, atEndOf, docLine, putBackDoc, twoLines, type DocAction } from './Session.js';
import { failed, notify } from './land.js';
import { passageOf, putPassage } from './passages.js';
import type { ReadItem, SectionItem, WriteItem } from '../schedule/index.js';
import './queue.css';
import { appNow } from './clock.js';
import { Glyph } from './icons.js';

interface Props {
  scope: QueueScope;
  active: boolean;
}

/**
 * A list up to `QUEUE_WHOLE` rows is drawn whole. A longer one (a
 * collection can hold more than a page should) draws `QUEUE_ROWS` at
 * first and as many more each time its end is asked for.
 */
export const QUEUE_WHOLE = 1500;
export const QUEUE_ROWS = 300;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!el?.isContentEditable;
};

const clickOpts = (e: MouseEvent): OpenOpts => ({ cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey });

/** A row's main line: the card with its blanks covered, or the next words of a document. */
function Body({ item }: { item: QueueItem }) {
  // a section is named by its heading
  if (item.kind === 'section') return <span className="sec-title" dir={faceDir(item.heading)}><MathText text={item.heading} title={false} /></span>;
  if (item.kind !== 'card') {
    const s = snippetOf(item);
    return s ? <span className="read-snip" dir={faceDir(s)}><MathText text={s} title={false} /><span className="read-ell"> …</span></span> : null;
  }
  // the reader's rules: emphasis, code, and math read as themselves in the row too
  const f = cardFields(item.text);
  if (!f) return <span dir={faceDir(item.text)} dangerouslySetInnerHTML={{ __html: richHTML(item.text) }} />;
  if (f.form === 'cloze') return <span dir={faceDir(item.text)} dangerouslySetInnerHTML={{ __html: clozeHTML(item.text, () => 'hidden', () => 'cloze') }} />;
  if (f.form === 'qa') return <span dir={faceDir(f.front)} dangerouslySetInnerHTML={{ __html: richHTML(f.front) }} />;
  // both ways: the side this item asks first, the arrow pointing to the answer
  const [ask, answer] = item.dir === 'r' ? [f.right, f.left] : [f.left, f.right];
  return <span dir={faceDir(ask)} data-dir={item.dir ?? 'f'} dangerouslySetInnerHTML={{ __html: `<bdi${dirAttr(ask)}>${richHTML(ask)}</bdi> <span class="cs-arrow">→</span> <bdi${dirAttr(answer)}>${richHTML(answer)}</bdi>` }} />;
}

/**
 * Where a row's element lives, one line: its parent's short title (the
 * course, the book, else the folder), the document, a card's heading, `›`
 * between. The parent gives way first, then the heading, then the
 * document; the whole path is the tooltip. By title (the tweak), no parent.
 */
export function QueuePath({ item, docs, by }: { item: QueueItem; docs: Record<string, DocInfo>; by: 'title' | 'path' }) {
  const p = pathParts(item, docs);
  // a section's heading is its row's title already
  if (item.kind === 'section') delete p.section;
  const parts = [by === 'path' ? p.parent : undefined, p.doc, p.section].filter((x): x is string => !!x);
  return (
    <span className="qpath" title={plainMath(parts.join(' › '))}>
      {by === 'path' && p.parent && <><bdi className="qp-parent">{p.parent}</bdi><span className="qp-sep">{' › '}</span></>}
      <bdi className="qp-doc"><MathText text={p.doc} /></bdi>
      {p.section && <><span className="qp-sep">{' › '}</span><bdi className="qp-sec"><MathText text={p.section} /></bdi></>}
    </span>
  );
}

/** A topic's row on a phone (milestone 56): ⏎ `p` `d` as buttons, acting from the row. What was written can be undone from the notice. */
function TopicActs({ item, now }: { item: ReadItem | WriteItem | SectionItem; now: Date }) {
  const pages = useApp((s) => !!s.docs[item.path]?.pdf);
  const atEnd = atEndOf(item, pages, null);
  const words = actionWords(item, now, atEnd);
  const act = (e: MouseEvent, action: DocAction) => {
    e.stopPropagation();
    const vault = currentVault();
    if (!vault) return;
    const line = docLine(item, action, now);
    // a passage is in no document: what puts its line back is handed over
    if (item.kind === 'section' && item.passage) {
      let putBack = null as (() => Promise<void>) | null;
      void actOnDoc(item, action, undefined, undefined, undefined, (undo) => { putBack = undo; })
        .then(() => notify(line, null, putBack ? async () => { await putBack!(); unlogReading(item.path, item.heading); } : undefined))
        .catch(failed(action === 'on' ? 'next' : action === 'postpone' ? 'later' : 'dismiss'));
      return;
    }
    void vault.read(item.path).then(({ doc }) => {
      const before = structuredClone(doc);
      return actOnDoc(item, action).then(() => notify(line, null, () => putBackDoc(item, before).then(() => unlogReading(item.path, item.kind === 'section' ? item.heading : undefined))));
    }).catch(failed(action === 'on' ? 'next' : action === 'postpone' ? 'later' : 'dismiss'));
  };
  return (
    <>
      <span className="topic-acts">
        <button type="button" data-act="on" onClick={(e) => act(e, atEnd ? 'done' : 'on')}>{twoLines(words.on)}</button>
        <button type="button" data-act="postpone" onClick={(e) => act(e, 'postpone')}>{words.postpone}</button>
        <button type="button" data-act="done" onClick={(e) => act(e, 'done')}>{words.done}</button>
      </span>
      {/* the same two again past the row's right end, where a swipe left finds them (`rowSwipe.ts`); `later` the outer one, which a swipe right across is */}
      <span className="swipe-acts" aria-hidden="true">
        <button type="button" tabIndex={-1} data-act="done" onClick={(e) => act(e, 'done')}>{words.done}</button>
        <button type="button" tabIndex={-1} data-act="postpone" onClick={(e) => act(e, 'postpone')}>{words.postpone}</button>
      </span>
    </>
  );
}

/**
 * `v`, or the value it was last time when that says the same: the queue is built anew each time it is looked at, and
 * a list that has not changed is not drawn again for it.
 */
function useSame<T>(v: T): T {
  const last = useRef<{ v: T; said: string } | null>(null);
  if (last.current?.v === v) return v;
  const said = JSON.stringify(v);
  if (last.current && last.current.said === said) return last.current.v;
  last.current = { v, said };
  return v;
}

export function Queue({ scope, active }: Props) {
  const all = useSame(useApp((s) => s.queue));
  const docs = useApp((s) => s.docs);
  const log = useApp((s) => s.log);
  const budget = useApp((s) => s.budget);
  // the row names its file by its path; the tweak brings the title back
  const by = useApp((s) => (s.queueTitles ? 'title' : 'path'));
  const focusBudget = useApp((s) => s.focusBudget);
  const examFilter = useApp((s) => s.examFilter);
  const phone = useApp((s) => s.phone);
  // the day narrowed to one thing to do; the other scopes are lists, whole
  const focus = useApp((s) => (scope === 'today' ? s.queueFocus : 'all'));
  const [cursor, setCursor] = useState(0);
  const [rows, setRows] = useState(QUEUE_ROWS);
  const now = appNow();
  const scoped = all.filter((i) => inScope(i, scope, now));
  // the exams ahead the scope's elements are studied toward, soonest first; the queue can be narrowed to one
  const exams = [...new Map(scoped.filter((i) => i.exam).map((i) => [examKey(i.exam!), i.exam!] as [string, ExamAt])).values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  const filter = examFilter !== null && exams.some((e) => examKey(e) === examFilter) ? examFilter : null;
  const toward = filter === null ? scoped : scoped.filter((i) => i.exam && examKey(i.exam) === filter);
  // how many of each thing to do, of what the exam leaves; the focus shows one
  const tally = { all: toward.length, recall: 0, read: 0, write: 0 };
  for (const i of toward) tally[focusOf(i)]++;
  const items = focus === 'all' ? toward : toward.filter((i) => inFocus(i, focus));
  // the fold: where the day's budget ends; under it, the backlog (due before today) can be postponed. The budget is the whole day's: narrowed, the list has no fold
  // (unless the tweak keeps a focus to the budget: then the fold is where the day's falls among the focus's rows)
  const dayFold = scope === 'today' && filter === null && budget > 0 && toward.length > budget;
  const foldAt = !dayFold ? items.length : focus === 'all' ? budget : focusBudget ? toward.slice(0, budget).filter((i) => inFocus(i, focus)).length : items.length;
  const rest = foldAt < items.length ? overflow(all, now) : [];
  const restWord = [rest.filter((i) => i.kind !== 'write').length, rest.filter((i) => i.kind === 'write').length]
    .map((n, i) => (n ? `${n} to ${i ? 'write' : 'read'}` : ''))
    .filter(Boolean)
    .join(' · ');

  // a card in learning steps comes due by the minute; look again when shown
  useEffect(() => { if (active) refreshQueue(); }, [active, scope]);
  // and while it stays open: when the window is come back to, when the next element ahead comes due, at the day's turn
  // (as the app does whatever else is in front, `App.tsx`: its strip and a phone's bar read the same queue)
  useEffect(() => {
    if (!active) return;
    const look = () => { if (document.visibilityState !== 'hidden') refreshQueue(); };
    window.addEventListener('focus', look);
    document.addEventListener('visibilitychange', look);
    const t = setTimeout(look, Math.min(nextLook(all, appNow()), 2 ** 31 - 1));
    return () => {
      window.removeEventListener('focus', look);
      document.removeEventListener('visibilitychange', look);
      clearTimeout(t);
    };
  }, [active, all]);

  useEffect(() => {
    if (cursor > items.length - 1) setCursor(Math.max(0, items.length - 1));
  }, [items.length, cursor]);

  // the rows drawn: the first page, on past the cursor and the fold as they move
  const drawn = items.length <= QUEUE_WHOLE ? items.length : Math.min(items.length, Math.max(rows, cursor + 40, foldAt < items.length ? foldAt + 40 : 0));

  // the cards query opens the card where it lives; the other scopes review it
  const open = (item: QueueItem, opts: OpenOpts = {}) => {
    if (scope === 'cards' && item.kind === 'card') openCard(item.path, item.block, item.id, opts);
    else openSession(item, opts, filter, focus);
  };

  // the cursor moved by a key is brought into view; under the pointer it is there already
  const listRef = useRef<HTMLOListElement>(null);
  const byKey = useRef(false);
  useEffect(() => {
    if (!byKey.current) return;
    byKey.current = false;
    listRef.current?.querySelector('li[data-active="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // the backlog postponed, each file as it was kept for the notice's undo
  const postpone = () => {
    const vault = currentVault();
    if (!vault) return;
    const paths = [...new Set(rest.filter((i) => !(i.kind === 'section' && i.passage)).map((i) => i.path))];
    // the passages among them are in no file: each as it was, for the same undo
    const kept = rest.flatMap((i) => (i.kind === 'section' && i.passage ? [{ ...i.passage, was: passageOf(i.passage.hash, i.passage.boxes) }] : []));
    const moved = rest.filter((i) => !(i.kind === 'section' && i.passage));
    void Promise.all(paths.map((path) => vault.read(path).then(({ doc }) => ({ path, doc: structuredClone(doc) }))))
      .then((before) => postponeRest(true).then((n) => {
        // taken back, each element's own line as it was: what else was written to its document since stays
        if (n) notify(`postponed · ${plural(n, 'item')}`, null, async () => {
          for (const i of moved) { const was = before.find((b) => b.path === i.path); if (was) await putBackDoc(i, was.doc); }
          for (const k of kept) if (k.was) await putPassage(k.hash, k.boxes, k.was);
        });
      }))
      .catch(failed('postpone'));
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inField(e.target)) return;
      const it = items[cursor];
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); byKey.current = true; setCursor((c) => Math.min(items.length - 1, c + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); byKey.current = true; setCursor((c) => Math.max(0, c - 1)); }
      // a key held down enters once: its repeats are not the session's keys
      else if (e.key === 'Enter') { e.preventDefault(); if (e.repeat) return; if (scope === 'today') startSession({}, filter, focus); else if (it) open(it); }
      else if (e.key === 'o' && it) { e.preventDefault(); if (!e.repeat) open(it); }
      // the focus, round: all, recall, read, write; ⇧F back
      else if ((e.key === 'f' || e.key === 'F') && scope === 'today') { e.preventDefault(); if (!e.repeat) { setCursor(0); setFocus(nextFocus(focus, e.shiftKey ? -1 : 1)); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, items, cursor, scope, filter, focus]);

  // the rows, drawn again only when what they show has changed: not when the queue is merely no longer in front (a
  // phone's day stays under the page opened from it, `Canvas.tsx`, and a long day's rows are the cost of drawing it)
  const minute = Math.floor(now.getTime() / 60_000);
  const list = useMemo(() => (
    <ol className="qlist" ref={listRef}>
      {items.slice(0, drawn).map((item, i) => {
        const ref = standing(item, now, docs[item.path]?.pages?.first);
        const pace = paceWords(item, now);
        const ivl = item.kind === 'card' ? intervalLabel(item) : '';
        const row = (
          <li
            key={`${item.kind}:${item.path}:${item.kind === 'card' ? `${item.block}:${JSON.stringify(item.group ?? null)}:${item.dir ?? ''}` : item.kind === 'section' ? `${item.block}:${item.passage ? `${item.passage.hash}:${item.passage.boxes}` : item.heading}` : ''}`}
            data-active={i === cursor ? '1' : '0'}
            data-el={item.kind}
            data-fresh={isFresh(item) ? '1' : '0'}
            data-below={i >= foldAt ? '1' : '0'}
            data-swipe={phone && item.kind !== 'card' ? '1' : undefined}
            onMouseEnter={phone ? undefined : () => setCursor(i)}
            onClick={(e) => open(item, clickOpts(e))}
          >
            <span className="mark" data-el={markOf(item)}><Glyph g={glyphOf(item)} /></span>
            <span className="body">
              <span className="src" data-by={by}>
                <span className="kindtag" data-el={item.kind} data-tag={kindTag(item)}>{kindTag(item)}</span>
                <QueuePath item={item} docs={docs} by={by} />
              </span>
              <Body item={item} />
              {ref && <span className="ref-line">{ref}</span>}
              {pace && <span className="for-exam" data-pace="1">{pace}</span>}
              {item.pulled && item.exam && !(item.kind === 'read' && item.byFinish) && <span className="for-exam" title={`brought forward from ${dueWhen(item.pulled, now)}`}>{forExam(item.exam)}</span>}
            </span>
            <span className="pri">{item.pri !== PRI_DEFAULT && <b>p {item.pri}</b>}</span>
            <span className="due" title={ivl ? `interval ${ivl}` : undefined} data-st={dueTone(item.kind === 'card' && (item.buried || item.held) ? 'tomorrow' : item.pulled ? dueWhen(dayOf(item.dueAt), now) : dueWhen(item.due, now))}>{item.kind === 'card' && (item.buried || item.held) ? 'tomorrow' : item.pulled ? dueWhen(dayOf(item.dueAt), now) : dueWhen(item.due, now)}</span>
            {phone && item.kind !== 'card' && <TopicActs item={item} now={now} />}
          </li>
        );
        if (i !== foldAt) return row;
        return (
          <Fragment key="fold">
            <li className="fold" data-below="0">
              <span className="fold-n">{items.length - foldAt} more</span>
              {rest.length > 0 && (
                <button type="button" className="fold-act" onClick={postpone}>
                  postpone the rest<span className="fold-what">{restWord}</span>
                </button>
              )}
            </li>
            {row}
          </Fragment>
        );
      })}
      {drawn < items.length && (
        <li className="fold" data-below={drawn >= foldAt ? '1' : '0'} onClick={() => setRows(drawn + QUEUE_ROWS)}>
          <span className="fold-n">{items.length - drawn} more</span>
        </li>
      )}
    </ol>
  ), [all, docs, budget, by, focusBudget, examFilter, phone, focus, cursor, rows, scope, minute]);

  return (
    <div className="queue">
      <header>
        <h1>
          {QUEUE_TITLE[scope]}
          <span className="day">{scope === 'today' ? dayLabel(now) : plural(items.length, 'item')}</span>
        </h1>
        {scope === 'today' && (
          <div className="legend">
            <b>{items.length}</b> due, {focus !== 'all' && <span className="legend-focus">{focus} only, </span>}in priority order
          </div>
        )}
        {scope === 'today' && (
          <div className="focus-row" role="group" aria-label="focus" data-focus={focus}>
            {FOCUSES.map((f) => (
              <button key={f} type="button" data-focus={f} data-on={focus === f ? '1' : '0'} data-none={tally[f] ? '0' : '1'} aria-pressed={focus === f} title={f === 'all' ? 'everything due, every kind mixed' : `only what there is to ${f}`} onClick={() => { setCursor(0); setFocus(f); }}>
                {f}<span className="focus-n">{tally[f]}</span>
              </button>
            ))}
          </div>
        )}
        {scope === 'today' && items.length > 0 && (
          <button type="button" className="enter-queue" onClick={() => startSession({}, filter, focus)}>
            <span className="eq-main">enter queue</span>
            <kbd>⏎</kbd>
          </button>
        )}
        {exams.length > 0 && (
          <div className="exam-filter">
            {exams.map((e) => {
              const k = examKey(e);
              return (
                <button key={k} type="button" data-active={filter === k ? '1' : '0'} title={`only what is studied toward it, ${examWhen(e.day, now)}`} onClick={() => useApp.setState({ examFilter: filter === k ? null : k })}>
                  {examName(e)}
                </button>
              );
            })}
          </div>
        )}
        {scope === 'today' && log.length > 0 && (
          <div className="qlog">{log.slice(0, 2).map((l, i) => <div key={i} className="qlog-line">{l}</div>)}</div>
        )}
      </header>

      {items.length === 0 ? (
        <div className="empty">
          {scope === 'today' ? FOCUS_EMPTY[focus] : QUEUE_EMPTY[scope]}
          {scope === 'today' && nextUp(all.filter((i) => inFocus(i, focus)), now) && <div className="empty-next">{nextUp(all.filter((i) => inFocus(i, focus)), now)}</div>}
        </div>
      ) : (
        list
      )}
    </div>
  );
}

/** The sidebar's saved queries: one row per scope, with its count. */
export function SavedQueries({ activeId }: { activeId: string | undefined }) {
  const all = useApp((s) => s.queue);
  const c = counts(all, appNow());
  return (
    <>
      <h6>saved queries</h6>
      <div className="tree queries">
        {SCOPES.map((scope) => {
          const id = queueId(scope);
          return (
            <div
              key={scope}
              className="row"
              data-active={activeId === id ? '1' : '0'}
              onClick={(e) => openNode(id, { newTab: !(e.metaKey || e.ctrlKey), cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey })}
            >
              <span className="chev"> </span>
              <span className="glyph"><Glyph g="≡" /></span>
              <span className="name">{QUEUE_TITLE[scope]}</span>
              <span className="meta">{c[scope]}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
