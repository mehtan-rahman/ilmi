---
type: deck
title: problem set 5
default-card: qa
due: 2026-10-02
topic: degenerate PT, fine structure, Zeeman
---

Derivation drills from PS5 (handed back Oct 9, 47/50; lost 3 on #4 for the strong-field ordering). Each card is one step I want to be able to do cold.

(1) 2D isotropic oscillator, $H' = \epsilon m\omega^2xy$: first-order shifts of the first excited level
?
degenerate pair $|10\rangle, |01\rangle$; $xy$ connects them only: $\langle10|xy|01\rangle = \langle1|x|0\rangle\langle0|y|1\rangle = \frac{\hbar}{2m\omega}$, diagonal elements vanish
$$W = \frac{\epsilon\hbar\omega}{2}\begin{pmatrix}0&1\\1&0\end{pmatrix}\;\Rightarrow\; E^1_\pm = \pm\frac{\epsilon\hbar\omega}{2},\quad |\pm\rangle = \frac{|10\rangle\pm|01\rangle}{\sqrt2}$$ ^qmps5-xy
<!-- sr due=2026-11-21 st=review s=37.4 d=4.4 r=5 l=0 ivl=37 last=2026-10-15T07:36:00Z g=3 -->

(1, cont.) exact check of the $xy$ perturbation
?
rotate to $u, v = (x\pm y)/\sqrt2$: $xy = \frac12(u^2 - v^2)$, so $V = \frac12m\omega^2[(1+\epsilon)u^2 + (1-\epsilon)v^2]$, frequencies $\omega_\pm = \omega\sqrt{1\pm\epsilon} \approx \omega(1 \pm \frac\epsilon2)$
first excited states $\frac32\hbar\omega_\pm + \frac12\hbar\omega_\mp \approx 2\hbar\omega \pm \frac{\epsilon\hbar\omega}{2}$, matching PT ^qmps5-xyexact
<!-- sr due=2026-10-29 st=review s=12.6 d=6.5 r=6 l=1 ivl=13 last=2026-10-16T18:20:00Z g=3 -->

(3) spin-orbit numerator $j(j+1) - l(l+1) - \frac34$ for $j = l\pm\frac12$
?
$j = l + \frac12$: $(l+\frac12)(l+\frac32) - l^2 - l - \frac34 = l$
$j = l - \frac12$: $(l-\frac12)(l+\frac12) - l^2 - l - \frac34 = -(l+1)$ ^qmps5-num
<!-- sr due=2026-12-06 st=review s=50.6 d=3 r=5 l=0 ivl=51 last=2026-10-16T09:02:00Z g=4 -->

(3, cont.) show the fine-structure sum depends only on $j$, for $j = l - \frac12$
?
$E_{so}^1 = -\frac{(E_n)^2}{mc^2}\frac{n}{l(l+\frac12)}$, add $E_r^1 = -\frac{(E_n)^2}{2mc^2}\left[\frac{4n}{l+\frac12} - 3\right]$:
$$\frac{(E_n)^2}{2mc^2}\left[3 - \frac{4nl + 2n}{l(l+\frac12)}\right] = \frac{(E_n)^2}{2mc^2}\left[3 - \frac{4n}{l}\right]$$
and $l = j + \frac12$ ✓ ^qmps5-jlower
<!-- sr due=2026-10-30 st=review s=9.2 d=7 r=6 l=2 ivl=9 last=2026-10-21T06:48:00Z g=3 -->

the $\langle 1/r^3\rangle$ needed for spin-orbit is $\dfrac{1}{{{c1::l(l+\frac12)(l+1)}}\,n^3a^3}$ ^qmps5-r3
<!-- sr due=2026-11-04 st=review s=19.5 d=5.4 r=5 l=1 ivl=20 last=2026-10-15T12:11:00Z g=3 -->

(4) strong-field (Paschen–Back) Zeeman energies
?
good basis $|nlm_lm_s\rangle$; $H'_Z = \frac{e}{2m}B(L_z + 2S_z)$ is diagonal, so
$$E^1_Z = \mu_BB\,(m_l + 2m_s)$$
fine structure then added as a first-order correction in this basis ^qmps5-pb
<!-- sr due=2026-11-10 st=review s=26 d=5.2 r=5 l=1 ivl=26 last=2026-10-15T21:14:00Z g=3 -->

(2) hydrogen $n=2$ with fine structure: {{c1::$2s_{1/2}$ and $2p_{1/2}$}} stay degenerate (8 states total: 2 + 2 + 4) ^qmps5-n2
<!-- sr due=2026-12-14 st=review s=58 d=2.6 r=5 l=0 ivl=58 last=2026-10-17T10:40:00Z g=4 -->

(5) why $H' = eEz$ can't connect states of different $m$ :: $[L_z, z] = 0$, so $\langle m'|z|m\rangle(m'-m)\hbar = 0$ ^qmps5-dm
<!-- sr due=2026-11-16 st=review s=31.3 d=3.9 r=5 l=0 ivl=31 last=2026-10-16T08:47:00Z g=3 -->
