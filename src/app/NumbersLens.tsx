// A lens's numbers: a year of days shaded by the reviews done on each, the
// days ahead shaded by what comes due, and the rest set as type beside
// them (quiet tables under small lowercase labels, tabular figures,
// hairlines; today ringed in the one accent). A day pressed lists its
// reviews, or what comes due on it, each row opening its card. No tiles,
// no badges. The model is numbers.ts. The year of days has a second
// layer, `cards · reading`: the same grid shaded by what was read on and
// what was made of it (the log's reading lines), with its own lines under
// it; the two are never added together.

import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from 'react';
import { dayOf, whenToDate, type Resolved } from '../schedule/index.js';
import { docsUnder } from './deck.js';
import { fmtDays, pathLabel } from './items.js';
import { facesHTML } from './DeckBrowser.js';
import { titleOf } from './names.js';
import { FORECAST_WEEKS, READ_WORD, dayLabel, linesDue, linesOf, numbersOf, rateLabel, readDayWords, readingNumbersOf, readingsOn, readingsUnder, reviewsOn, reviewsUnder, spanLabel, weekLabel, type Cell, type Heat, type Line, type Numbers, type Rate, type ReadingNumbers, type Spread, type Week } from './numbers.js';
import type { Reading, Review } from '../format/index.js';
import { useApp } from './store.js';
import { docsOf, openCard, openNode, optionsAt } from './vault.js';
import './numbers.css';
import { appNow } from './clock.js';

const WEEKDAYS = ['m', 't', 'w', 't', 'f', 's', 's'];

