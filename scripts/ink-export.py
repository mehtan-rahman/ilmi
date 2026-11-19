#!/usr/bin/env python3
"""ink-export.py <log.txt> <out dir> [pdfpng]: the PDFs the `pdfink` smoke passed on (`share`, `turned`; milestone
89), read back: each `export:` line of the log names the file, the page, and where red ink must lie on that page as
it is shown (fractions of the page: left, top, right, bottom). The page is drawn to a PNG by `pdfpng` (a PDFKit
one-liner: `pdfpng <pdf> <out prefix>` writes `<prefix>-<n>.png`; built from `scripts/pdfpng.swift`) and the red in
and out of that box counted. With `only` in the line, red anywhere else is a stroke out of place."""
import sys, json, re, os, subprocess
from PIL import Image

log, out = sys.argv[1], sys.argv[2]
tool = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pdfpng')
os.makedirs(out, exist_ok=True)
bad = 0
for i, m in enumerate(re.finditer(r'export: (\{.*\})', open(log, errors='replace').read())):
    g = json.loads(m.group(1))
    if not os.path.exists(g['pdf']):
        print(f"{g['pdf']}: gone"); bad += 1; continue
    prefix = os.path.join(out, f'export{i + 1}')
    subprocess.run([tool, g['pdf'], prefix], check=True, capture_output=True)
    im = Image.open(f"{prefix}-{g['page']}.png").convert('RGB'); px = im.load(); W, H = im.size
    x0, y0, x1, y1 = g['red']
    box = (int(x0 * W) - 6, int(y0 * H) - 6, int(x1 * W) + 6, int(y1 * H) + 6)
    red = lambda c: c[0] > 170 and c[1] < 90 and c[2] < 90
    inside = outside = 0
    xs = []; ys = []
    for y in range(H):
        for x in range(W):
            if red(px[x, y]):
                xs.append(x); ys.append(y)
                if box[0] <= x <= box[2] and box[1] <= y <= box[3]: inside += 1
                else: outside += 1
    where = f"red from {min(xs) / W:.3f}, {min(ys) / H:.3f} to {max(xs) / W:.3f}, {max(ys) / H:.3f} of the page" if xs else 'no red'
    ok = inside > 200 and (outside == 0 or not g.get('only')) and (not xs or (abs(min(xs) / W - x0) < 0.03 and abs(max(xs) / W - x1) < 0.03) or not g.get('only'))
    if not ok: bad += 1
    print(f"{os.path.basename(g['pdf'])} p. {g['page']} of {g['pages']} ({W}x{H} px): {inside} px of red where the writing must lie ({x0:.3f}, {y0:.3f} to {x1:.3f}, {y1:.3f}), {outside} elsewhere; {where}{'' if ok else '  NOT AS WRITTEN'}")
print('as written' if not bad else f'{bad} not as written')
