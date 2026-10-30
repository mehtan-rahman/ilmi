---
type: deck
title: problem set 6
default-card: qa
due: 2026-10-16
topic: variational method
---

PS6, due Fri Oct 16 (the Friday before the midterm). Back on Oct 23, 44/50. Drills for the steps I fumbled or that I want for the final.

(1) Gaussian trial for hydrogen, $\psi = (2b/\pi)^{3/4}e^{-br^2}$: the two expectation values
?
$$\langle T\rangle = \frac{3\hbar^2b}{2m}, \qquad \langle V\rangle = -\frac{e^2}{4\pi\epsilon_0}\,2\sqrt{\frac{2b}{\pi}}$$
($\langle p^2\rangle = 3\hbar^2b$: each Cartesian direction gives $\hbar^2b$) ^qmps6-gauss
<!-- sr due=2026-11-07 st=review s=15.8 d=5.6 r=4 l=0 ivl=16 last=2026-10-22T13:19:00Z g=3 -->

(1, cont.) minimize the Gaussian hydrogen energy
?
with $k = e^2/4\pi\epsilon_0$: $\frac{d}{db}\left[\frac{3\hbar^2b}{2m} - 2k\sqrt{\tfrac{2b}{\pi}}\right] = 0 \Rightarrow b = \frac{8m^2k^2}{9\pi\hbar^4}$
$$E_{\min} = -\frac{4mk^2}{3\pi\hbar^2} = -\frac{8}{3\pi}\cdot\frac{mk^2}{2\hbar^2} = -\frac{8}{3\pi}(13.6\text{ eV})$$ ^qmps6-gmin
<!-- sr due=2026-10-30 st=review s=7.9 d=6.9 r=4 l=1 ivl=8 last=2026-10-22T18:02:00Z g=3 -->

(2) delta well $-\alpha\delta(x)$, Gaussian trial $(2b/\pi)^{1/4}e^{-bx^2}$
?
$\langle T\rangle = \frac{\hbar^2b}{2m}$, $\langle V\rangle = -\alpha|\psi(0)|^2 = -\alpha\sqrt{\frac{2b}{\pi}}$; minimizing gives $b = \frac{2m^2\alpha^2}{\pi\hbar^4}$ and
$$E_{\min} = -\frac{m\alpha^2}{\pi\hbar^2} \;>\; -\frac{m\alpha^2}{2\hbar^2}\text{ (exact)}$$ ^qmps6-delta
<!-- sr due=2026-11-09 st=review s=17.6 d=5 r=3 l=0 ivl=18 last=2026-10-22T08:55:00Z g=3 -->

(3) harmonic oscillator with $\psi = \sqrt b\,e^{-b|x|}$ gives $\langle H\rangle_{\min} = {{c1::\frac{\hbar\omega}{\sqrt2}}}$, about 41% above the true $\frac12\hbar\omega$ ^qmps6-exp
<!-- sr due=2026-11-03 st=review s=12.1 d=5.8 r=3 l=0 ivl=12 last=2026-10-22T10:30:00Z g=3 -->

(3, cont.) why is the exponential trial so bad for the oscillator? :: it has a kink at $x=0$ (the true $\psi$ is smooth there, since $V$ is) and decays like $e^{-b|x|}$ instead of $e^{-x^2}$ ^qmps6-kink
<!-- sr due=2026-11-12 st=review s=20.4 d=4.6 r=3 l=0 ivl=20 last=2026-10-23T07:44:00Z g=4 -->

(4) the parabola $x(a-x)$ in the infinite well gives $\langle H\rangle = {{c1::\frac{5\hbar^2}{ma^2}}}$, vs exact $\frac{\pi^2\hbar^2}{2ma^2}$ ^qmps6-parab
<!-- sr st=new -->

(5) (bonus, skipped) intermediate-field Zeeman for $n=2$: diagonalize $H'_{fs} + H'_Z$ together in the $l=1$ block
?
[haven't done it; Lindgren's solutions have the $2\times2$ blocks for $m_j = \pm\frac12$ and diagonal $m_j = \pm\frac32$] ^qmps6-bonus
<!-- sr sus=1 -->
