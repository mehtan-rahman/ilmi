"""Day-by-day simulation of ilmi's reading loop under different rules.

Entities: sources (books, articles: blocks to read), sections (what a pass
carves out; they come back and yield cards), cards (simple spaced model).
The person has a fixed number of minutes a day and works the queue in its
order until the minutes run out.
"""
import math, random, statistics, sys
from dataclasses import dataclass, field

# ---- the person -----------------------------------------------------------
MIN_PER_DAY = 40
BLOCK_MIN = 0.5           # a paragraph: ~100 words at 200 wpm
PASS_MIN = 8.0            # one reading pass before "done for today"
BLOCKS_PER_PASS = int(PASS_MIN / BLOCK_MIN)   # 16
EXTRACT_EVERY = 8         # blocks per extract, on average
SECTION_MIN = 1.5         # a section pass (write a line, make a card)
CARD_MIN = 10 / 60
AF = 1.6
POSTPONE = 1.2
KAPPA = 20                # beta pseudo-count

def first(pri):           # the cadence: every day, every other day, every third day, by priority
    return 1 + min(2, int(3 * pri / 100))

def grow(ivl, af=AF):
    return max(1, round(ivl * af))

def postponed(ivl):
    return max(round(ivl * POSTPONE), ivl + 1)

@dataclass
class Source:
    name: str; total: int; pri: int; added: int
    pos: int = 0; ivl: int = 1; due: int = 0; reps: int = 0
    last: int = 0          # day of the pass before
    first_pass: int = -1; finished: int = -1
    extracts: int = 0

@dataclass
class Section:
    pri: int; ivl: int; due: int; last: int; reps: int = 0; dismissed: bool = False

@dataclass
class Card:
    pri: int; ivl: int = 0; due: int = 0; reps: int = 0

@dataclass
class Variant:
    name: str
    sampled: bool        # beta-sampled order vs pri-then-due
    elapsed: bool        # grow from elapsed vs stored ivl
    pri_first: bool      # first interval from pri vs 1 (source) / 3 (section)
    backlog: bool        # postpone yesterday's leftovers at day start
    cadence: bool        # unfinished source returns at first(pri), no growth

V0 = Variant('current', False, False, False, False, False)
V1 = Variant('proposed', True, True, True, True, False)
V2 = Variant('proposed+cadence', True, True, True, True, True)
V3 = Variant('cadence only', False, False, True, False, True)

def sort_key(v, item, pri, day, rng_seed):
    if not v.sampled:
        return (pri, item_due(item))
    r = random.Random(f'{rng_seed}:{id(item)}:{day}')
    m = min(0.99, max(0.01, pri / 100))
    return (r.betavariate(KAPPA * m, KAPPA * (1 - m)), item_due(item))

def item_due(it):
    return it.due

