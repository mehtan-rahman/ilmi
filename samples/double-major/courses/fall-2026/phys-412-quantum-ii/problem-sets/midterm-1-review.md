---
type: deck
title: midterm 1 review
default-card: qa
exam: 2026-10-21
score: 74/100
---

Midterm 1, Wed Oct 21, back Mon Oct 26. 74/100 (median 68). Covered nondegenerate + degenerate PT, fine structure, Zeeman, variational through helium. Every card here is something I got wrong or nearly wrong. Lindgren: "the final is cumulative and I recycle ideas, not problems."

Mistakes, by problem:

| problem | topic | lost | what happened |
| --- | --- | --- | --- |
| 1 | $x^4$ oscillator, second order | 6 | sign of energy denominator |
| 2 | Stark $n=2$ | 10 | used nondegenerate formula, got zero |
| 3 | fine structure $n=3$ | 4 | used $l$ in place of $j$ for $3d_{3/2}$ |
| 4 | helium, effective $Z$ | 6 | $\langle 1/r\rangle = 1/a$ instead of $Z/a$ |

(Can't make cards in the table, so the same four are below.)

(P1) the denominator in $E_n^2 = \sum_{m\ne n}\dfrac{|H'_{mn}|^2}{(\ldots)}$ is {{c1::$E_n^0 - E_m^0$}} — the state being corrected first, so the ground-state shift comes out negative ^qmmt-sign
<!-- sr due=2026-10-30 st=review s=3.6 d=7.4 r=3 l=1 ivl=3 last=2026-10-27T08:22:00Z g=3 -->

(P2) the $n=2$ Stark problem: what's wrong with computing $\langle 2lm|eEz|2lm\rangle$ for each state?
?
$n=2$ is degenerate and $z$ connects $|200\rangle$ and $|210\rangle$; the diagonal elements are all zero by parity, but that's the wrong basis. Diagonalize $W$ in the 4-state subspace: shifts $\pm3eEa_0$, 0, 0 ^qmmt-stark
<!-- sr due=2026-10-30T15:20:00Z st=relearning s=0.6 d=8.1 r=4 l=1 steps=1 ivl=0 last=2026-10-30T15:10:00Z g=1 -->

(P3) the fine-structure formula $E_{nj}$ depends on {{c1::$n$ and $j$ only}}; for $3d_{3/2}$ plug in $j = \frac32$, not $l = 2$ ^qmmt-j
<!-- sr due=2026-11-05 st=review s=8.7 d=6 r=3 l=0 ivl=9 last=2026-10-27T20:40:00Z g=3 -->

(P4) for a $1s$ orbital with nuclear charge $Z$, $\left\langle\dfrac1r\right\rangle = {{c1::\dfrac{Z}{a}}}$ ^qmmt-r
<!-- sr due=2026-11-03 st=review s=6.9 d=6.2 r=3 l=0 ivl=7 last=2026-10-27T11:05:00Z g=3 -->

(P4, cont.) with the wrong $\langle 1/r\rangle = 1/a$, what $Z_{\text{eff}}$ came out, and why should that have been a red flag?
?
I had $\langle H\rangle = [2Z^2 - 4(Z-2) - \frac54Z]E_1$, set the derivative to zero and got $Z = \frac{21}{16}$. But with $E_1 < 0$ that bracket makes $\langle H\rangle$ concave down in $Z$: the stationary point is a maximum, and $\langle H\rangle \to -\infty$ as $Z \to \infty$, which no variational energy can do ($\langle H\rangle \ge E_{gs}$). An energy unbounded below means the expectation values are wrong ^qmmt-redflag
<!-- sr due=2026-11-01 st=review s=4.2 d=6.8 r=2 l=0 ivl=4 last=2026-10-28T09:30:00Z g=3 -->

(P5, didn't lose points but guessed) the variational principle bounds an excited state only if the trial function is {{c1::orthogonal to every lower eigenstate}} (e.g. by symmetry) ^qmmt-orth
<!-- sr st=new -->

General lesson, written in red on the front of the exam: before computing anything, ask (1) is the level degenerate, (2) what commutes with $H'$, (3) what does parity kill. Problem 2 would have taken five minutes.
