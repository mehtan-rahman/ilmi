#!/usr/bin/env python3
"""ink-measure.py <scan.txt> <log.txt> [-v]: how far the red cross (the ink) lies from where the page's own squares
say it should, frame by frame, for each part of the `pdfink` smoke (milestone 89): `scan.txt` is what
`scripts/ink-scan.swift` printed of a recording, `log.txt` the app's log of that run (its `phase:` lines name the
parts). All in the recording's pixels (the screen's own). A recording's colour is coarser than its light (h264), so
an edge is known to a pixel or two: at rest the same strokes measure up to about two pixels apart from one zoom to
another. `-v` lists the frames more than a pixel off."""
import sys, re

scan, log = sys.argv[1], sys.argv[2]
names = {}
for l in open(log, errors='ignore'):
    m = re.search(r'smoke pdfink: phase: (\d+) (\d+) (.*)', l)
    if m:
        names[int(m.group(1))] = (int(m.group(2)), m.group(3).strip())

rows = []
for l in open(scan):
    p = [x.strip().split() for x in l.split('|')]
    if len(p) < 6:
        continue
    t, lamp = float(p[0][0]), int(p[0][1])
    red = list(map(int, p[1]))  # x0 y0 x1 y1 n
    orange = list(map(int, p[2]))  # n x0 y0 x1 y1
    g = p[3]
    b = p[4]
    w, h = map(int, p[5])
    rows.append((t, lamp, red, orange, g, b, w, h))


def phase_of(lamp):
    best = None
    for k, (v, _) in names.items():
        if abs(v - lamp) <= 4:
            best = k
    return best


def geom(r):
    t, lamp, red, orange, g, b, w, h = r
    ymin = int(0.146 * h)
    if red[4] == 0 or g[0] == '-' or b[0] == '-':
        return None
    gx, gy, bx, by = float(g[0]), float(g[1]), float(b[0]), float(b[1])
    gb = list(map(int, g[3:7]))
    bb = list(map(int, b[3:7]))
    # everything wholly on the screen, under the bar
    for (x0, y0, x1, y1) in (red[:4], gb, bb):
        if x0 <= 2 or y0 <= ymin + 12 or x1 >= w - 3 or y1 >= h - 3:
            return None
    span = (bx - gx, by - gy)
    if span[0] < 50 or span[1] < 50:
        return None
    cx, cy = (red[0] + red[2] + 1) / 2, (red[1] + red[3] + 1) / 2
    mx, my = (gx + bx) / 2 + 0.5, (gy + by) / 2 + 0.5
    return dict(t=t, dx=cx - mx, dy=cy - my, iw=red[2] - red[0] + 1, ih=red[3] - red[1] + 1, sx=span[0], sy=span[1])


# at rest: the first part
rest = [geom(r) for r in rows if phase_of(r[1]) == 1]
rest = [x for x in rest if x]
if not rest:
    print('no frame at rest'); sys.exit(1)
r0 = rest[len(rest) // 2]
# the nib adds the same to the cross's width at any zoom, as a share of the squares' span
kx, ky = r0['iw'] / r0['sx'], r0['ih'] / r0['sy']
print(f"at rest: the cross {r0['iw']}×{r0['ih']} px, the squares {r0['sx']:.1f}×{r0['sy']:.1f} px apart; its middle {r0['dx']:+.2f}, {r0['dy']:+.2f} px from theirs")
print(f"{'part':<26}{'frames':>7}{'measured':>9}{'secs':>7}{'zoom':>12}{'worst middle px':>17}{'worst size px':>15}{'frames >1px':>12}{'no ink':>8}")
for k in sorted(names):
    fr = [r for r in rows if phase_of(r[1]) == k]
    if not fr:
        continue
    gs = [geom(r) for r in fr]
    ok = [x for x in gs if x]
    noink = sum(1 for r in fr if r[2][4] == 0 and r[4][0] != '-')
    if not ok:
        print(f"{names[k][1]:<26}{len(fr):>7}{0:>9}")
        continue
    worst_mid = max(max(abs(x['dx'] - r0['dx']), abs(x['dy'] - r0['dy'])) for x in ok)
    sizes = [max(abs(x['iw'] - kx * x['sx']), abs(x['ih'] - ky * x['sy'])) for x in ok]
    worst_size = max(sizes)
    off = sum(1 for x, s in zip(ok, sizes) if max(abs(x['dx'] - r0['dx']), abs(x['dy'] - r0['dy'])) > 1.01 or s > 2.02)
    z0, z1 = min(x['sx'] for x in ok) / r0['sx'], max(x['sx'] for x in ok) / r0['sx']
    print(f"{names[k][1]:<26}{len(fr):>7}{len(ok):>9}{fr[-1][0] - fr[0][0]:>7.1f}{f'{z0:.2f}-{z1:.2f}':>12}{worst_mid:>17.2f}{worst_size:>15.2f}{off:>12}{noink:>8}")
    if '-v' in sys.argv:
        for x, s in zip(ok, sizes):
            d = max(abs(x['dx'] - r0['dx']), abs(x['dy'] - r0['dy']))
            if d > 1.01 or s > 2.02:
                print(f"    t {x['t']:.3f}: middle {x['dx'] - r0['dx']:+.2f}, {x['dy'] - r0['dy']:+.2f}; size {x['iw'] - kx * x['sx']:+.2f}, {x['ih'] - ky * x['sy']:+.2f}; zoom {x['sx'] / r0['sx']:.3f}")
# the stroke a finger wrote: is it ever gone, or laid on twice (twice multiplied, orange reads as red)?
wk = [k for k in names if names[k][1].startswith('written')]
if wk:
    fr = [r for r in rows if phase_of(r[1]) == wk[0]]
    seen = False
    gone = []
    for r in fr:
        n = r[3][0]
        if n > 200:
            seen = True
        elif seen and n < 50:
            gone.append(r[0])
    print(f"written then pinched: {len(fr)} frames; the stroke gone in {len(gone)} of them after it was first seen" + (f" (first at t {gone[0]:.3f})" if gone else ''))

# more written, the pages still: the orange on the page only ever grows (a stroke gone a frame, or the whole page's writing, shows as a drop)
mk = [k for k in names if names[k][1].startswith('more written')]
if mk:
    fr = [r for r in rows if phase_of(r[1]) == mk[0]]
    drops = []
    top = 0
    for r in fr:
        n = r[3][0]
        # (a stroke handed from PencilKit's canvas to the page loses a little: the print shows through it on the page)
        if n < top * 0.88:
            drops.append((r[0], n, top))
        top = max(top, n)
    print(f"more written: {len(fr)} frames, the orange from {fr[0][3][0]} to {fr[-1][3][0]} px; it fell in {len(drops)} of them" + (f" (first at t {drops[0][0]:.3f}: {drops[0][1]} of {drops[0][2]})" if drops else ''))
