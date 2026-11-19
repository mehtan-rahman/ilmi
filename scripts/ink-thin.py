#!/usr/bin/env python3
"""ink-thin.py <run dir>: how sharp thin ink is in the captures of the `written` smoke's `thin` part (a phone's
notebook). Each `inkgeo:` line of the log says where the level strokes lie in the capture that follows (the screen's
pixels) and how wide each should be there. Down a column through each stroke: how dark it gets (a stroke narrower
than a pixel cannot reach its ink's black: `at most` says what one drawn exactly would reach), how wide it is at half
that (px), and how wide its edge is from a tenth to nine tenths of it (a stroke drawn exactly reads about a pixel;
one resampled from a picture at another size reads more, and is paler)."""
import sys, json, re, os
from PIL import Image

run = sys.argv[1]
log = open(os.path.join(run, 'log.txt'), errors='replace').read()
for m in re.finditer(r'inkgeo: (\{.*\})', log):
    g = json.loads(m.group(1))
    p = os.path.join(run, 'shots', g['shot'] + '.png')
    if not os.path.exists(p):
        print(g['shot'], 'no capture'); continue
    im = Image.open(p).convert('L'); W, H = im.size; px = im.load()
    print(f"{g['shot']} ({W}x{H}; {g['k']:.2f} px to the point, zoom {g['zoom']}; drawn as {g['drawn']})")
    xs = [int(g['x'][0] + (g['x'][1] - g['x'][0]) * t) for t in (0.1, 0.3, 0.5, 0.7, 0.9)]
    xs = [x for x in xs if 4 <= x < W - 4]
    for l in g['lines']:
        y0 = int(round(l['y']))
        want = l['w'] * g['k']
        if not (20 <= y0 < H - 20) or not xs:
            print(f"  {l['w']} pt: off the capture"); continue
        depth = []; half = []; edge = []
        for x in xs:
            col = [255 - px[x, y] for y in range(y0 - 14, y0 + 15)]
            base = sorted(col)[len(col) // 4]
            col = [max(0, v - base) for v in col]
            peak = max(col)
            if peak < 6: depth.append(0); continue
            depth.append(peak)
            # width at half the peak, by where the profile crosses it
            above = [i for i, v in enumerate(col) if v >= peak / 2]
            def cross(i, j, level):
                a, b = col[i], col[j]
                return i + (level - a) / (b - a) * (j - i) if b != a else i
            lo = cross(above[0] - 1, above[0], peak / 2) if above[0] > 0 else above[0]
            hi = cross(above[-1] + 1, above[-1], peak / 2) if above[-1] < len(col) - 1 else above[-1]
            half.append(hi - lo)
            # the upper edge: from a tenth to nine tenths of the peak
            i9 = next(i for i, v in enumerate(col) if v >= 0.9 * peak)
            i1 = max(i for i in range(i9 + 1) if col[i] <= 0.1 * peak) if any(col[i] <= 0.1 * peak for i in range(i9 + 1)) else 0
            a = cross(i1, i1 + 1, 0.1 * peak) if i1 < i9 else i1
            b = cross(i9 - 1, i9, 0.9 * peak) if i9 > 0 else i9
            edge.append(max(0.0, b - a))
        if not half:
            print(f"  {l['w']} pt ({want:.2f} px): NOT FOUND"); continue
        mean = lambda v: sum(v) / len(v)
        most = min(1.0, want) * 227  # the ink is #1c1c1e on white
        print(f"  {l['w']} pt, {want:.2f} px wide: as dark as {mean(depth):.0f} of 255 (at most {most:.0f}); {mean(half):.2f} px wide at half; its edge {mean(edge):.2f} px")
