#!/usr/bin/env python3
"""ink-look.py <run dir>: the same stroke captured three ways by the `pdfink` smoke's `look` part (milestone 89):
under the finger (PencilKit's, being written), lifted and still on PencilKit's canvas, and as the page draws it.
`<run dir>/log.txt` has a `look:` line a stroke (its name and the box of the capture it lies in, the screen's
pixels) and `<run dir>/shots/look-<name>-{bare,live,canvas,page}.png` are the captures. For each state, against the
bare page: how many pixels the stroke changed, its mean colour where the page was paper and where it was print, and
how far each state is from the page's own drawing of it, pixel by pixel."""
import sys, json, re, os
from PIL import Image

run = sys.argv[1]
log = open(os.path.join(run, 'log.txt'), errors='replace').read()


def lum(c):
    return (c[0] * 77 + c[1] * 150 + c[2] * 29) >> 8


for m in re.finditer(r'look: (\{.*\})', log):
    g = json.loads(m.group(1))
    name = g['name']
    x0, y0, x1, y1 = g['box']
    shots = {}
    for k in ('bare', 'live', 'canvas', 'page'):
        p = os.path.join(run, 'shots', f'look-{name}-{k}.png')
        if os.path.exists(p):
            shots[k] = Image.open(p).convert('RGB').crop((x0, y0, x1, y1))
    if 'bare' not in shots or 'page' not in shots:
        print(f'{name}: captures missing ({sorted(shots)})')
        continue
    bare = list(shots['bare'].getdata())
    page = list(shots['page'].getdata())
    print(f"{name} (box {x1 - x0}×{y1 - y0} px)")
    # where the page's own drawing of the stroke lies: the pixels it changed
    inked = [i for i, (a, b) in enumerate(zip(bare, page)) if sum(abs(a[k] - b[k]) for k in range(3)) > 24]
    paper = [i for i in inked if lum(bare[i]) > 225]
    printed = [i for i in inked if lum(bare[i]) < 110]
    for k in ('live', 'canvas', 'page'):
        if k not in shots:
            print(f'  {k}: no capture')
            continue
        px = list(shots[k].getdata())
        changed = sum(1 for a, b in zip(bare, px) if sum(abs(a[j] - b[j]) for j in range(3)) > 24)

        def mean(idx):
            if not idx:
                return None
            return tuple(round(sum(px[i][j] for i in idx) / len(idx)) for j in range(3))

        # against the page's own drawing, over the pixels either changed
        both = [i for i, (a, b, c) in enumerate(zip(bare, px, page)) if sum(abs(a[j] - b[j]) for j in range(3)) > 24 or sum(abs(a[j] - c[j]) for j in range(3)) > 24]
        diffs = [max(abs(px[i][j] - page[i][j]) for j in range(3)) for i in both]
        off = sum(1 for d in diffs if d > 40)
        print(f"  {k:<7} changed {changed:>6} px; on paper {mean(paper)}, on print {mean(printed)} ({len(printed)} px of print under it); "
              f"against the page's: mean {sum(diffs) / max(len(diffs), 1):.1f}, worst {max(diffs) if diffs else 0}, {off} px more than 40 apart ({100 * off / max(len(both), 1):.1f}%)")
