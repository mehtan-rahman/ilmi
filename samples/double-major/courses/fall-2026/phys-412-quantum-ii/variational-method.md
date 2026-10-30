---
title: variational method
lectures: 2026-09-30, 10-02, 10-05, 10-07, 10-09, 10-12
---

## the theorem

Lectures 13–18. Typed Oct 6–13 (helium on the 10th, H₂⁺ on the 13th; the last part is sketchier because I was also studying for the midterm).

Perturbation theory needs a solvable $H^0$ close to $H$. The variational method needs nothing: pick any normalized $|\psi\rangle$ and

$$E_{gs} \leq \langle\psi|H|\psi\rangle \equiv \langle H\rangle.$$

Proof. Expand in the (unknown) eigenbasis of $H$: $|\psi\rangle = \sum_n c_n|n\rangle$, $\sum_n|c_n|^2 = 1$. Then

$$\langle H\rangle = \sum_n |c_n|^2 E_n \geq E_{gs}\sum_n|c_n|^2 = E_{gs}$$

since every $E_n \geq E_{gs}$. Equality iff $|\psi\rangle$ is the ground state (up to phase), assuming the ground state is nondegenerate.

If the spectrum has a continuum the sum becomes sum + integral and the argument is identical. If $|\psi\rangle$ isn't normalized, use $\langle\psi|H|\psi\rangle/\langle\psi|\psi\rangle$ (the Rayleigh quotient).

prove the variational principle $E_{gs} \le \langle\psi|H|\psi\rangle$
?
expand $|\psi\rangle = \sum c_n|n\rangle$ in eigenstates of $H$ with $\sum|c_n|^2 = 1$:
$$\langle H\rangle = \sum_n|c_n|^2E_n \ge E_{gs}\sum_n|c_n|^2 = E_{gs}$$ ^qm3-proof
<!-- sr due=2026-11-12 st=review s=27 d=3.1 r=4 l=0 ivl=27 last=2026-10-16T08:15:00Z g=4 -->

The practical method: choose a family $\psi(\mathbf r; b_1, b_2, \ldots)$, compute $\langle H\rangle(b_i)$, minimize. The minimum is the best upper bound within the family.

Things Lindgren emphasized:

