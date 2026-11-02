#!/usr/bin/env python3 -I
# Typesets the sample's Lindqvist chapters (text/ch-*.md, the chapters'
# bodies as the sample held them before 49: the book's own text, the cards,
# extract backrefs and schedules left out) as design/books/lindqvist.tex,
# in ch3.tex's look. Chapter 1 is sixteen blank pages, so the PDF's page
# numbers are the book's and a chapter document can say `pages: 17-29`.
#   python3 -I design/books/lindqvist.py && (cd design/books && pdflatex lindqvist.tex && pdflatex lindqvist.tex)
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).with_name('text')
OUT = Path(__file__).with_suffix('.tex')
CHAPTERS = ['ch-2-microstates-and-entropy.md', 'ch-3-the-canonical-ensemble.md', 'ch-4-ideal-quantum-gases.md']
FIRST_PAGE = 17

HEAD = r'''% The sample's Lindqvist, chapters 2–4, typeset from the sample's own text
% by lindqvist.py (do not edit by hand; edit the chapters and rerun).
% Rebuild with: pdflatex lindqvist.tex (twice).
\documentclass[10pt,twoside,openright]{book}
\usepackage[paperwidth=6in,paperheight=9in,inner=0.8in,outer=0.7in,top=0.85in,bottom=0.8in,headsep=0.25in]{geometry}
\usepackage{newtxtext,newtxmath}
\usepackage{amsmath}
\usepackage{microtype}
\usepackage{fancyhdr}
\usepackage{titlesec}
\titleformat{\chapter}[display]{\normalfont}{\large Chapter \thechapter}{0.6ex}{\LARGE\bfseries}
\titlespacing*{\chapter}{0pt}{0pt}{4ex}
\titleformat{\section}{\normalfont\large\bfseries}{\thesection}{0.8em}{}
\titlespacing*{\section}{0pt}{2.2ex plus .5ex}{1.2ex}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[LE]{\small\thepage\hspace{1.2em}\textsc{Statistical Physics: A First Course}}
\fancyhead[RO]{\small\textsc{\thechapter\enspace\chtitle}\hspace{1.2em}\thepage}
\renewcommand{\headrulewidth}{0pt}
\fancypagestyle{plain}{\fancyhf{}\renewcommand{\headrulewidth}{0pt}}
\newcommand{\chtitle}{}
\newcommand{\dd}{\mathrm{d}}
\begin{document}
% chapter 1: blank, so the pages number as the book does
\pagestyle{empty}
\newcount\n \n=0
\loop\ifnum\n<@BLANK@ \null\newpage \advance\n by 1 \repeat
\pagestyle{fancy}
\setcounter{page}{@FIRST@}
'''

def inline(t):
    """Markdown inline to LaTeX, math left alone."""
    out = []
    for i, seg in enumerate(re.split(r'(\$[^$]+\$)', t)):
        if i % 2:
            out.append(seg)
            continue
        seg = seg.replace('&', r'\&').replace('%', r'\%').replace('#', r'\#')
        seg = re.sub(r'\*\*(.+?)\*\*', r'\\textbf{\1}', seg)
        seg = re.sub(r'(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)', r'\\emph{\1}', seg)
        seg = seg.replace('—', '---').replace('–', '--').replace('§', r'\S')
        seg = seg.replace('³He', r'$^3$He').replace('⁴He', r'$^4$He')
        seg = seg.replace('N₂', r'N$_2$').replace('O₂', r'O$_2$').replace('H₂', r'H$_2$')
        seg = seg.replace('m⁻³', r'm$^{-3}$').replace('m⁻²', r'm$^{-2}$').replace('K⁻⁴', r'K$^{-4}$')
        seg = seg.replace('kg·m²', r'kg\,m$^2$').replace('·', r'$\cdot$').replace('m³', r'm$^3$')
        seg = re.sub(r'"(.+?)"', r"``\1''", seg)
        seg = re.sub(r'(?<=\d)x(?=10)', r'\\times', seg)
        out.append(seg)
    s = ''.join(out)
    for c in s:
        if ord(c) > 127 and c not in 'éü':
            sys.exit(f'unconverted character {c!r} in: {t[:60]}')
    return s

def blocks(text):
    body = text.split('\n---\n', 1)[1] if text.startswith('---\n') else text
    out, cur = [], []
    for line in body.split('\n'):
        if line.strip() == '':
            if cur: out.append('\n'.join(cur)); cur = []
        else:
            cur.append(line)
    if cur: out.append('\n'.join(cur))
    return out

def chapter(path):
    tex = []
    problems = False
    for b in blocks(path.read_text()):
        # the backrefs and schedules are the person's, not the book's; so is a card
        b = '\n'.join(l for l in b.split('\n') if not l.startswith('<!--'))
        if not b or re.search(r'\^[a-z]|\{\{c\d|(^|\n)\?\??(\n|$)| ::?:? ', b):
            continue
        m = re.match(r'^# Chapter (\d+) — (.+)$', b)
        if m:
            n, title = int(m.group(1)), m.group(2)
            tex.append(f'\\setcounter{{chapter}}{{{n - 1}}}\n\\renewcommand{{\\chtitle}}{{{title}}}\n\\chapter{{{title}}}')
            continue
        m = re.match(r'^## (\d+\.\d+) (.+)$', b)
        if m:
            tex.append(f'\\section{{{inline(m.group(2))}}}')
            continue
        m = re.match(r'^## (.+)$', b)
        if m:
            problems = m.group(1) == 'Problems'
            tex.append(f'\\section*{{{m.group(1)}}}' + ('\n\\small' if problems else ''))
            continue
        if b.startswith('$$'):
            inner = b.strip('$').strip()
            tex.append(f'\\begin{{equation}}\n  {inner}\n\\end{{equation}}')
            continue
        if b.startswith('> '):
            tex.append('\\begin{quote}\n' + inline(b[2:]) + '\n\\end{quote}')
            continue
        if problems and re.match(r'^\d+\. \*\*', b):
            items = [re.match(r'^\d+\. \*\*(\S+)\*\* (.+)$', l) for l in b.split('\n')]
            tex.append('\n\n\\smallskip\n'.join(f'\\noindent\\textbf{{{i.group(1)}}}\\enspace {inline(i.group(2))}' for i in items))
            continue
        tex.append(inline(b))
    return '\n\n'.join(tex)

out = HEAD.replace('@BLANK@', str(FIRST_PAGE - 1)).replace('@FIRST@', str(FIRST_PAGE))
out += '\n'.join(chapter(SRC / c) + '\n' for c in CHAPTERS)
out += '\\end{document}\n'
OUT.write_text(out)
print(f'wrote {OUT.relative_to(ROOT)}: {len(out)} characters')
