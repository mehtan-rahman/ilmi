#!/usr/bin/env python3 -I
# Typesets the sample's passage 12 of the classical prose reader (text/12-
# the-grammarian-and-the-bedouin.md, the passage as the sample held it
# before 49: the editors' text, the cards and schedules left out) as
# design/books/reader.tex, pp. 129 on, for XeLaTeX with polyglossia and the
# system's DecoType Naskh. reader-book.tex sets it after 128 blank pages so
# the PDF's page numbers are the book's.
#   python3 -I design/books/reader.py && (cd design/books && xelatex reader.tex && xelatex reader-book.tex)
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).with_name('text') / '12-the-grammarian-and-the-bedouin.md'
OUT = Path(__file__).with_suffix('.tex')
FIRST_PAGE = 129

HEAD = r'''% The sample's passage 12 of the classical prose reader, typeset from the
% sample's own text by reader.py (do not edit by hand; edit the passage and
% rerun). Rebuild with: xelatex reader.tex
\documentclass[11pt,twoside,openany]{book}
\usepackage[paperwidth=6in,paperheight=9in,inner=0.8in,outer=0.7in,top=0.85in,bottom=0.8in,headsep=0.25in]{geometry}
\usepackage{fontspec}
\usepackage{polyglossia}
\setmainlanguage{english}
\setotherlanguage{arabic}
\setmainfont{LibertinusSerif-Regular.otf}[BoldFont=LibertinusSerif-Bold.otf,ItalicFont=LibertinusSerif-Italic.otf,BoldItalicFont=LibertinusSerif-BoldItalic.otf]
\newfontfamily\arabicfont[Script=Arabic,Scale=1.25]{DecoType Naskh}
\usepackage{fancyhdr}
\usepackage{titlesec}
\titleformat{\section}{\normalfont\large\bfseries}{}{0pt}{}
\titlespacing*{\section}{0pt}{2.6ex plus .5ex}{1.4ex}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[LE]{\textenglish{\small\thepage\hspace{1.2em}\textsc{Readings in Classical Arabic Prose}}}
\fancyhead[RO]{\textenglish{\small\textsc{Passage 12\enspace The Grammarian and the Bedouin}\hspace{1.2em}\thepage}}
\renewcommand{\headrulewidth}{0pt}
\setcounter{page}{@FIRST@}
\linespread{1.15}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.55em}
\begin{document}
'''

AR = r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]'
RUN = re.compile(rf'({AR}(?:[{AR[1:-1]}\s…]*{AR})?)')

def inline(t):
    """Markdown inline to LaTeX; a run of Arabic is set in the Arabic font."""
    t = t.replace('&', r'\&').replace('%', r'\%').replace('#', r'\#')
    t = re.sub(r'\*\*(.+?)\*\*', r'\\textbf{\1}', t)
    t = re.sub(r'(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)', r'\\emph{\1}', t)
    t = re.sub(r'"(.+?)"', r"``\1''", t)
    return RUN.sub(lambda m: f'\\textarabic{{{m.group(1).replace(chr(0x670), "")}}}', t)

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

tex = []
for b in blocks(SRC.read_text()):
    # the backrefs and schedules are the person's, not the book's; so is a card
    b = '\n'.join(l for l in b.split('\n') if not l.startswith('<!--'))
    if not b or re.search(r'\^[a-z]|\{\{c\d|(^|\n)\?\??(\n|$)| ::?:? ', b):
        continue
    m = re.match(r'^## Passage (\d+)\. (.+?) \((.+)\)$', b)
    if m:
        tex.append(f'{{\\Large\\bfseries {m.group(1)}: {m.group(2)}}}\\quad{{\\large\\bfseries\\textarabic{{{m.group(3)}}}}}\n\n\\medskip')
        continue
    m = re.match(r'^## (.+)$', b)
    if m:
        tex.append(f'\\section*{{{m.group(1)}}}')
        continue
    if b.startswith('- '):
        items = [inline(l[2:]) for l in b.split('\n')]
        tex.append('\n\n'.join(f'\\hangindent=1.2em\\hangafter=1 {it}' for it in items))
        continue
    if re.match(AR, b):
        tex.append('\\begin{Arabic}\n' + b.replace('\u0670', '') + '\n\\end{Arabic}')  # the dagger alif is not in DecoType Naskh
        continue
    if b.startswith('Level:'):
        tex.append('{\\small\\itshape ' + inline(b) + '}')
        continue
    tex.append(inline(b))

out = HEAD.replace('@FIRST@', str(FIRST_PAGE)) + '\n\n'.join(tex) + '\n\\end{document}\n'
OUT.write_text(out)
print(f'wrote {OUT.relative_to(ROOT)}: {len(out)} characters')
