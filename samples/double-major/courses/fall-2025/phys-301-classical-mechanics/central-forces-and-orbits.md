---
title: central forces and orbits
course: PHYS 301
lectures: 2025-11-17 to 2025-12-08
---

## reduction to one body

Two particles, interaction depends only on separation: $V(|\mathbf{r}_1 - \mathbf{r}_2|)$. Center of mass $\mathbf{R} = (m_1\mathbf{r}_1 + m_2\mathbf{r}_2)/M$, relative coordinate $\mathbf{r} = \mathbf{r}_1 - \mathbf{r}_2$.

$$L = \tfrac12 M\dot{\mathbf{R}}^2 + \tfrac12\mu\dot{\mathbf{r}}^2 - V(r),\qquad \mu = \frac{m_1m_2}{m_1+m_2}.$$

$\mathbf{R}$ is cyclic (all three components), so the CM moves uniformly and we drop it. What's left is one particle of mass $\mu$ in a fixed central potential.

$V$ depends only on $r$, so the problem is rotationally symmetric and $\mathbf{L} = \mathbf{r}\times\mathbf{p}$ is conserved (Noether). Direction of $\mathbf{L}$ fixed ⇒ motion in the plane perpendicular to it. Polar coordinates in that plane:

$$L = \tfrac12\mu(\dot r^2 + r^2\dot\theta^2) - V(r).$$

$\theta$ cyclic: $\ell \equiv \mu r^2\dot\theta$ is constant. (Writing the magnitude as $\ell$ to keep it apart from the Lagrangian.) Geometrically: areal velocity $dA/dt = \tfrac12 r^2\dot\theta = \ell/2\mu$ is constant. That's Kepler's second law, and it holds for *any* central force.

Kepler's second law (equal areas in equal times) holds for {{c1::any central force}}, because $dA/dt = {{c2::\ell/2\mu}}$ ^cm-kepler2
<!-- sr c1 due=2026-12-28 st=review s=189 d=2.6 r=9 l=0 ivl=189 last=2026-06-22T07:30:00Z g=4 -->
<!-- sr c2 due=2026-12-02 st=review s=117 d=4.3 r=10 l=1 ivl=117 last=2026-08-07T08:44:00Z g=3 -->

## effective potential

Energy is conserved (scleronomic, $V$ velocity-independent):

$$E = \tfrac12\mu\dot r^2 + \frac{\ell^2}{2\mu r^2} + V(r) = \tfrac12\mu\dot r^2 + U_{\text{eff}}(r).$$

The centrifugal barrier $\ell^2/2\mu r^2$ is really kinetic energy of the angular motion, rewritten using the conserved $\ell$. Radial motion is 1D motion in $U_{\text{eff}}$, and everything qualitative follows from the picture:

- turning points (apsides) where $E = U_{\text{eff}}(r)$;
- bounded motion between $r_{\min}$ and $r_{\max}$ if $E$ sits in a well; unbounded if $E$ is above the far asymptote;
- circular orbit at a minimum of $U_{\text{eff}}$ (stable) or a maximum (unstable).

Formal solution: $t = \int dr\big/\sqrt{\tfrac{2}{\mu}(E - U_{\text{eff}})}$, and for the orbit shape, using $d\theta = (\ell/\mu r^2)\,dt$,

$$\theta - \theta_0 = \int\frac{\ell\,dr}{r^2\sqrt{2\mu\left(E - V(r)\right) - \ell^2/r^2}}.$$

**Stability of circular orbits, power-law force.** Attractive force of magnitude $f(r) = kr^n$. Circular orbit at $r_0$: $U'_{\text{eff}}(r_0) = 0$, i.e. $f(r_0) = \ell^2/\mu r_0^3$. Second derivative:

$$U''_{\text{eff}}(r_0) = f'(r_0) + \frac{3\ell^2}{\mu r_0^4} = \frac{f(r_0)}{r_0}\left(n + 3\right).$$

Stable iff $n > -3$. So $1/r^2$ (gravity, $n = -2$) and Hooke ($n = 1$) are fine, $1/r^4$ and steeper isn't, and $n = -3$ exactly is marginal (the centrifugal term has the same power as the force: you can balance at any $r$ for exactly one $\ell$, and any perturbation spirals).

Radial oscillation frequency about the circular orbit: $\omega_r^2 = U''_{\text{eff}}/\mu = (n+3)\,\ell^2/\mu^2r_0^4$, while the orbital frequency is $\omega_\theta = \ell/\mu r_0^2$. So $\omega_r/\omega_\theta = \sqrt{n+3}$, and the **apsidal angle** (from periapsis to the next apoapsis) is