def simulate(v, roster, days=365, seed=0, minutes=MIN_PER_DAY, log=None):
    rng = random.Random(seed)
    sources, sections, cards = [], [], []
    daily = []
    for day in range(days):
        for s in roster:
            if s['added'] == day:
                src = Source(s['name'], s['total'], s['pri'], day)
                src.ivl = first(src.pri) if v.pri_first else 1
                src.due = day; src.last = day
                sources.append(src)
        # backlog: what was due before today is postponed at day start
        if v.backlog:
            for it in sources + sections:
                if isinstance(it, Section) and it.dismissed: continue
                if isinstance(it, Source) and it.finished >= 0: continue
                if it.due < day:
                    if v.cadence and isinstance(it, Source):
                        it.due = day + 1          # held over: a missed day keeps the cadence
                    else:
                        it.ivl = postponed(it.ivl); it.due = day + it.ivl
        due = []
        for s in sources:
            if s.finished < 0 and s.due <= day: due.append((s, s.pri))
        for x in sections:
            if not x.dismissed and x.due <= day: due.append((x, x.pri))
        for c in cards:
            if c.due <= day: due.append((c, c.pri))
        due.sort(key=lambda p: sort_key(v, p[0], p[1], day, seed))
        left = minutes
        done = {'read': 0, 'sec': 0, 'card': 0, 'blocks': 0}
        for it, pri in due:
            if isinstance(it, Card):
                cost = CARD_MIN
                if left < cost: break
                left -= cost; done['card'] += 1
                # a plain spaced model: 1, 3, 7, 16 ... with 10% lapses
                if rng.random() < 0.1: it.ivl = 1
                else: it.ivl = 1 if it.reps == 0 else max(it.ivl + 1, round(it.ivl * 2.2))
                it.reps += 1; it.due = day + it.ivl
            elif isinstance(it, Section):
                cost = SECTION_MIN
                if left < cost: break
                left -= cost; done['sec'] += 1
                # cards come out of a section over its first passes
                if it.reps == 0 and rng.random() < 0.8: cards.append(Card(pri=it.pri, due=day + 1))
                if it.reps == 1 and rng.random() < 0.5: cards.append(Card(pri=it.pri, due=day + 1))
                it.reps += 1
                if it.reps >= 3:
                    it.dismissed = True
                else:
                    base = max(it.ivl, day - it.last) if v.elapsed else it.ivl
                    it.ivl = grow(base); it.due = day + it.ivl; it.last = day
            else:  # a source pass
                n = min(BLOCKS_PER_PASS, it.total - it.pos)
                cost = n * BLOCK_MIN
                if left < cost: break
                left -= cost; done['read'] += 1; done['blocks'] += n
                if it.first_pass < 0: it.first_pass = day
                it.pos += n; it.reps += 1
                k = sum(1 for _ in range(n) if rng.random() < 1 / EXTRACT_EVERY)
                for _ in range(k):
                    it.extracts += 1
                    ivl = first(it.pri) if v.pri_first else 3
                    sections.append(Section(pri=it.pri, ivl=ivl, due=day + ivl, last=day))
                if it.pos >= it.total:
                    it.finished = day
                elif v.cadence:
                    it.ivl = first(it.pri); it.due = day + it.ivl; it.last = day
                else:
                    base = max(it.ivl, day - it.last) if v.elapsed else it.ivl
                    it.ivl = grow(base); it.due = day + it.ivl; it.last = day
        overdue = sum(1 for s in sources if s.finished < 0 and s.due < day) + sum(1 for x in sections if not x.dismissed and x.due < day)
        daily.append({'day': day, 'used': minutes - left, 'due': len(due), 'overdue': overdue, **done,
                      'cards': len(cards), 'cards_due': sum(1 for c in cards if c.due <= day)})
    return sources, sections, cards, daily

def fmt_src(s, days):
    if s.finished >= 0: return f'finished day {s.finished:>3} ({s.finished - s.added:>3}d, {s.reps} passes)'
    return f'unfinished: {100 * s.pos // s.total:>3}% after {days - s.added}d, {s.reps} passes'

def run_alone(total=600, days=730):
    print(f'\n== one book alone, {total} blocks, {BLOCKS_PER_PASS} blocks a pass, no competition, {days} days ==')
    for pri in (10, 50, 90):
        print(f'  pri {pri}:')
        for v in (V0, V1, V2):
            srcs, *_ = simulate(v, [{'name': 'book', 'total': total, 'pri': pri, 'added': 0}], days=days, minutes=1000)
            print(f'    {v.name:<18} {fmt_src(srcs[0], days)}')

_r = random.Random(7)
ROSTER = [
    {'name': 'book A  600b pri 20', 'total': 600, 'pri': 20, 'added': 0},
    {'name': 'book B  400b pri 50', 'total': 400, 'pri': 50, 'added': 0},
    {'name': 'chapter 80b pri 30', 'total': 80, 'pri': 30, 'added': 0},
    {'name': 'book C  500b pri 40', 'total': 500, 'pri': 40, 'added': 30},
    {'name': 'book D  300b pri 70', 'total': 300, 'pri': 70, 'added': 60},
    {'name': 'book E  500b pri 85', 'total': 500, 'pri': 85, 'added': 90},
] + [{'name': f'article {i:02} 30b pri {p}', 'total': 30, 'pri': p, 'added': d}
     for i, (p, d) in enumerate((_r.choice([20, 35, 50, 50, 65, 80, 90]), d) for d in range(2, 365, 3))] + [
    {'name': 'book F  400b pri 30', 'total': 400, 'pri': 30, 'added': 150},
    {'name': 'book G  600b pri 60', 'total': 600, 'pri': 60, 'added': 200},
]