- The energy is much more accurate than the wavefunction. If $|\psi\rangle = |0\rangle + \epsilon|\chi\rangle$ with $\chi \perp 0$, then $\langle H\rangle - E_{gs} = O(\epsilon^2)$. An error of 10% in the wavefunction is an error of about 1% in the energy. (Equivalently: $E$ is stationary at eigenstates.)
- It gives an upper bound, never a lower bound. You never know how close you are without other information. (Temple's inequality gives a lower bound if you also know $\langle H^2\rangle$ and a bound on $E_1$; mentioned, not covered.)
- Excited states: if $|\psi\rangle$ is orthogonal to the ground state, $\langle H\rangle \geq E_1$. In practice this works when symmetry guarantees orthogonality, e.g. an odd trial function in a symmetric 1D potential bounds the first excited state. You can't just "subtract off" an approximate ground state and get a rigorous bound.

the variational energy error is {{c1::second order}} in the error of the trial wavefunction, because $\langle H\rangle$ is {{c2::stationary}} at eigenstates ^qm3-second
<!-- sr c1 due=2026-11-01 st=review s=16.4 d=4.6 r=4 l=0 ivl=16 last=2026-10-16T16:52:00Z g=3 -->
<!-- sr c2 due=2026-10-29 st=review s=13.2 d=5.2 r=4 l=0 ivl=13 last=2026-10-16T16:52:00Z g=3 -->

an odd trial function in a symmetric 1D potential gives an upper bound on {{c1::the first excited state}}, because it is automatically {{c2::orthogonal to the (even) ground state}} ^qm3-excited
<!-- sr c1 due=2026-11-08 st=review s=22.6 d=4 r=3 l=0 ivl=23 last=2026-10-16T21:30:00Z g=3 -->
<!-- sr c2 due=2026-10-30 st=review s=4.1 d=7.6 r=4 l=1 ivl=4 last=2026-10-26T09:40:00Z g=3 -->

## warm-up examples (lecture 13)

### harmonic oscillator with a Gaussian

$\psi(x) = \left(\frac{2b}{\pi}\right)^{1/4}e^{-bx^2}$. Then $\langle T\rangle = \frac{\hbar^2b}{2m}$, $\langle V\rangle = \frac12m\omega^2\langle x^2\rangle = \frac{m\omega^2}{8b}$. Minimize $\frac{\hbar^2 b}{2m} + \frac{m\omega^2}{8b}$: $b = \frac{m\omega}{2\hbar}$, $\langle H\rangle_{\min} = \frac12\hbar\omega$. Exact, because the family contains the true ground state. (This is the test you run on your algebra.)

### hydrogen with a Gaussian

$\psi = \left(\frac{2b}{\pi}\right)^{3/4}e^{-br^2}$. $\langle T\rangle = \frac{3\hbar^2b}{2m}$, $\langle V\rangle = -\frac{e^2}{4\pi\epsilon_0}\cdot2\sqrt{\frac{2b}{\pi}}$. Minimum: $E_{\min} = -\frac{8}{3\pi}(13.6\text{ eV}) = -11.5$ eV. Off by 15% because the Gaussian has the wrong cusp at $r = 0$ and decays too fast. Full derivation in PS6.

### the infinite well with a parabola

Infinite well $[0, a]$, $\psi = \sqrt{30/a^5}\,x(a - x)$. $\langle H\rangle = -\frac{\hbar^2}{2m}\int\psi\psi'' = \frac{\hbar^2}{2m}\cdot\frac{30}{a^5}\cdot2\int_0^ax(a-x)\,dx = \frac{\hbar^2}{2m}\cdot\frac{30}{a^5}\cdot\frac{a^3}{3} = \frac{5\hbar^2}{ma^2}$. Exact $\frac{\pi^2\hbar^2}{2ma^2} = 4.935\,\frac{\hbar^2}{ma^2}$. 1.3% high, no free parameter at all. Lindgren: "a parabola is a pretty good sine."

Gaussian trial for hydrogen gives $E_{\min} = {{c1::-\frac{8}{3\pi}\,(13.6\text{ eV}) \approx -11.5\text{ eV}}}$ ^qm3-gausshyd
<!-- sr due=2026-10-27 st=review s=7.3 d=6.8 r=4 l=1 ivl=7 last=2026-10-20T07:21:00Z g=3 -->

## linear trial functions (Rayleigh–Ritz), lecture 14

The nonlinear-parameter approach (minimize over $b$) is what we do by hand. What computers do is linear: take $N$ fixed basis functions $|\phi_i\rangle$ (not necessarily orthogonal) and a trial state $|\psi\rangle = \sum_i c_i|\phi_i\rangle$. Then

$$\langle H\rangle = \frac{\sum_{ij}c_i^*c_jH_{ij}}{\sum_{ij}c_i^*c_jS_{ij}}, \qquad H_{ij} = \langle\phi_i|H|\phi_j\rangle,\quad S_{ij} = \langle\phi_i|\phi_j\rangle.$$

Setting $\partial\langle H\rangle/\partial c_i^* = 0$ gives the generalized eigenvalue problem

$$\sum_j\left(H_{ij} - E\,S_{ij}\right)c_j = 0 \quad\Longrightarrow\quad \det(H - ES) = 0,$$

the secular equation. For an orthonormal basis $S = 1$ and it's just diagonalizing $H$ in the truncated basis. Two facts:

1. The lowest root $E^{(N)}_0$ is an upper bound on $E_{gs}$ (it's a variational value).
2. Hylleraas–Undheim–MacDonald: the $k$-th root is an upper bound on the true $E_k$, for every $k \le N$, and adding a basis function can only lower each root (the roots of the $N$ and $N+1$ problems interlace). So the linear method bounds excited states without needing orthogonality to the exact lower states.

Connection to PT: degenerate PT is Rayleigh–Ritz with the basis = the degenerate subspace. Quasi-degenerate PT is Rayleigh–Ritz with the near-degenerate pair. The H₂⁺ calculation below is Rayleigh–Ritz with two basis functions, which is why the symmetric and antisymmetric combinations come out as the two roots.

in the linear variational method with $N$ basis functions, the $k$-th root of $\det(H - ES) = 0$ is {{c1::an upper bound on the true $k$-th energy}} (Hylleraas–Undheim–MacDonald) ^qm3-hum

Lindgren's aside on choosing trial functions: get the symmetry right (parity, angular momentum, exchange symmetry for identical particles), get the asymptotics right (decay rate at large $r$ set by the binding energy, $e^{-\kappa r}$ with $\kappa = \sqrt{2m|E|}/\hbar$), and get the cusp right where the potential is singular ($\psi'/\psi = -Z/a$ at a nucleus, Kato's condition). The Gaussian fails the last two for hydrogen and loses 15%. Slater-type orbitals have the right cusp and asymptotics; Gaussians are used in chemistry anyway because the multi-center integrals are analytic, and you just use many of them.

#TODO: does Kato's cusp condition apply to the $r_{12}$ coalescence in helium too? I think with $+\frac12$ instead of $-Z$. [ask in OH]

## helium ground state

Prof. said this is on the midterm. (It was. See midterm-1-review.)

### the Hamiltonian

Two electrons, nucleus $Z = 2$ treated as fixed:

$$H = -\frac{\hbar^2}{2m}\left(\nabla_1^2 + \nabla_2^2\right) - \frac{e^2}{4\pi\epsilon_0}\left(\frac{2}{r_1} + \frac{2}{r_2} - \frac{1}{|\mathbf r_1 - \mathbf r_2|}\right).$$

Without the electron–electron term $V_{ee}$, it's two independent hydrogenic atoms with $Z = 2$, ground state

$$\psi_0(\mathbf r_1, \mathbf r_2) = \psi_{100}(\mathbf r_1)\psi_{100}(\mathbf r_2) = \frac{8}{\pi a^3}e^{-2(r_1 + r_2)/a},$$

with energy $2\cdot Z^2E_1 = 8E_1 = -109$ eV ($E_1 = -13.6$ eV). Spin singlet, so the spatial part is symmetric, fine. Experiment: $-78.975$ eV. Way off. $V_{ee}$ is not small.

### first-order PT (for comparison)

$$\langle V_{ee}\rangle = \frac{e^2}{4\pi\epsilon_0}\left(\frac{8}{\pi a^3}\right)^2\int\frac{e^{-4(r_1 + r_2)/a}}{|\mathbf r_1 - \mathbf r_2|}\,d^3r_1\,d^3r_2.$$

Do the $\mathbf r_2$ integral first with $\mathbf r_1$ along its $z$ axis: $|\mathbf r_1 - \mathbf r_2| = \sqrt{r_1^2 + r_2^2 - 2r_1r_2\cos\theta_2}$, and

$$\int_0^\pi\frac{\sin\theta_2\,d\theta_2}{\sqrt{r_1^2 + r_2^2 - 2r_1r_2\cos\theta_2}} = \frac{1}{r_1r_2}\left[(r_1 + r_2) - |r_1 - r_2|\right] = \begin{cases}2/r_1 & r_2 < r_1\\ 2/r_2 & r_2 > r_1\end{cases}$$

which is just Newton's shell theorem: a shell at $r_2$ looks like a point charge at the center for $r_1 > r_2$ and gives a constant potential inside. The rest is two exponential integrals. For general $Z$ the result is

$$\langle V_{ee}\rangle = \frac{5Z}{8}\,\frac{e^2}{4\pi\epsilon_0 a} = -\frac{5Z}{4}E_1,$$

so for $Z = 2$, $\langle V_{ee}\rangle = \frac52(13.6) = 34$ eV, and $E \approx -109 + 34 = -75$ eV. Better, 5% high.

the electron–electron repulsion in the hydrogenic product state with nuclear charge $Z$ ::: $\left\langle\dfrac{e^2}{4\pi\epsilon_0|\mathbf r_1 - \mathbf r_2|}\right\rangle = \dfrac{5Z}{8}\dfrac{e^2}{4\pi\epsilon_0 a}$ ^qm3-vee
<!-- sr due=2026-10-29 st=review s=9.6 d=6.6 r=4 l=1 ivl=10 last=2026-10-19T20:05:00Z g=2 -->

the angular integral in $\langle V_{ee}\rangle$ is easy because
?
put $\mathbf r_1$ on the $z$-axis of the $\mathbf r_2$ integration; then $\int_0^\pi \frac{\sin\theta\,d\theta}{|\mathbf r_1 - \mathbf r_2|} = \frac{2}{\max(r_1, r_2)}$, i.e. the shell theorem ^qm3-shell
<!-- sr due=2026-11-06 st=review s=17.8 d=4.8 r=3 l=0 ivl=18 last=2026-10-19T09:27:00Z g=3 -->

### the variational calculation with effective $Z$

Physical idea: each electron partially screens the nucleus from the other, so each sees an effective charge less than 2. Use the product of hydrogenic $1s$ functions with charge $Z$ as a variational parameter:

$$\psi_Z(\mathbf r_1, \mathbf r_2) = \frac{Z^3}{\pi a^3}e^{-Z(r_1 + r_2)/a}.$$

This is the ground state of a fake Hamiltonian with charge $Z$ and no $V_{ee}$. Rewrite the real $H$ around it:

$$H = \underbrace{\left[-\frac{\hbar^2}{2m}\nabla_1^2 - \frac{Ze^2}{4\pi\epsilon_0r_1}\right] + \left[1\leftrightarrow2\right]}_{\text{hydrogenic, charge } Z} + \frac{e^2}{4\pi\epsilon_0}\left(\frac{Z - 2}{r_1} + \frac{Z-2}{r_2}\right) + V_{ee}.$$

Expectation values in $\psi_Z$:

- hydrogenic parts: $2Z^2E_1$
- $\left\langle\frac1r\right\rangle = \frac{Z}{a}$ for a $1s$ orbital of charge $Z$, so the correction term gives $\frac{e^2}{4\pi\epsilon_0}(Z-2)\cdot\frac{2Z}{a} = -4Z(Z-2)E_1$, using $\frac{e^2}{4\pi\epsilon_0 a} = -2E_1$
- $V_{ee}$: $-\frac54ZE_1$ from above with $Z$ the variational charge

Total:

$$\langle H\rangle(Z) = \left[2Z^2 - 4Z(Z-2) - \frac54Z\right]E_1 = \left[-2Z^2 + \frac{27}{4}Z\right]E_1.$$

Since $E_1 < 0$, minimizing $\langle H\rangle$ means maximizing $-2Z^2 + \frac{27}{4}Z$:

$$-4Z + \frac{27}{4} = 0 \quad\Longrightarrow\quad Z = \frac{27}{16} = 1.6875.$$

Plug back: $-2\left(\frac{27}{16}\right)^2 + \frac{27}{4}\cdot\frac{27}{16} = -\frac{729}{128} + \frac{729}{64} = \frac{729}{128}$, so

$$\langle H\rangle_{\min} = \frac{729}{128}E_1 = \frac{3^6}{2^7}(-13.6\text{ eV}) = -77.5\text{ eV}.$$

Experiment $-79.0$ eV. 1.9% high. And it's an upper bound, as it must be.

helium, effective-charge trial function: $Z_{\text{eff}} = {{c1::\frac{27}{16}}}$, giving $E \approx {{c2::-77.5}}$ eV against the experimental {{c3::$-79.0$}} eV ^qm3-he
<!-- sr c1 due=2026-11-04 st=review s=15.2 d=5 r=4 l=0 ivl=15 last=2026-10-20T08:12:00Z g=3 -->
<!-- sr c2 due=2026-10-30 st=review s=10 d=5.9 r=4 l=1 ivl=10 last=2026-10-20T08:12:00Z g=3 -->
<!-- sr c3 due=2026-11-12 st=review s=23.1 d=3.8 r=4 l=0 ivl=23 last=2026-10-20T08:12:00Z g=4 -->

$$\langle H\rangle(Z) = \left[{{c1::-2Z^2 + \frac{27}{4}Z}}\right]E_1$$ ^qm3-hz
<!-- sr due=2026-11-02 st=review s=13.4 d=6.1 r=4 l=1 ivl=13 last=2026-10-20T17:44:00Z g=3 -->

where does $\frac{27}{4}$ come from in the helium variational energy?
?
$8Z$ from the $(Z-2)/r$ correction ($-4Z(Z-2)E_1$ gives $-4Z^2 + 8Z$) minus $\frac54Z$ from $V_{ee}$: $8 - \frac54 = \frac{27}{4}$; together with $2Z^2$ from the hydrogenic parts, $2Z^2 - 4Z^2 = -2Z^2$ ^qm3-274
<!-- sr due=2026-11-03 st=review s=8.2 d=6.4 r=3 l=1 ivl=8 last=2026-10-26T20:51:00Z g=3 -->

Reading of $Z = 1.69$: each electron sees the nucleus screened by about $0.31$ of the other electron's charge. Not $0.5$ or $1$, because the other electron is not entirely inside.

Ionization energy check: He⁺ ground state is $4E_1 = -54.4$ eV, so the first ionization energy is $-54.4 - (-77.5) = 23.1$ eV variationally, vs $24.6$ eV experimentally. In relative terms the ionization energy is off by 6%, much worse than the 2% on the total energy, because it's a difference of two big numbers. [Lindgren: "total energies are easy, differences are physics."]

Better trial functions: Hylleraas (1929) included $r_{12} = |\mathbf r_1 - \mathbf r_2|$ explicitly; with a handful of parameters he got within 0.01 eV; modern calculations with thousands of terms agree with experiment to many digits once relativistic and QED corrections are added. The point: a trial function that knows about electron correlation (the electrons avoid each other) does much better than one that only knows about screening.

#TODO: excited states of helium (para/ortho, exchange integral) were Lindgren's "next week" but he skipped to H₂⁺ to get it in before the midterm. Read the book section.

## hydrogen molecule ion (sketch)

Lecture 18, Oct 12. I mostly copied; the integrals are in the book and Lindgren said "you don't need to be able to do these, you need to know what they mean".

Two protons fixed at separation $R$, one electron:

$$H = -\frac{\hbar^2}{2m}\nabla^2 - \frac{e^2}{4\pi\epsilon_0}\left(\frac{1}{r_1} + \frac{1}{r_2}\right), \qquad r_{1,2} = \text{distance to proton } 1, 2.$$

(Proton–proton repulsion added at the end.) Trial function: linear combination of atomic orbitals (LCAO),

$$\psi = A\left[\psi_0(r_1) + \psi_0(r_2)\right], \qquad \psi_0(r) = \frac{1}{\sqrt{\pi a^3}}e^{-r/a}.$$

Normalization involves the overlap $I = \langle\psi_0(r_1)|\psi_0(r_2)\rangle = e^{-R/a}\left(1 + \frac Ra + \frac13\left(\frac Ra\right)^2\right)$, giving $|A|^2 = \frac{1}{2(1 + I)}$.

Then

$$\langle H\rangle = \left[1 + 2\frac{D + X}{1 + I}\right]E_1$$

with the direct integral $D = a\left\langle\psi_0(r_1)\middle|\frac{1}{r_2}\middle|\psi_0(r_1)\right\rangle = \frac aR - \left(1 + \frac aR\right)e^{-2R/a}$ and the exchange integral $X = a\left\langle\psi_0(r_1)\middle|\frac1{r_1}\middle|\psi_0(r_2)\right\rangle = \left(1 + \frac Ra\right)e^{-R/a}$.

Add the proton repulsion $\frac{e^2}{4\pi\epsilon_0R} = -\frac{2a}{R}E_1$ and write the total in units of $-E_1$ with $x = R/a$. The function $F(x)$ has a minimum below $-1$ (i.e. below a hydrogen atom plus a distant proton) at $x \approx 2.4$, so the ion is bound.

Numbers: equilibrium $R \approx 2.4a = 1.3$ Å, binding energy $\approx 1.8$ eV. Experiment: $1.06$ Å, $2.8$ eV. Crude, but it proves binding: since the variational energy is an upper bound, and it is below $E_1$, the true ground state is below $E_1$ too, and a bound state exists. That logic is the whole point. Lindgren: "the variational principle can prove existence. PT can't."

the LCAO calculation proves H₂⁺ is bound because
?
the variational energy (including proton repulsion) dips below $E_1$, the energy of H + a distant proton; since it's an upper bound, the true ground state energy is also below $E_1$ ^qm3-h2bound

Bonding vs antibonding: the symmetric combination $\psi_0(r_1) + \psi_0(r_2)$ piles up charge between the protons and binds. The antisymmetric one has a node on the midplane, and its $\langle H\rangle$ has no minimum: $\left[1 + 2\frac{D - X}{1 - I}\right]E_1$ plus repulsion stays above $-1$ for all $x$. The exchange integral $X$ is the bonding; it's a purely quantum interference term.

in the H₂⁺ LCAO calculation the binding comes from {{c1::the exchange integral $X$}}, the interference term between orbitals on the two protons ^qm3-exch

the antisymmetric LCAO combination for H₂⁺ is {{c1::antibonding}}: it has {{c2::a node on the midplane}} and no energy minimum ^qm3-anti