$$\Delta\theta = \frac{\pi}{\sqrt{n+3}}.$$

Gravity: $\pi$ (closed ellipse, focus at center). Hooke: $\pi/2$ (closed ellipse, *center* at center). Anything else near-circular precesses. Bertrand's theorem: those two are the only power laws for which *all* bound orbits close. Lindgren stated it, didn't prove it.

a circular orbit in an attractive force $f = kr^n$ is stable iff {{c1::$n > -3$}} ^cm-circ-stab
<!-- sr due=2027-01-18 st=review s=171 d=3.2 r=10 l=0 ivl=171 last=2026-07-31T14:05:00Z g=3 -->

derive the apsidal angle for a near-circular orbit in an attractive force $f = kr^n$
?
circular orbit: $f(r_0) = \ell^2/\mu r_0^3$; then $U''_{\text{eff}}(r_0) = f'(r_0) + 3\ell^2/\mu r_0^4 = (n+3)f(r_0)/r_0$
$$\omega_r^2 = \frac{U''_{\text{eff}}}{\mu} = (n+3)\frac{\ell^2}{\mu^2r_0^4} = (n+3)\,\omega_\theta^2$$
peri to apo is half a radial period: $\Delta\theta = \omega_\theta\cdot\pi/\omega_r = \pi/\sqrt{n+3}$
gravity $\pi$, Hooke $\pi/2$ ^cm-apsidal
<!-- sr due=2026-10-30 st=review s=58 d=7.2 r=12 l=3 ivl=58 last=2026-09-02T19:18:00Z g=3 -->

## Binet equation

Change variable to $u = 1/r$ and use $\theta$ as the independent variable. With $\dot\theta = \ell u^2/\mu$:

$$\dot r = -\frac{1}{u^2}\frac{du}{d\theta}\dot\theta = -\frac{\ell}{\mu}\frac{du}{d\theta},\qquad \ddot r = -\frac{\ell}{\mu}\frac{d^2u}{d\theta^2}\dot\theta = -\frac{\ell^2u^2}{\mu^2}\frac{d^2u}{d\theta^2}.$$

Radial equation $\mu(\ddot r - r\dot\theta^2) = F(r)$ ($F$ the radial component, negative if attractive), with $r\dot\theta^2 = \ell^2u^3/\mu^2$:

$$\frac{d^2u}{d\theta^2} + u = -\frac{\mu}{\ell^2u^2}\,F(1/u).$$

