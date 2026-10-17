// The queue: a saved query over the vault, after the prototype's views.jsx.
// `today` is the outstanding queue and enters a session; the other scopes
// are lists that open one element at a time. `j` `k` move, `⏎` enters,
// `o` opens the one under the cursor. A budget folds the day: the rows
// above the fold are the day's work, the rest sit dimmed below a rule, and
// `postpone the rest` pushes the reading and writing among them out.

import { Fragment, useEffect, useState, type MouseEvent } from 'react';
import { PRI_DEFAULT, cardFields, clozeParts } from '../format/index.js';
import { counts, inScope, overflow, type QueueItem } from '../schedule/index.js';
import { EL_GLYPH, QUEUE_EMPTY, dayLabel, dueLabel, intervalLabel, isFresh, kindTag, refLine, snippetOf, sourceLabel, summary } from './items.js';
import { QUEUE_TITLE, SCOPES, queueId, type QueueScope } from './names.js';
import type { OpenOpts } from './panes.js';
import { useApp } from './store.js';
import { openCard, openNode, openSession, postponeRest, refreshQueue, startSession } from './vault.js';
import './queue.css';

interface Props {
  scope: QueueScope;
  active: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!el?.isContentEditable;
};

const clickOpts = (e: MouseEvent): OpenOpts => ({ cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey });

/** A row's main line: the card with its blanks covered, or the next words of a document. */
function Body({ item }: { item: QueueItem }) {
  if (item.kind !== 'card') {
    const s = snippetOf(item);
    return s ? <span className="read-snip">{s}<span className="read-ell"> …</span></span> : null;
  }
  const f = cardFields(item.text);
  if (!f) return <span>{item.text}</span>;
  if (f.form === 'cloze') {
    return <span>{clozeParts(item.text).map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : <span key={i} className="cloze">{p.answer}</span>))}</span>;
  }
  if (f.form === 'qa') return <span>{f.front}</span>;
  return <span>{f.left} <span className="cs-arrow">⇄</span> {f.right}</span>;
}

export function Queue({ scope, active }: Props) {
  const all = useApp((s) => s.queue);
  const docs = useApp((s) => s.docs);
  const log = useApp((s) => s.log);
  const budget = useApp((s) => s.budget);
  const [cursor, setCursor] = useState(0);
  const now = new Date();
  const items = all.filter((i) => inScope(i, scope, now));
  // the fold: where the day's budget ends, and what below it can be postponed
  const foldAt = scope === 'today' && budget > 0 && items.length > budget ? budget : items.length;
  const rest = foldAt < items.length ? overflow(all, now, budget) : [];
  const restWord = [rest.filter((i) => i.kind === 'read').length, rest.filter((i) => i.kind === 'write').length]
    .map((n, i) => (n ? `${n} to ${i ? 'write' : 'read'}` : ''))
    .filter(Boolean)
    .join(' · ');

  // a card in learning steps comes due by the minute; look again when shown
  useEffect(() => { if (active) refreshQueue(); }, [active, scope]);

  useEffect(() => {
    if (cursor > items.length - 1) setCursor(Math.max(0, items.length - 1));
  }, [items.length, cursor]);

  // the cards query opens the card where it lives; the other scopes review it
  const open = (item: QueueItem, opts: OpenOpts = {}) => {
    if (scope === 'cards' && item.kind === 'card') openCard(item.path, item.block, item.id, opts);
    else openSession(item, opts);
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inField(e.target)) return;
      const it = items[cursor];
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(items.length - 1, c + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (scope === 'today') startSession(); else if (it) open(it); }
      else if (e.key === 'o' && it) { e.preventDefault(); open(it); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, items, cursor, scope]);

  const sum = summary(items);

  return (
    <div className="queue">
      <header>
        <h1>
          {QUEUE_TITLE[scope]}
          <span className="day">{scope === 'today' ? dayLabel(now) : plural(items.length, 'element')}</span>
        </h1>
        {scope === 'today' && (
          <div className="summary">
            <span><b>{sum.read}</b> to read</span>
            <span><b>{sum.write}</b> to write</span>
            <span><b>{sum.card}</b> to review</span>
          </div>
        )}
        {scope === 'today' && items.length > 0 && (
          <button type="button" className="enter-queue" onClick={() => startSession()}>
            <span className="eq-main">enter queue</span>
            <kbd>⏎</kbd>
          </button>
        )}
        {scope === 'today' && log.length > 0 && (
          <div className="qlog">{log.slice(0, 2).map((l, i) => <div key={i} className="qlog-line">{l}</div>)}</div>
        )}
      </header>

      {items.length === 0 ? (
        <div className="empty">{QUEUE_EMPTY[scope]}</div>
      ) : (
        <ol className="qlist">
          {items.map((item, i) => {
            const ref = refLine(item);
            const ivl = item.kind === 'card' ? intervalLabel(item) : '';
            const row = (
              <li
                key={`${item.kind}:${item.path}:${item.kind === 'card' ? `${item.block}:${JSON.stringify(item.group ?? null)}` : ''}`}
                data-active={i === cursor ? '1' : '0'}
                data-el={item.kind}
                data-fresh={isFresh(item) ? '1' : '0'}
                data-below={i >= foldAt ? '1' : '0'}
                onMouseEnter={() => setCursor(i)}
                onClick={(e) => open(item, clickOpts(e))}
              >
                <span className="mark" data-el={item.kind}>{EL_GLYPH[item.kind]}</span>
                <span className="body">
                  <span className="src">
                    <span className="kindtag" data-el={item.kind}>{kindTag(item)}</span>
                    {sourceLabel(item, docs)}
                  </span>
                  <Body item={item} />
                  {ref && <span className="ref-line">{ref}</span>}
                </span>
                <span className="pri">{item.pri !== PRI_DEFAULT && <b>p {item.pri}</b>}</span>
                <span className="due">
                  {dueLabel(item.due, now)}
                  {ivl && <div className="ivl">{ivl}</div>}
                </span>
              </li>
            );
            if (i !== foldAt) return row;
            return (
              <Fragment key="fold">
                <li className="fold" data-below="0">
                  <span className="fold-n">{items.length - foldAt} more</span>
                  {rest.length > 0 && (
                    <button type="button" className="fold-act" onClick={() => void postponeRest().catch(console.error)}>
                      postpone the rest<span className="fold-what">{restWord}</span>
                    </button>
                  )}
                </li>
                {row}
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** The sidebar's saved queries: one row per scope, with its count. */
export function SavedQueries({ activeId }: { activeId: string | undefined }) {
  const all = useApp((s) => s.queue);
  const c = counts(all, new Date());
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
              <span className="glyph">≡</span>
              <span className="name">{QUEUE_TITLE[scope]}</span>
              <span className="meta">{c[scope]}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
