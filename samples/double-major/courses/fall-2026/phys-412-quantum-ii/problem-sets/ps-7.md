---
type: deck
title: problem set 7
default-card: qa
due: 2026-11-02
topic: WKB
---

PS7, due Mon Nov 2. Half done (1–3 written, 4–5 on scratch paper). Cards as I go; not studied yet except the first two.

(1) bouncing ball: $V = mgx$ for $x > 0$, hard floor at $x = 0$. WKB energies
?
one hard wall, one soft turning point at $x_2 = E/mg$: $\int_0^{x_2}\sqrt{2m(E - mgx)}\,dx = \frac{2\sqrt{2m}}{3mg}E^{3/2} = \left(n - \frac14\right)\pi\hbar$
$$E_n = \left[\frac98\pi^2\,mg^2\hbar^2\left(n - \frac14\right)^2\right]^{1/3}$$ ^qmps7-ball
<!-- sr due=2026-10-31 st=review s=2.3 d=6.1 r=2 l=0 ivl=2 last=2026-10-29T19:12:00Z g=3 -->

(1, cont.) for the bouncing ball, WKB is good even for $n=1$ because {{c1::the potential is exactly linear, so the connection formula at the turning point is exact}}; what's left is the error of WKB's asymptotic form of Airy, about 1% already at $n = 1$ ^qmps7-ballwhy
<!-- sr due=2026-10-31 st=review s=1.8 d=6.6 r=2 l=0 ivl=1 last=2026-10-30T07:58:00Z g=3 -->

(2) V-shaped well $V = \alpha|x|$: WKB energies
?
two soft turning points $\pm E/\alpha$: $\int p\,dx = 2\sqrt{2m}\int_0^{E/\alpha}\sqrt{E - \alpha x}\,dx = \frac{4\sqrt{2m}}{3\alpha}E^{3/2} = \left(n - \frac12\right)\pi\hbar$
$$E_n = \left[\frac{3\pi\hbar\alpha\left(n - \frac12\right)}{4\sqrt{2m}}\right]^{2/3}$$ ^qmps7-vee

(3) rectangular barrier, height $V_0$, width $L$, WKB exponent: $\gamma = {{c1::\frac{L}{\hbar}\sqrt{2m(V_0 - E)}}}$ ^qmps7-rect

(4) where does WKB fail for the oscillator ground state?
?
everywhere, roughly: $|\hbar p'/p^2|$ is $O(1)$ across most of the classically allowed region for $n = 0$ (only about half a wavelength fits between the turning points); the quantization still comes out exact, which is the oscillator's accident ^qmps7-ho

(5) power-law well $V = \alpha|x|^\nu$: $E_n \propto \left(n - \frac12\right)^{{c1::2\nu/(\nu+2)}}$ ^qmps7-power