def run_library(days=365, seeds=5):
    print(f'\n== a library, {MIN_PER_DAY} min a day, {days} days, {seeds} seeds ==')
    for v in (V0, V1, V2, V3):
        runs = [simulate(v, ROSTER, days=days, seed=s) for s in range(seeds)]
        print(f'\n-- {v.name} --')
        by = [{s.name: s for s in run[0]} for run in runs]
        for i, r in enumerate(ROSTER):
            ss = [b[r['name']] for b in by]
            fins = [s.finished - s.added for s in ss if s.finished >= 0]
            firsts = [s.first_pass - s.added for s in ss]
            pcts = [100 * s.pos // s.total for s in ss]
            if r['total'] < 100: continue  # summarize the articles below
            fin = f'finished in {statistics.mean(fins):>4.0f}d ({len(fins)}/{seeds})' if fins else f'unfinished, {statistics.mean(pcts):>3.0f}% read'
            print(f'  {r["name"]:<22} first pass +{statistics.mean(firsts):>3.0f}d   {fin}')
        arts = [i for i, r in enumerate(ROSTER) if r['total'] < 100]
        fin_frac = statistics.mean(sum(1 for i in arts if b[ROSTER[i]['name']].finished >= 0) / len(arts) for b in by)
        fin_days = [b[ROSTER[i]['name']].finished - b[ROSTER[i]['name']].added for b in by for i in arts if b[ROSTER[i]['name']].finished >= 0]
        low = [i for i in arts if ROSTER[i]['pri'] >= 70]
        low_frac = statistics.mean(sum(1 for i in low if b[ROSTER[i]['name']].finished >= 0) / len(low) for b in by)
        print(f'  {len(arts)} articles: {100 * fin_frac:.0f}% finished, median {statistics.median(fin_days) if fin_days else 0:.0f}d; of the pri>=70 ones {100 * low_frac:.0f}% finished')
        d = runs[0][3]
        q = [x for x in d if x['day'] >= 180]
        print(f'  load (days 180+): {statistics.mean(x["used"] for x in q):.0f} min used, {statistics.mean(x["due"] for x in q):.0f} due a day, '
              f'{statistics.mean(x["overdue"] for x in q):.0f} overdue topics, {statistics.mean(x["card"] for x in q):.0f} cards a day, '
              f'{statistics.mean(x["read"] for x in q):.1f} reading passes, {statistics.mean(x["sec"] for x in q):.1f} section passes')
        print(f'  cards made: {statistics.mean(len(run[2]) for run in runs):.0f}; sections: {statistics.mean(len(run[1]) for run in runs):.0f}')

if __name__ == '__main__':
    run_alone()
    run_library()
    MIN_PER_DAY_SAVE = MIN_PER_DAY
    for m in (20, 80):
        MIN_PER_DAY = m
        globals()['MIN_PER_DAY'] = m
        print(f'\n#### {m} minutes a day')
        for v in (V0, V2):
            runs = [simulate(v, ROSTER, days=365, seed=s, minutes=m) for s in range(3)]
            books = [i for i, r in enumerate(ROSTER) if r['total'] >= 100]
            by = [{s.name: s for s in run[0]} for run in runs]
            out = []
            for i in books:
                ss = [b[ROSTER[i]['name']] for b in by]
                fins = [s.finished - s.added for s in ss if s.finished >= 0]
                pcts = [100 * s.pos // s.total for s in ss]
                out.append(f'{ROSTER[i]["name"].split()[1]}:{statistics.mean(fins):.0f}d' if len(fins) == 3 else f'{ROSTER[i]["name"].split()[1]}:{statistics.mean(pcts):.0f}%')
            print(f'  {v.name:<18} ' + '  '.join(out))
