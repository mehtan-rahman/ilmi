import statistics, random, irsim
from irsim import simulate, Variant

V = Variant('cadence', True, True, True, True, True)
SEM = 105  # 15 weeks

def roster():
    r = random.Random(3)
    books = [
        {'name': 'text 1 500b pri 20', 'total': 500, 'pri': 20, 'added': 0},
        {'name': 'text 2 500b pri 35', 'total': 500, 'pri': 35, 'added': 0},
        {'name': 'text 3 500b pri 50', 'total': 500, 'pri': 50, 'added': 0},
        {'name': 'side   300b pri 75', 'total': 300, 'pri': 75, 'added': 14},
    ]
    arts = [{'name': f'article {d:03}', 'total': 30, 'pri': r.choice([30, 50, 50, 65, 80]), 'added': d} for d in range(1, SEM, 4)]
    return books + arts

def run(first_slope, pass_min, minutes, seeds=4):
    irsim.PASS_MIN = pass_min
    irsim.BLOCKS_PER_PASS = int(pass_min / irsim.BLOCK_MIN)
    R = roster()
    runs = [simulate(V, R, days=SEM, seed=s, minutes=minutes) for s in range(seeds)]
    by = [{s.name: s for s in run[0]} for run in runs]
    out = []
    for b in R[:4]:
        ss = [x[b['name']] for x in by]
        fins = [s.finished - s.added for s in ss if s.finished >= 0]
        if len(fins) == seeds: out.append(f'{statistics.mean(fins):>4.0f}d')
        else: out.append(f'{statistics.mean(100 * s.pos // s.total for s in ss):>3.0f}%')
    arts = [b['name'] for b in R[4:]]
    af = statistics.mean(sum(1 for a in arts if x[a].finished >= 0) / len(arts) for x in by)
    used = statistics.mean(d['used'] for run in runs for d in run[3][30:])
    cards = statistics.mean(d['card'] for run in runs for d in run[3][60:])
    return out, af, used, cards

print(f'{"cadence 1+k·pri":<16}{"pass":>6}{"min/d":>7} | text1 p20  text2 p35  text3 p50  side p75 | articles  used  cards/d')
for slope in (3,):
    for pass_min in (8, 12):
        for minutes in (30, 45, 60):
            out, af, used, cards = run(slope, pass_min, minutes)
            print(f'k={slope:<14}{pass_min:>4}m{minutes:>6}  |  {"      ".join(out)}  |  {100*af:>4.0f}%  {used:>4.0f}  {cards:>4.0f}')
    print()