function Days({ weeks, today, label }: { weeks: Week[]; today: string; label: string }) {
  return (
    <table className="nb-days" data-of={label}>
      <thead>
        <tr><th />{WEEKDAYS.map((d, i) => <th key={i}>{d}</th>)}<th className="nb-total">week</th></tr>
      </thead>
      <tbody>
        {weeks.map((w) => (
          <tr key={w.start} data-week={w.start}>
            <th>{weekLabel(w.start)}</th>
            {w.days.map((n, i) => {
              const day = addDay(w.start, i);
              return <td key={i} data-day={day} data-today={day === today ? '1' : undefined} data-zero={n === 0 ? '1' : undefined}>{n === null ? '' : n}</td>;
            })}
            <td className="nb-total">{w.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The weeks a phone's width holds. */
const PHONE_WEEKS = 26;
/** The most rows a pressed day lists. */
const DAY_ROWS = 100;
const GRADES = ['again', 'hard', 'good', 'easy'];
const count = (k: number): string => k.toLocaleString('en');
const plural = (k: number, w: string) => `${count(k)} ${w}${k === 1 ? '' : 's'}`;

type Pick = { of: 'past' | 'ahead'; day: string };

interface HeatProps {
  heat: Heat;
  of: Pick['of'];
  today: string;
  picked: string | null;
  /** What a day says of itself: its date and its counts. */
  say(c: Cell): string;
  /** What the grid is of, said aloud; the reviews' when absent. */
  label?: string;
  onHot(of: Pick['of'], c: Cell | null): void;
  onPick(of: Pick['of'], day: string): void;
}

/**
 * Weeks as columns, Monday at the top, one cell a day, shaded in four
 * steps (in e-ink a square that grows, since a shade is not told apart
 * there). Each cell is a button: it says its date and counts on hover and
 * on focus, the arrows walk the days (↑ ↓ a day, ← → a week), and a press
 * picks the day. Drawn once: what is hovered is the caption's, not the grid's.
 */
const HeatGrid = memo(function HeatGrid({ heat, of, today, picked, say, label, onHot, onPick }: HeatProps) {
  const stop = picked ?? today;
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    // esc on the grid closes the day it has open
    if (e.key === 'Escape' && picked) { e.preventDefault(); e.stopPropagation(); onPick(of, picked); return; }
    const by = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[e.key];
    const at = (e.target as HTMLElement).dataset.day;
    if (!by || !at) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.querySelector<HTMLElement>(`[data-day="${addDay(at, by)}"]`)?.focus();
  };
  return (
    <div className="nb-heat" data-of={of} style={{ '--weeks': heat.weeks.length } as CSSProperties}>
      <div className="nb-months" aria-hidden="true">
        {heat.months.map((m) => <span key={m.week} style={{ gridColumnStart: m.week + 1 }}>{m.label}</span>)}
      </div>
      <div className="nb-wd" aria-hidden="true">{['m', '', 'w', '', 'f', '', ''].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="nb-grid" role="grid" aria-label={label ?? (of === 'past' ? 'reviews a day, the past year' : 'reviews coming due')} onKeyDown={move} onMouseLeave={() => onHot(of, null)}>
        {heat.weeks.flatMap((w) => w.days.map((c, i) => (c ? (
          <button
            key={c.day}
            type="button"
            className="nb-cell"
            data-day={c.day}
            data-l={c.level}
            data-n={c.n}
            data-today={c.day === today ? '1' : undefined}
            data-on={c.day === picked ? '1' : undefined}
            aria-pressed={c.day === picked}
            aria-label={say(c)}
            title={say(c)}
            tabIndex={c.day === stop ? 0 : -1}
            onClick={() => onPick(of, c.day)}
            onMouseEnter={() => onHot(of, c)}
            onFocus={() => onHot(of, c)}
            onBlur={() => onHot(of, null)}
          />
        ) : <span key={`${w.start}${i}`} className="nb-void" />)))}
      </div>
    </div>
  );
});

/** The scale under a grid: nothing to the most, in the cells' own steps. */
function Legend({ heat, unit }: { heat: Heat; unit: string }) {
  return (
    <span className="nb-legend" title={heat.steps.map((s, i) => `${s}${i === 3 ? ' or more' : `–${heat.steps[i + 1]! - 1}`}`).join(', ') + ` ${unit}`}>
      <span>less</span>
      {[0, 1, 2, 3, 4].map((l) => <i key={l} className="nb-cell" data-l={l} />)}
      <span>more</span>
    </span>
  );
}

/** The last `k` weeks of a year of days, for a width that holds no more. */
function lastWeeks(h: Heat, k: number): Heat {
  if (h.weeks.length <= k) return h;
  const cut = h.weeks.length - k;
  return { ...h, weeks: h.weeks.slice(cut), months: h.months.filter((m) => m.week >= cut).map((m) => ({ ...m, week: m.week - cut })) };
}

/** One row of a pressed day: a card as the failed-most list draws it, with what the day holds of it. */
function CardRow({ line, where, note, open }: { line: Line; where: string; note: string; open(): void }) {
  return (
    <li data-path={line.path} data-block={line.block}>
      <button type="button" className="nb-card" title={pathLabel(line.path)} onClick={open}>
        <LeechFaces text={line.card.text} />
        <span className="nb-where" dir="auto">{where}</span>
      </button>
      <span className="nb-note">{note}</span>
    </li>
  );
}

const addDay = (day: string, n: number): string => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayOf(d);
};

function Rates({ rows, label, head }: { rows: Rate[]; label: (r: Rate) => string; head: string }) {
  return (
    <table className="nb-rates" data-of={head}>
      <thead><tr><th>{head}</th><th>passed</th><th>of</th><th /></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} data-due={r.due}>
            <th>{label(r)}</th>
            <td>{r.due ? r.passed : ''}</td>
            <td>{r.due ? r.due : ''}</td>
            <td className="nb-rate">{rateLabel(r)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SpreadRow({ name, s, fmt }: { name: string; s: Spread | null; fmt(n: number): string }) {
  if (!s) return null;
  return <tr data-of={name}><th>{name}</th>{s.at.map((v, i) => <td key={i}>{fmt(v)}</td>)}</tr>;
}

/** A card's front and back as the deck browser draws them: formulas by KaTeX, each face in its own direction. */
function LeechFaces({ text }: { text: string }) {
  const f = facesHTML(text);
  return (
    <span className="nb-faces">
      <span className="nb-front" dir={f.frontDir} dangerouslySetInnerHTML={{ __html: f.front }} />
      {f.back && <span className="nb-back" dir={f.backDir} dangerouslySetInnerHTML={{ __html: f.back }} />}
    </span>
  );
}

interface Rows { all: number; gone: number; rows: ReactElement[] }

const dueOf = (l: Line): string => { const d = l.sched!.due!; return d.length === 10 ? d : dayOf(whenToDate(d)); };

/** A past day in words: `thu, nov 12 · 43 reviews · 12 min`. */
function pastWords(n: Numbers, day: string): string {
  const a = n.counted.byDay.get(day);
  return [dayLabel(day, true), a?.n ? plural(a.n, 'review') : 'no reviews', a?.ms ? spanLabel(a.ms) : ''].filter(Boolean).join(' · ');
}

/** A day ahead in words: `thu, nov 19 · 12 due`; today says what of it is overdue. */
function aheadWords(n: Numbers, c: Cell): string {
  const late = c.day === n.today.day && n.coming.overdue ? `${count(n.coming.overdue)} overdue` : '';
  return [c.day === n.today.day ? `today, ${dayLabel(c.day)}` : dayLabel(c.day, true), c.n ? `${count(c.n)} due` : 'nothing due', late].filter(Boolean).join(' · ');
}

/** A past day's reading in words: `thu, nov 12 · 3 read, 2 made · 12 min`. */
function readWords(rn: ReadingNumbers, day: string): string {
  const a = rn.counted.byDay.get(day);
  return [dayLabel(day, true), readDayWords(a), a?.ms ? spanLabel(a.ms) : ''].filter(Boolean).join(' · ');
}

/** A pressed day of the reading layer: what was read on it, oldest first, each row opening its document (at the section, when it names one). */
function ReadDayPanel({ day, words, rows, title, open, close }: { day: string; words: string; rows: Reading[]; title(path: string): string; open(r: Reading): void; close(): void }) {
  const more = rows.length - DAY_ROWS;
  return (
    <div className="nb-day" data-of="reading" data-day={day} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <p className="nb-day-head">
        <span>{words}</span>
        <button type="button" className="nb-go" onClick={close}>close</button>
      </p>
      {rows.length > 0 && (
        <ul className="nb-rows">
          {rows.slice(0, DAY_ROWS).map((r, i) => (
            <li key={`${r.at} ${r.read} ${r.doc} ${r.sec ?? ''} ${i}`} data-path={r.doc} data-read={r.read}>
              <button type="button" className="nb-card" title={pathLabel(r.doc)} onClick={() => open(r)}>
                <span className="nb-faces"><span className="nb-front" dir="auto">{title(r.doc)}</span></span>
                {r.sec !== undefined && <span className="nb-where" dir="auto">{r.sec}</span>}
              </button>
              <span className="nb-note">{READ_WORD[r.read]}</span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p className="nb-more">and {count(more)} more</p>}
    </div>
  );
}

/** A pressed day, opened under its grid: what it holds in words, then its cards. */
function DayPanel({ of, day, words, rows, close }: { of: Pick['of']; day: string; words: string; rows: Rows; close(): void }) {
  const more = rows.all - rows.rows.length;
  return (
    <div className="nb-day" data-of={of} data-day={day} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <p className="nb-day-head">
        <span>{words}</span>
        <button type="button" className="nb-go" onClick={close}>close</button>
      </p>
      {rows.rows.length > 0 && <ul className="nb-rows">{rows.rows}</ul>}
      {more > 0 && <p className="nb-more">and {plural(more, 'card')} more</p>}
      {rows.gone > 0 && <p className="nb-more">{plural(rows.gone, 'review')} of cards no longer here</p>}
    </div>
  );
}

/** The numbers over the lens `home`: a deck, a folder, a document's children, `''` the collection. */
export function NumbersView({ home }: { home: string }) {
  const tree = useApp((s) => s.tree);
  const order = useApp((s) => s.order);
  const files = useApp((s) => s.files);
  const docs = useApp((s) => s.docs);
  const log = useApp((s) => s.reviews);
  const readLog = useApp((s) => s.readings);
  const layer = useApp((s) => s.numbersLayer);
  const phone = useApp((s) => s.phone);
  const day = dayOf(appNow());
  const { n, lines, mine, under } = useMemo(() => {
    const now = appNow();
    const under = docsUnder(tree, home, order, files);
    const lines = linesOf(docsOf(under));
    const mine = reviewsUnder(log, lines, new Set(files));
    const cache = new Map<string, Resolved>();
    const optionsOf = (p: string) => { let r = cache.get(p); if (!r) { r = optionsAt(p); cache.set(p, r); } return r; };
    return { n: numbersOf(lines, mine, now, optionsOf, log.length ? dayOf(whenToDate(log[0]!.at)) : undefined), lines, mine, under };
    // `docs` changes whenever a document under the lens does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, order, files, docs, log, home, day]);
  // what was read under the lens, counted on its own
  const { rn, reads } = useMemo(() => {
    const reads = readingsUnder(readLog, home, new Set(under));
    return { rn: readingNumbersOf(reads, appNow(), readLog.length ? dayOf(whenToDate(readLog[0]!.at)) : undefined), reads };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readLog, under, home, day]);
  // a lens without cards has its reading alone
  const show = n.cards ? layer : 'reading';
  // the day pressed, and the day under the pointer or the focus
  const [picked, setPicked] = useState<Pick | null>(null);
  const [hot, setHot] = useState<{ of: Pick['of']; cell: Cell } | null>(null);
  useEffect(() => { setPicked(null); setHot(null); }, [home, show]);
  const onHot = useCallback((of: Pick['of'], cell: Cell | null) => setHot(cell ? { of, cell } : null), []);
  const onPick = useCallback((of: Pick['of'], d: string) => setPicked((p) => (p && p.of === of && p.day === d ? null : { of, day: d })), []);
  const sayPast = useCallback((c: Cell) => pastWords(n, c.day), [n]);
  const sayAhead = useCallback((c: Cell) => aheadWords(n, c), [n]);
  const sayRead = useCallback((c: Cell) => readWords(rn, c.day), [rn]);
  const heat = useMemo(() => (n.heat && phone ? lastWeeks(n.heat, PHONE_WEEKS) : n.heat), [n.heat, phone]);
  const readHeat = useMemo(() => (phone ? lastWeeks(rn.heat, PHONE_WEEKS) : rn.heat), [rn.heat, phone]);
  const root = useApp((s) => s.vault);
  // where a card lives: its document's title, and the line when a card has several
  const LINE_WORD: Record<string, string> = { r: 'back to front' };
  const whereOf = (path: string, key?: string) => [titleOf(path, docs, root), key ? LINE_WORD[key] ?? `blank ${key.slice(1)}` : ''].filter(Boolean).join(', ');
  const open = (l: { path: string; block: number; card: { id?: string } }) => {
    // a deck's lens showing its numbers turns to its cards, where the card is
    useApp.setState((s) => ({ lensViews: { ...s.lensViews, [l.path]: 'cards' } }));
    openCard(l.path, l.block, l.card.id);
  };
  /** The cards reviewed on a day, one row a line, the grades it was given in order; reviews of cards no longer under the lens are counted, not listed. */
  const dayRows = (d: string): Rows => {
    const byKey = new Map<string, Line>();
    for (const l of lines) if (l.card.id) byKey.set(`${l.card.id} ${l.key ?? ''}`, l);
    const got = new Map<Line, Review[]>();
    let gone = 0;
    for (const r of reviewsOn(mine, n.counted, d)) {
      // a line's own key, else the card's bare line (a cloze of one blank is logged without its key)
      const l = byKey.get(`${r.card} ${r.key ?? ''}`) ?? byKey.get(`${r.card} `) ?? [...byKey.values()].find((x) => x.card.id === r.card);
      if (!l) { gone++; continue; }
      got.set(l, [...(got.get(l) ?? []), r]);
    }
    const all = [...got];
    return {
      all: all.length,
      gone,
      rows: all.slice(0, DAY_ROWS).map(([l, rs]) => <CardRow key={`${l.path}#${l.block}#${l.key ?? ''}`} line={l} where={whereOf(l.path, l.key)} note={rs.map((r) => GRADES[r.g - 1]).join(', ')} open={() => open(l)} />),
    };
  };
  const dueRows = (d: string): Rows => {
    const all = linesDue(lines, d, n.today.day);
    return {
      all: all.length,
      gone: 0,
      rows: all.slice(0, DAY_ROWS).map((l) => <CardRow key={`${l.path}#${l.block}#${l.key ?? ''}`} line={l} where={whereOf(l.path, l.key)} note={l.sched?.due && d === n.today.day && dueOf(l) < d ? `since ${dayLabel(dueOf(l))}` : ''} open={() => open(l)} />),
    };
  };
  /** A reading's document, at the section when it names one that is still there. */
  const openRead = (r: Reading) => {
    if (!files.includes(r.doc)) return;
    const at = r.sec === undefined ? -1 : (docsOf([r.doc])[0]?.[1].blocks.findIndex((b) => b.kind === 'heading' && b.text === r.sec) ?? -1);
    if (at >= 0) useApp.setState({ reveal: { path: r.doc, index: at, heading: r.sec! } });
    // a deck's lens showing these numbers would open on them again: its cards, as a card's row does
    if (r.doc === home) useApp.setState((s) => ({ lensViews: { ...s.lensViews, [r.doc]: 'cards' } }));
    openNode(r.doc);
  };
  const sum = n.summary;
  const rs = rn.summary;
  // a lens with nothing under it and nothing read has no numbers; one with documents has its reading
  if (!n.cards && !under.length && !reads.length) return <div className="numbers"><p className="empty">no cards</p></div>;
  const counts = n.cards ? [plural(n.cards, 'card'), n.fresh ? `${n.fresh} never seen` : '', n.suspended ? `${n.suspended} suspended` : ''].filter(Boolean).join(', ') : 'no cards';
  const made = [rs.extracts ? plural(rs.extracts, 'extract') : '', rs.sections ? plural(rs.sections, 'section') : ''].filter(Boolean).join(', ');
  const layers = (
    <div className="nb-layer" role="group" aria-label="the days are shaded by">
      {(['cards', 'reading'] as const).map((v) => (
        <button key={v} type="button" data-layer={v} data-on={show === v ? '1' : '0'} aria-pressed={show === v} disabled={v === 'cards' && !n.cards} onClick={() => useApp.setState({ numbersLayer: v })}>{v}</button>
      ))}
    </div>
  );
  return (
    <div className="numbers">
      <p className="nb-line">
        <span className="nb-counts">{counts}</span>
        {n.cards > 0 && <span className="nb-since">{n.since ? `logged since ${n.since}` : 'no reviews logged'}</span>}
      </p>

      {show === 'reading' && (
        <section className="nb-sec" data-sec="reading">
          <div className="nb-head"><h6>reading a day</h6>{layers}</div>
          <HeatGrid heat={readHeat} of="past" today={rn.today} picked={picked?.of === 'past' ? picked.day : null} say={sayRead} label="reading a day, the past year" onHot={onHot} onPick={onPick} />
          <p className="nb-cap">
            <span className="nb-hot" aria-live="polite">{hot?.of === 'past' ? readWords(rn, hot.cell.day) : picked?.of === 'past' ? readWords(rn, picked.day) : rn.since === undefined ? 'no reading logged yet' : rn.n ? 'press a day for what was read' : 'nothing read here yet'}</span>
            <Legend heat={readHeat} unit="read or made" />
          </p>
          {picked?.of === 'past' && <ReadDayPanel day={picked.day} words={readWords(rn, picked.day)} rows={readingsOn(reads, rn.counted, picked.day)} title={(p) => titleOf(p, docs, root)} open={openRead} close={() => setPicked(null)} />}
          <dl className="nb-sum" data-of="reading">
            <div data-sum="read"><dt>read</dt><dd>{count(rs.read)} of {plural(rs.days, 'day')}{rn.since ? `, logged since ${rn.since}` : ''}</dd></div>
            <div data-sum="passes"><dt>read on</dt><dd>{plural(rs.passes, 'time')}{rs.ms ? `, ${spanLabel(rs.ms)}` : ''}</dd></div>
            <div data-sum="made"><dt>made</dt><dd>{made || 'nothing yet'}</dd></div>
            {rs.best && <div data-sum="best"><dt>best day</dt><dd><button type="button" className="nb-go" onClick={() => setPicked({ of: 'past', day: rs.best!.day })}>{dayLabel(rs.best.day)}</button>, {readDayWords(rn.counted.byDay.get(rs.best.day))}</dd></div>}
          </dl>
          <table className="nb-periods" data-of="reading">
            <thead><tr><th /><th>read on</th><th>extracts</th><th>sections</th><th>time</th></tr></thead>
            <tbody>
              {rs.periods.map((p) => (
                <tr key={p.label} data-period={p.label}>
                  <th>{p.label}</th>
                  <td>{count(p.passes)}</td>
                  <td>{count(p.extracts)}</td>
                  <td>{count(p.sections)}</td>
                  <td>{p.ms ? spanLabel(p.ms) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {show === 'cards' && (!heat || !sum) && (
        <section className="nb-sec" data-sec="past">
          <div className="nb-head"><h6>reviews a day</h6>{layers}</div>
        </section>
      )}

      {show === 'cards' && heat && sum && (
        <section className="nb-sec" data-sec="past">
          <div className="nb-head"><h6>reviews a day</h6>{layers}</div>
          <HeatGrid heat={heat} of="past" today={n.today.day} picked={picked?.of === 'past' ? picked.day : null} say={sayPast} onHot={onHot} onPick={onPick} />
          <p className="nb-cap">
            <span className="nb-hot" aria-live="polite">{hot?.of === 'past' ? pastWords(n, hot.cell.day) : picked?.of === 'past' ? pastWords(n, picked.day) : 'press a day for its reviews'}</span>
            <Legend heat={heat} unit="reviews" />
          </p>
          {picked?.of === 'past' && <DayPanel of="past" day={picked.day} words={pastWords(n, picked.day)} rows={dayRows(picked.day)} close={() => setPicked(null)} />}
          <dl className="nb-sum">
            <div data-sum="studied"><dt>studied</dt><dd>{count(sum.studied)} of {plural(sum.days, 'day')}</dd></div>
            <div data-sum="average"><dt>a day</dt><dd>{count(Math.round(sum.reviews / sum.days))}{sum.studied > 0 && Math.round(sum.reviews / sum.studied) !== Math.round(sum.reviews / sum.days) ? `, ${count(Math.round(sum.reviews / sum.studied))} on a day studied` : ''}</dd></div>
            {sum.best && <div data-sum="best"><dt>best day</dt><dd><button type="button" className="nb-go" onClick={() => setPicked({ of: 'past', day: sum.best!.day })}>{dayLabel(sum.best.day)}</button>, {plural(sum.best.n, 'review')}</dd></div>}
            <div data-sum="run"><dt>in a row</dt><dd>{plural(sum.run, 'day')}, longest {count(sum.longest)}</dd></div>
            {sum.rate.due > 0 && <div data-sum="retention"><dt>retention</dt><dd title="of the reviews of cards already in review, those not answered again">{rateLabel(sum.rate)} of {plural(sum.rate.due, 'review')}</dd></div>}
            {sum.reviews > 0 && <div data-sum="answers"><dt>answers</dt><dd>{GRADES.map((g, i) => `${g} ${Math.round((100 * sum.mix[i]!) / sum.reviews)}%`).join(', ')}</dd></div>}
          </dl>
          <table className="nb-periods">
            <thead><tr><th /><th>reviews</th><th>time</th><th>started</th><th>matured</th><th>retention</th></tr></thead>
            <tbody>
              {sum.periods.map((p) => (
                <tr key={p.label} data-period={p.label}>
                  <th>{p.label}</th>
                  <td>{count(p.reviews)}</td>
                  <td>{p.ms ? spanLabel(p.ms) : ''}</td>
                  <td>{count(p.started)}</td>
                  <td>{count(p.matured)}</td>
                  <td className="nb-rate">{rateLabel(p.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {n.cards > 0 && <section className="nb-sec" data-sec="ahead">
        <h6>reviews due</h6>
        <div className="nb-beside">
          <div>
            <HeatGrid heat={n.forecast} of="ahead" today={n.today.day} picked={picked?.of === 'ahead' ? picked.day : null} say={sayAhead} onHot={onHot} onPick={onPick} />
            <p className="nb-cap">
              <span className="nb-hot" aria-live="polite">{hot?.of === 'ahead' ? aheadWords(n, hot.cell) : picked?.of === 'ahead' ? aheadWords(n, { day: picked.day, n: dueRows(picked.day).all, level: 0 }) : 'press a day for what comes due'}</span>
              <Legend heat={n.forecast} unit="due" />
            </p>
          </div>
          <dl className="nb-sum" data-of="coming">
            <div data-sum="today"><dt>today</dt><dd>{count(n.coming.today)}{n.coming.overdue ? `, ${count(n.coming.overdue)} of them overdue` : ''}</dd></div>
            <div data-sum="tomorrow"><dt>tomorrow</dt><dd>{count(n.coming.tomorrow)}</dd></div>
            <div data-sum="week"><dt>next 7 days</dt><dd>{count(n.coming.week)}, {count(Math.round(n.coming.week / 7))} a day</dd></div>
            <div data-sum="month"><dt>next 30 days</dt><dd>{count(n.coming.month)}, {count(Math.round(n.coming.month / 30))} a day</dd></div>
            {n.coming.heaviest && <div data-sum="heaviest"><dt>heaviest</dt><dd><button type="button" className="nb-go" onClick={() => setPicked({ of: 'ahead', day: n.coming.heaviest!.day })}>{dayLabel(n.coming.heaviest.day)}</button>, {count(n.coming.heaviest.n)}</dd></div>}
          </dl>
        </div>
        {picked?.of === 'ahead' && <DayPanel of="ahead" day={picked.day} words={aheadWords(n, { day: picked.day, n: dueRows(picked.day).all, level: 0 })} rows={dueRows(picked.day)} close={() => setPicked(null)} />}
        <Days weeks={n.ahead} today={n.today.day} label="ahead" />
      </section>}

      {n.since && n.byWeek.some((w) => w.due) && (
        <section className="nb-sec nb-pair" data-sec="retention">
          <h6>retention</h6>
          <div className="nb-cols">
            <Rates rows={n.byWeek} head="week of" label={(r) => weekLabel(r.label)} />
            {n.byAge.length > 0 && <Rates rows={n.byAge} head="studied for" label={(r) => r.label} />}
            {sum && sum.byHour.length > 1 && <Rates rows={sum.byHour} head="time of day" label={(r) => r.label} />}
          </div>
        </section>
      )}

      {n.leeches.length > 0 && (
        <section className="nb-sec" data-sec="leeches">
          <h6>failed most</h6>
          <ul className="nb-leeches">
            {n.leeches.map((l) => (
              <li key={`${l.path}#${l.block}#${l.key ?? ''}`} data-leech={l.leech ? '1' : '0'} data-path={l.path} data-block={l.block}>
                <button
                  type="button"
                  className="nb-card"
                  title={pathLabel(l.path)}
                  onClick={() => open({ path: l.path, block: l.block, card: l.id === undefined ? {} : { id: l.id } })}
                >
                  <LeechFaces text={l.text} />
                  <span className="nb-where" dir="auto">{whereOf(l.path, l.key)}</span>
                </button>
                <span className="nb-lapses">{l.lapses}</span>
                <span className="nb-tag">{l.suspended ? 'suspended' : l.leech ? 'leech' : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(n.stability || n.difficulty) && (
        <section className="nb-sec" data-sec="spread">
          <h6>spread</h6>
          <table className="nb-spread">
            <thead><tr><th /><th>10%</th><th>25%</th><th>median</th><th>75%</th><th>90%</th></tr></thead>
            <tbody>
              <SpreadRow name="stability" s={n.stability} fmt={(v) => fmtDays(Math.max(1, Math.round(v)))} />
              <SpreadRow name="difficulty" s={n.difficulty} fmt={(v) => v.toFixed(1)} />
            </tbody>
          </table>
        </section>
      )}

      {n.time && (
        <p className="nb-line nb-time" data-sec="time">
          <span>{spanLabel(n.time.median)} a review</span>
          <span className="nb-since">{spanLabel(n.time.total)} over {plural(n.past.length, 'week')}</span>
        </p>
      )}
    </div>
  );
}

/** The whole collection's numbers: its root as a lens, turned to them. */
export function openCollectionNumbers(): void {
  useApp.setState((s) => ({ lensViews: { ...s.lensViews, '': 'numbers' } }));
  openNode('');
}
