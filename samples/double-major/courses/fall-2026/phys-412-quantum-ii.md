---
title: quantum II
tabs: true
course: PHYS 412
instructor: Prof. Lindgren
term: fall 2026
meets: MWF 10:00–10:50, Hollis 214
office-hours: Tue 14:00–16:00, Thu 11:00–12:00 (Hollis 309)
---

## the course

PHYS 412, Quantum Mechanics II. Prof. Lindgren; TA is Priya (recitation Thu 16:00, the one that actually does examples). Sequel to 312. Approximation methods first (perturbation theory, variational, WKB, time-dependent PT), then scattering, identical particles and second quantization if there's time ("there is never time").

Texts: Lindgren's own lecture notes (posted after each lecture, terse), and Halvorsen, *Quantum Theory: An Intermediate Course*, chs. 6–11 as the official text. I take notes by hand in lecture and type them up here, usually within a few days. Units are the tabs, in teaching order. Problem sets and exam review are decks under problem-sets.

## grading

| component | weight | notes |
| --- | --- | --- |
| problem sets | 30% | weekly, due Fridays (except midterm weeks); lowest dropped |
| midterm 1 | 20% | Wed 2026-10-21, in class |
| midterm 2 | 20% | Wed 2026-11-18, in class |
| final | 30% | Mon 2026-12-14, 08:00–11:00, cumulative |

Late PS: 10%/day, max two days. Collaboration allowed, write-up alone, name collaborators. One page of notes (both sides) allowed on midterms, two on the final.

## exams

- Midterm 1, Wed Oct 21: nondegenerate + degenerate PT, fine structure, Zeeman, variational through helium. Got 74/100 (median 68). Review deck: problem-sets/midterm-1-review.
- Midterm 2, Wed Nov 18: H₂⁺, WKB, time-dependent PT, probably the start of scattering. Lindgren said "the golden rule will be on it, obviously".
- Final, Mon Dec 14: cumulative, "weighted toward the second half".

## what's been covered (as of Oct 30)

- Aug 31 – Sep 11: nondegenerate time-independent PT; $x^4$ oscillator, charged oscillator, ground-state Stark, convergence. Typed up.
- Sep 14 – Sep 28: degenerate PT; good quantum numbers; linear Stark $n=2$; fine structure; weak/strong Zeeman. Typed up.
- Sep 30 – Oct 12: variational method; helium; H₂⁺ (LCAO). Typed up; helium excited states skipped in lecture.
- Oct 14, 16: review, no new material. Oct 19: canceled (Lindgren at a conference). Oct 21: midterm.
- Oct 23, 26: WKB. Still typing (draft); connection formulas on a board photo.
- Oct 28: time-dependent PT through Fermi's golden rule. Rough notes.
- Oct 30 (today): harmonic perturbations, absorption and stimulated emission. Not typed.

## the four methods in one place

My own comparison, made while studying for the midterm and extended since. Not from lecture.

| method | needs | gives | best for | fails when |
| --- | --- | --- | --- | --- |
| nondegenerate PT | solvable $H^0$, nondegenerate level | series in $\lambda$ | weak perturbations, all levels | mixing coefficients $\sim 1$; asymptotic series |
| degenerate PT | same, degenerate level | splitting + good states | symmetry-broken multiplets | second-order needed within subspace |
| variational | nothing but a trial $\psi$ | upper bound | ground state | no error estimate; excited states need orthogonality |
| WKB | slowly varying $V$ | $\psi$, quantization, tunneling | high $n$, tunneling exponents | near turning points (fixed by connection formulas) |
| time-dependent PT | $H'(t)$ weak | transition probabilities, rates | spectroscopy, decay | $P$ not $\ll 1$; long times without a continuum |

Lindgren's version (lecture 13): "PT when you have a nearby solvable problem, variational when you don't but you have physical intuition, WKB when $\hbar$ is effectively small, and numerics when none of the above." He then said numerics is Rayleigh–Ritz with a big basis, so it's variational anyway.

the variational method gives {{c1::an upper bound}} on the ground state energy, while perturbation theory gives {{c2::no bound at all, just a series}} ^qm0-bound
<!-- sr c1 due=2026-11-26 st=review s=33.8 d=3.7 r=4 l=0 ivl=34 last=2026-10-23T12:14:00Z g=4 -->
<!-- sr c2 due=2026-11-14 st=review s=22.1 d=4.4 r=4 l=0 ivl=22 last=2026-10-23T12:14:00Z g=3 -->

the energy scales in hydrogen: Bohr levels $\sim\alpha^2mc^2$, fine structure $\sim$ {{c1::$\alpha^4mc^2$}}, Lamb shift $\sim$ {{c2::$\alpha^5mc^2$}}, hyperfine $\sim$ {{c3::$(m_e/m_p)\,\alpha^4mc^2$}} ^qm0-scales
<!-- sr c1 due=2026-11-15 st=review s=28.2 d=4.2 r=4 l=0 ivl=28 last=2026-10-18T09:25:00Z g=3 -->
<!-- sr c2 due=2026-11-06 st=review s=19.4 d=5.6 r=4 l=1 ivl=19 last=2026-10-18T09:25:00Z g=3 -->
<!-- sr c3 due=2026-11-01 st=review s=14.3 d=6.2 r=4 l=1 ivl=14 last=2026-10-18T09:25:00Z g=3 -->

## questions for office hours

Running list. Strike through (~~like this~~) when answered. Pulled from the [ask in OH] marks in the unit notes.

- ~~nondegenerate: is the $(2n+1)$ rule Wigner's theorem?~~ Yes (Tue Sep 22). Holds for RS PT; Lindgren showed it from the stationarity of $\langle H\rangle$, which is the same reason the variational error is second order.
- nondegenerate: exact form of the Stark ionization width for the ground state, $\Gamma \approx \frac{4}{F}e^{-2/3F}$ in atomic units?
- degenerate: is $p^4$ actually non-Hermitian on $s$ states, or does the naive calculation just fail? (Lindgren in lecture: "wait for Dirac". Want a better answer.)
- degenerate: matrix element between $2s_{1/2}$ and $2p_{1/2}$ in the quasi-degenerate Stark problem — is it $\sqrt3\,eEa_0$?
- variational: Kato cusp condition for $r_{12} \to 0$ in helium: $+\frac12$?
- WKB: Langer correction — why $(l + \frac12)^2$ and not something else? He said "the radial variable is $\ln r$" which I didn't follow.
- TDPT: which convention for $H' = V\cos\omega t$ will the final use? (factor of 4)
- TDPT: why drop counter-rotating terms even for broadband light?
- midterm 1, problem 3: I think I deserve 2 of the 4 points back — I wrote $j = \frac32$ in the setup and only substituted $l$ in the last line. Bring the exam Tuesday.

## logistics / reminders

- PS7 (WKB) due Mon Nov 2. Problems 4–5 on scratch paper.
- PS8 (TDPT, golden rule) posted Nov 2, due Nov 9.
- Lindgren wants the photo of the board from Oct 26 posted to the course page; he said he'd do it. If not, ask Priya for hers.
- Problem sessions before midterm 2: Mon Nov 16 evening.