Two uses: given $F$ find the orbit; given an orbit, find the $F$ that produces it (the direction Newton needed for Kepler's first law).

the Binet equation for a radial force $F(r)$, with $u = 1/r$ :: $\dfrac{d^2u}{d\theta^2} + u = -\dfrac{\mu}{\ell^2u^2}F(1/u)$ ^cm-binet
<!-- sr due=2026-10-30 st=review s=6.3 d=8.8 r=13 l=4 ivl=6 last=2026-10-24T08:20:00Z g=2 -->

**Worked example (orbit → force).** A particle moves on a circle that passes through the force center: $r = 2a\cos\theta$. Find $F(r)$.

$u = \sec\theta/2a$. $u' = \sec\theta\tan\theta/2a$. $u'' = (\sec\theta\tan^2\theta + \sec^3\theta)/2a = (2\sec^3\theta - \sec\theta)/2a$. So

$$u'' + u = \frac{\sec^3\theta}{a} = \frac{(2au)^3}{a} = 8a^2u^3.$$

Binet: $F = -\dfrac{\ell^2u^2}{\mu}\cdot8a^2u^3 = -\dfrac{8\ell^2a^2}{\mu\,r^5}$. Attractive, $\propto r^{-5}$. (Steeper than $r^{-3}$, consistent with that orbit not being a stable circle about the center: it plunges into the center in finite time. Takes $\theta\to\pi/2$.) This was PS11 #2; graded "nice" in red, framed it mentally.

the force law for a circular orbit passing through the force center ($r = 2a\cos\theta$) is {{c1::attractive $\propto 1/r^5$}} ^cm-r5
<!-- sr due=2026-11-15 st=review s=93 d=5.1 r=9 l=1 ivl=93 last=2026-08-14T08:07:00Z g=3 -->

## the Kepler problem

$F = -k/r^2$ ($k = Gm_1m_2$, or $-q_1q_2/4\pi\epsilon_0$ for attractive Coulomb). Binet:

$$u'' + u = \frac{\mu k}{\ell^2}\quad\Longrightarrow\quad u = \frac{\mu k}{\ell^2}\left(1 + e\cos(\theta - \theta_0)\right).$$

So the orbit is a conic with focus at the origin:

$$r(\theta) = \frac{p}{1 + e\cos\theta},\qquad p = \frac{\ell^2}{\mu k}\ (\text{semi-latus rectum}).$$

$e$ from the energy: at periapsis $\dot r = 0$, plug into $E = U_{\text{eff}}$:

$$e = \sqrt{1 + \frac{2E\ell^2}{\mu k^2}}.$$

| $E$ | $e$ | orbit |
| --- | --- | --- |
| $-\mu k^2/2\ell^2$ (minimum of $U_{\text{eff}}$) | $0$ | circle |
| $<0$ | $<1$ | ellipse |
| $0$ | $1$ | parabola |
| $>0$ | $>1$ | hyperbola |

Ellipse: semi-major axis $a = p/(1-e^2) = -k/2E$. **Energy depends only on $a$**, not on $\ell$ or $e$. Semi-minor $b = a\sqrt{1-e^2}$.

**Third law.** Period = area / areal rate: $T = \pi ab\big/(\ell/2\mu)$. Square it and use $b^2 = a^2(1-e^2) = ap$, $p = \ell^2/\mu k$:

$$T^2 = \frac{4\pi^2\mu^2a^3p}{\ell^2} = \frac{4\pi^2\mu}{k}a^3 = \frac{4\pi^2}{G(m_1+m_2)}a^3.$$

The $m_1+m_2$ is the reduced-mass correction to Kepler's version; for planets it's tiny, for binary stars it's how you weigh them.

the eccentricity of a Kepler orbit in terms of $E$ and $\ell$ is $e = {{c1::\sqrt{1 + \dfrac{2E\ell^2}{\mu k^2}}}}$ ^cm-ecc
<!-- sr due=2026-11-03 st=review s=12 d=7.9 r=14 l=3 ivl=12 last=2026-10-22T07:44:00Z g=3 -->

the energy of a bound Kepler orbit depends only on {{c1::the semi-major axis: $E = -k/2a$}} ^cm-kepler-E
<!-- sr due=2027-01-25 st=review s=203 d=2.4 r=10 l=0 ivl=203 last=2026-07-06T08:59:00Z g=4 -->

derive Kepler's third law with the reduced mass
?
period = area/areal rate: $T = \pi ab/(\ell/2\mu)$, with $b^2 = a^2(1-e^2) = ap$ and $p = \ell^2/\mu k$
$$T^2 = \frac{4\pi^2\mu^2a^3p}{\ell^2} = \frac{4\pi^2\mu}{k}a^3$$
with $k = Gm_1m_2$: $T^2 = 4\pi^2a^3/G(m_1+m_2)$ ^cm-kepler3
<!-- sr due=2026-12-15 st=review s=124 d=4.6 r=11 l=1 ivl=124 last=2026-08-13T09:27:00Z g=3 -->

## unbound orbits and Rutherford scattering

Lec 2025-12-03, the last real lecture. For $E > 0$ the orbit is a hyperbola and the question becomes: by what angle $\Theta$ is the particle deflected, as a function of its impact parameter $b$? The incoming speed $v_\infty$ fixes $E = \tfrac12\mu v_\infty^2$ and $b$ fixes $\ell = \mu v_\infty b$.

Repulsive Coulomb, $F = +k/r^2$ with $k = q_1q_2/4\pi\epsilon_0 > 0$. Binet gives $u = -\frac{\mu k}{\ell^2} + C\cos(\theta - \theta_0)$, a hyperbola whose asymptotes make an angle set by the eccentricity. The deflection comes out as

$$b = \frac{k}{2E}\cot\frac{\Theta}{2}.$$

Particles with impact parameter between $b$ and $b + db$ go into the ring of solid angle $2\pi\sin\Theta\,d\Theta$, so $\dfrac{d\sigma}{d\Omega} = \dfrac{b}{\sin\Theta}\left|\dfrac{db}{d\Theta}\right|$, and with the relation above

$$\frac{d\sigma}{d\Omega} = \left(\frac{k}{4E}\right)^2\frac{1}{\sin^4(\Theta/2)}.$$

The total cross section diverges (the $\Theta\to0$ end: Coulomb's long range means every particle is deflected a little). Lindgren: "the same formula falls out of the Born approximation in QM, which is a coincidence of the $1/r$ potential and nothing else." Classically the attractive case gives the same $d\sigma/d\Omega$, since only $k^2$ appears.

The large-angle tail is what Geiger and Marsden saw, and $\Theta = \pi$ (head-on) gives the distance of closest approach $r_{\min} = k/E$, which bounded the size of the nucleus.

the Rutherford cross section is $\dfrac{d\sigma}{d\Omega} = {{c1::\left(\dfrac{k}{4E}\right)^2\dfrac{1}{\sin^4(\Theta/2)}}}$ ^cm-rutherford
<!-- sr due=2027-01-05 st=review s=98 d=5.6 r=10 l=1 ivl=98 last=2026-09-29T21:16:00Z g=3 -->

**Turning points, a quick one from the final.** For $V = -k/r$, the apsides are the roots of $E r^2 + kr - \ell^2/2\mu = 0$. For $E<0$ both roots are positive and their sum is $r_{\min} + r_{\max} = -k/E = 2a$. Which is the cleanest way to see $a = -k/2E$ and the one I should have used on the final instead of the semi-latus rectum.

## the Laplace–Runge–Lenz vector

For $1/r^2$ forces only there's an extra conserved vector:

$$\mathbf{A} = \mathbf{p}\times\mathbf{L} - \mu k\,\hat{\mathbf{r}}.$$

($\dot{\mathbf{A}} = 0$ is a two-line computation using $\dot{\mathbf{p}} = -k\hat{\mathbf{r}}/r^2$ and $\frac{d}{dt}\hat{\mathbf{r}} = (\mathbf{L}\times\hat{\mathbf{r}})/\mu r^2$... sign: $\dot{\hat{\mathbf r}} = \dot\theta\hat{\boldsymbol\theta}$ and $\mathbf{L}\times\hat{\mathbf r} = \ell\,\hat{\mathbf z}\times\hat{\mathbf r} = \ell\hat{\boldsymbol\theta}$, ✓.) It lies in the orbital plane and points to periapsis. Dotting with $\mathbf{r}$:

$$\mathbf{A}\cdot\mathbf{r} = Ar\cos\theta = \mathbf{L}\cdot(\mathbf{r}\times\mathbf{p}) - \mu kr = \ell^2 - \mu kr \quad\Longrightarrow\quad r = \frac{\ell^2/\mu k}{1 + (A/\mu k)\cos\theta}.$$

The orbit equation with no differential equation at all, and $|\mathbf{A}| = \mu ke$. Its conservation is why Kepler orbits close: there's a hidden symmetry beyond rotations (SO(4) for bound orbits). [this is why hydrogen's levels are degenerate in $\ell$ — Lindgren's aside, and it came back in QM I in spring.]

the Laplace–Runge–Lenz vector $\mathbf{A} = \mathbf{p}\times\mathbf{L} - \mu k\hat{\mathbf r}$ has magnitude {{c1::$\mu ke$}}, and it points to {{c2::periapsis}} ^cm-lrl
<!-- sr c1 due=2026-11-16 st=review s=76 d=6 r=11 l=2 ivl=76 last=2026-09-01T18:12:00Z g=3 -->
<!-- sr c2 due=2027-01-18 st=review s=181 d=2.9 r=10 l=0 ivl=181 last=2026-07-21T08:33:00Z g=4 -->

## precession from a small $1/r^3$ term

Add $F = -k/r^2 - c/r^3$ with $c$ small. Binet:

$$u'' + \left(1 - \frac{\mu c}{\ell^2}\right)u = \frac{\mu k}{\ell^2}\quad\Longrightarrow\quad u = \frac{\mu k}{\beta^2\ell^2}\left(1 + e\cos\beta\theta\right),\qquad \beta = \sqrt{1 - \frac{\mu c}{\ell^2}}.$$

Periapsis recurs every $2\pi/\beta$, so it advances by $\delta = 2\pi(1/\beta - 1) \approx \pi\mu c/\ell^2$ per orbit, prograde for $c > 0$. GR's correction acts like such a term; the result for Mercury is $\delta = 6\pi GM/c^2a(1-e^2)$ per orbit, the famous 43″ per century. (The $c$ in that formula is the speed of light, sorry.)

a small extra attractive $c/r^3$ force makes a Kepler orbit precess by about {{c1::$\pi\mu c/\ell^2$}} per revolution ^cm-precess
<!-- sr due=2026-10-31 st=review s=64 d=6.8 r=10 l=2 ivl=64 last=2026-08-28T07:51:00Z g=3 -->
