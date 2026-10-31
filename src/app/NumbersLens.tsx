// A lens's numbers, set as type: quiet tables under small lowercase
// labels, tabular figures, hairlines; today underlined in the one accent.
// No charts, no tiles. The model is numbers.ts.

import { useMemo } from 'react';
import { dayOf, whenToDate, type Resolved } from '../schedule/index.js';
import { docsUnder } from './deck.js';
import { fmtDays, pathLabel } from './items.js';
import { facesHTML } from './DeckBrowser.js';
import { titleOf } from './names.js';
import { linesOf, numbersOf, rateLabel, reviewsUnder, spanLabel, weekLabel, type Rate, type Spread, type Week } from './numbers.js';
import { useApp } from './store.js';
import { docsOf, openCard, optionsAt } from './vault.js';
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

/** The numbers over the lens `home`: a deck, a folder, a document's children, `''` the collection. */
export function NumbersView({ home }: { home: string }) {
  const tree = useApp((s) => s.tree);
  const order = useApp((s) => s.order);
  const files = useApp((s) => s.files);
  const docs = useApp((s) => s.docs);
  const log = useApp((s) => s.reviews);
  const day = dayOf(appNow());
  const n = useMemo(() => {
    const now = appNow();
    const lines = linesOf(docsOf(docsUnder(tree, home, order, files)));
    const mine = reviewsUnder(log, lines, new Set(files));
    const cache = new Map<string, Resolved>();
    const optionsOf = (p: string) => { let r = cache.get(p); if (!r) { r = optionsAt(p); cache.set(p, r); } return r; };
    return numbersOf(lines, mine, now, optionsOf, log.length ? dayOf(whenToDate(log[0]!.at)) : undefined);
    // `docs` changes whenever a document under the lens does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, order, files, docs, log, home, day]);
  const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
  const root = useApp((s) => s.vault);
  // where a card lives: its document's title, and the line when a card has several
  const LINE_WORD: Record<string, string> = { r: 'back to front' };
  const whereOf = (path: string, key?: string) => [titleOf(path, docs, root), key ? LINE_WORD[key] ?? `blank ${key.slice(1)}` : ''].filter(Boolean).join(', ');
  if (!n.cards) return <div className="numbers"><p className="empty">no cards</p></div>;
  const counts = [plural(n.cards, 'card'), n.fresh ? `${n.fresh} never seen` : '', n.suspended ? `${n.suspended} suspended` : ''].filter(Boolean).join(', ');
  return (
    <div className="numbers">
      <p className="nb-line">
        <span className="nb-counts">{counts}</span>
        <span className="nb-since">{n.since ? `logged since ${n.since}` : 'no reviews logged'}</span>
      </p>

      {n.since && (
        <section className="nb-sec" data-sec="past">
          <h6>reviews a day</h6>
          <Days weeks={n.past} today={n.today.day} label="past" />
        </section>
      )}

      <section className="nb-sec" data-sec="ahead">
        <h6>reviews due</h6>
        <Days weeks={n.ahead} today={n.today.day} label="ahead" />
      </section>

      {n.since && n.byWeek.some((w) => w.due) && (
        <section className="nb-sec nb-pair" data-sec="retention">
          <h6>retention</h6>
          <div className="nb-cols">
            <Rates rows={n.byWeek} head="week of" label={(r) => weekLabel(r.label)} />
            {n.byAge.length > 0 && <Rates rows={n.byAge} head="studied for" label={(r) => r.label} />}
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
                  onClick={() => {
                    // a deck's lens showing its numbers turns to its cards, where the card is
                    useApp.setState((s) => ({ lensViews: { ...s.lensViews, [l.path]: 'cards' } }));
                    openCard(l.path, l.block, l.id);
                  }}
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
