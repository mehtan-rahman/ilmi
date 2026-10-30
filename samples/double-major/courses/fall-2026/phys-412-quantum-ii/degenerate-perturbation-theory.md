---
title: degenerate perturbation theory
lectures: 2026-09-14, 09-16, 09-18, 09-21, 09-23, 09-25, 09-28
---

## why the nondegenerate formulas fail

Lectures 6–12. Typed up Sep 26 – Oct 1 (Zeeman part on Oct 1, after PS5 was half done, so it's terser).

Recall $\langle m^0|n^1\rangle = H'_{mn}/(E_n^0 - E_m^0)$. If $E_m^0 = E_n^0$ and $H'_{mn} \neq 0$ this is infinite, which means the "small correction" picture is wrong: an arbitrarily small perturbation can rotate the state by a finite amount within the degenerate subspace. Why? Because in a degenerate subspace $H^0$ doesn't pick a basis. Any orthonormal combination of $|a\rangle, |b\rangle$ is an equally good zeroth-order eigenstate. The perturbation, however small, does pick one: the basis in which it is diagonal. As $\lambda \to 0$ the exact eigenstates go to those particular combinations, not to whichever ones we wrote down.

Lindgren's phrase: "the perturbation decides what the zeroth-order states were."

## two-fold degeneracy

$H^0|a\rangle = E^0|a\rangle$, $H^0|b\rangle = E^0|b\rangle$, $\langle a|b\rangle = 0$. Look for

$$|\psi^0\rangle = \alpha|a\rangle + \beta|b\rangle.$$

First-order equation, as before: $H^0|\psi^1\rangle + H'|\psi^0\rangle = E^0|\psi^1\rangle + E^1|\psi^0\rangle$. Project onto $\langle a|$: the $H^0$ terms cancel and

$$\alpha W_{aa} + \beta W_{ab} = \alpha E^1, \qquad W_{ij} \equiv \langle i|H'|j\rangle.$$

Onto $\langle b|$:

$$\alpha W_{ba} + \beta W_{bb} = \beta E^1.$$

That's an eigenvalue problem for the $2\times2$ matrix $W$:

$$\begin{pmatrix} W_{aa} & W_{ab}\\ W_{ba} & W_{bb}\end{pmatrix}\begin{pmatrix}\alpha\\ \beta\end{pmatrix} = E^1\begin{pmatrix}\alpha\\ \beta\end{pmatrix}$$

$$E^1_\pm = \frac12\left[W_{aa} + W_{bb} \pm \sqrt{(W_{aa} - W_{bb})^2 + 4|W_{ab}|^2}\right].$$

The two roots are the first-order energies, and the eigenvectors are the "good" zeroth-order states. If $W_{ab} = 0$ already, the original basis was good and the nondegenerate formula $E^1 = W_{aa}$ is correct for each one.

degenerate PT, first order: the energy shifts are the {{c1::eigenvalues}} of the matrix $W_{ij} = \langle i|H'|j\rangle$ restricted to {{c2::the degenerate subspace}} ^qm2-W
<!-- sr c1 due=2026-12-11 st=review s=58.3 d=2.2 r=6 l=0 ivl=58 last=2026-10-14T07:50:00Z g=4 -->
<!-- sr c2 due=2026-11-19 st=review s=36.6 d=3.4 r=5 l=0 ivl=37 last=2026-10-13T07:50:00Z g=3 -->

General $k$-fold degeneracy: same thing with a $k\times k$ matrix. Diagonalize $H'$ in the degenerate subspace. Eigenvalues = first-order shifts, eigenvectors = good states. If some eigenvalues of $W$ are themselves degenerate the degeneracy is not (fully) lifted at first order and you have to go to second order within that sub-subspace, which we did not do.

what are the "good" zeroth-order states in degenerate PT, and why do we need them?
?
the eigenvectors of $W$ (i.e. of $H'$ restricted to the degenerate subspace); they are the $\lambda \to 0$ limits of the exact eigenstates. In that basis $W$ is diagonal, so the dangerous $H'_{mn}/(E_n^0 - E_m^0)$ terms with $E_m^0 = E_n^0$ have zero numerator and the nondegenerate formulas can be used ^qm2-good
<!-- sr due=2026-10-27 st=review s=14.6 d=5.8 r=5 l=1 ivl=15 last=2026-10-12T22:18:00Z g=3 -->

## the theorem that saves you from diagonalizing

Let $A$ be Hermitian with $[A, H^0] = 0$ and $[A, H'] = 0$. If $|a\rangle$, $|b\rangle$ are degenerate eigenstates of $H^0$ that are also eigenstates of $A$ with distinct eigenvalues $\mu \neq \nu$, then $W_{ab} = 0$.

Proof: $0 = \langle a|[A, H']|b\rangle = (\mu - \nu)\langle a|H'|b\rangle$, so $W_{ab} = 0$.

So: find an operator that commutes with both $H^0$ and $H'$ and whose eigenvalues distinguish the degenerate states. Its eigenstates are good. Lindgren: "In practice you never diagonalize anything. You find the right quantum numbers." These are the good quantum numbers.

if Hermitian $A$ commutes with $H^0$ and $H'$, and $|a\rangle,|b\rangle$ are degenerate eigenstates of $A$ with different eigenvalues, then $W_{ab} = 0$
?
$0 = \langle a|[A,H']|b\rangle = (\mu-\nu)\langle a|H'|b\rangle$ and $\mu \ne \nu$ ^qm2-thm
<!-- sr due=2026-11-03 st=review s=21.2 d=4.7 r=5 l=0 ivl=21 last=2026-10-13T12:01:00Z g=3 -->

Small example from lecture 7 (2D infinite square well, $0 \le x, y \le a$, with $H' = V_0$ in the quadrant $0 < x, y < a/2$): first excited states $(1,2)$ and $(2,1)$ are degenerate. $W_{aa} = W_{bb} = V_0/4$, and $W_{ab} = \frac{4V_0}{a^2}\left(\int_0^{a/2}\sin\frac{\pi x}{a}\sin\frac{2\pi x}{a}\,dx\right)^2 = \frac{16V_0}{9\pi^2}$. So $E^1_\pm = V_0\left(\frac14 \pm \frac{16}{9\pi^2}\right)$. Could we have guessed the good states? Yes: the $x \leftrightarrow y$ swap commutes with $H'$ (the quadrant is symmetric under $x\leftrightarrow y$), and its eigenstates $(|12\rangle \pm |21\rangle)/\sqrt2$ are the good states. #TODO: verify the integral, I get $\frac{2a}{3\pi}$ for the integral, squared $\frac{4a^2}{9\pi^2}$, times $\frac{4V_0}{a^2}$ gives $\frac{16V_0}{9\pi^2}$. ok.

## nearly degenerate levels

Lecture 8 opened with this, and it's the part of the unit I find most useful outside of hydrogen. Suppose $E_a^0$ and $E_b^0$ are not equal but close: $|E_a^0 - E_b^0| \lesssim |W_{ab}|$. Nondegenerate PT is formally allowed but the mixing coefficient $W_{ab}/(E_a^0 - E_b^0)$ is of order one, so the series is useless. The fix is the same as for exact degeneracy: treat $\{|a\rangle, |b\rangle\}$ as the subspace and diagonalize $H^0 + H'$ exactly in it,

$$\begin{pmatrix} E_a^0 + W_{aa} & W_{ab}\\ W_{ba} & E_b^0 + W_{bb}\end{pmatrix},$$

then include the other (far) states perturbatively. This is "quasi-degenerate PT". It interpolates correctly: when $|E_a^0 - E_b^0| \gg |W_{ab}|$ the eigenvalues expand to the nondegenerate second-order result, and when the gap goes to zero they become the degenerate first-order result. Avoided crossings: as a parameter sweeps $E_a^0 - E_b^0$ through zero, the exact levels never cross, they come within $2|W_{ab}|$ and swap character.

Lindgren's example was the $2s_{1/2}$/$2p_{1/2}$ pair in a weak electric field, which are split by the Lamb shift (see below). For $eEa_0$ smaller than the Lamb shift the Stark effect is quadratic, for $eEa_0$ larger it's linear, and the $2\times2$ diagonalization gives the whole crossover in one formula. (He used the $3a_0$ matrix element from the $n=2$ calculation below, with $j$-state Clebsch–Gordan factors I did not copy down. [ask in OH: is it $\sqrt3\, eEa_0$ between $2s_{1/2}$ and $2p_{1/2}$?])

when two levels are close but not degenerate ($|E_a^0 - E_b^0| \lesssim |W_{ab}|$), what do you do?
?
diagonalize $H^0 + H'$ exactly in the two-state subspace (quasi-degenerate PT), then treat the far states perturbatively; the exact $2\times2$ answer reduces to second-order nondegenerate PT for a large gap and to degenerate first-order PT for zero gap ^qm2-quasi
<!-- sr due=2026-11-05 st=review s=23.8 d=5.1 r=4 l=0 ivl=24 last=2026-10-12T10:27:00Z g=3 -->

## linear Stark effect, $n = 2$

The real example. Hydrogen $n=2$ has four states (ignoring spin): $|200\rangle$, $|210\rangle$, $|211\rangle$, $|21,-1\rangle$, all at $E_2 = -3.4$ eV. Perturbation $H' = eEz$.

Find the good quantum numbers first. $[L_z, z] = 0$, so $m$ is conserved by $H'$: $W$ only connects states of equal $m$. Parity: $z$ is odd, so it only connects states of opposite parity, i.e. $l = 0 \leftrightarrow l = 1$. (Diagonal elements all vanish by parity.) The only nonzero element is between $|200\rangle$ and $|210\rangle$, both $m = 0$.

$$W_{200,210} = eE\langle 200|r\cos\theta|210\rangle.$$

Using $\psi_{200} = \frac{1}{\sqrt{2\pi a^3}}\frac{1}{2}\left(1 - \frac{r}{2a}\right)e^{-r/2a}$ and $\psi_{210} = \frac{1}{\sqrt{32\pi a^3}}\frac{r}{a}e^{-r/2a}\cos\theta$, with $a = a_0$:

$$\langle 200|z|210\rangle = \frac{1}{16\pi a^4}\int_0^\infty\!\left(1 - \frac{r}{2a}\right)r^4 e^{-r/a}\,dr\int_0^\pi\cos^2\theta\sin\theta\,d\theta\int_0^{2\pi}\!d\phi.$$

The angular part is $\frac23\cdot 2\pi = \frac{4\pi}{3}$. The radial part is $4!\,a^5 - \frac{1}{2a}5!\,a^6 = 24a^5 - 60a^5 = -36a^5$. So

$$\langle 200|z|210\rangle = \frac{1}{16\pi a^4}\cdot\frac{4\pi}{3}\cdot(-36a^5) = -3a.$$

$$W = -3eEa\begin{pmatrix}0 & 1\\ 1 & 0\end{pmatrix}\quad\text{in the } \{|200\rangle, |210\rangle\}\text{ block, zero elsewhere.}$$

Eigenvalues $\pm 3eEa$; eigenvectors $|\pm\rangle = \frac{1}{\sqrt2}(|200\rangle \pm |210\rangle)$, with $|+\rangle$ at $E_2 - 3eEa$ and $|-\rangle$ at $E_2 + 3eEa$. The $m = \pm1$ states don't shift at first order.

So the fourfold level splits into three: $E_2 - 3eEa_0$, $E_2$ (twice), $E_2 + 3eEa_0$. Linear in $E$, unlike the ground state's quadratic shift. The good states have permanent dipole moments $\mp 3ea_0\hat z$ (they are the parabolic-coordinate states; the electron cloud is pushed to one side).

$\langle 200|z|210\rangle = {{c1::-3a_0}}$ ^qm2-zme
<!-- sr due=2026-10-30 st=review s=16.8 d=5.6 r=6 l=1 ivl=17 last=2026-10-13T18:37:00Z g=3 -->

the linear Stark effect splits hydrogen's $n = 2$ level into {{c1::three}} levels, at $E_2$ and $E_2 \pm {{c2::3eEa_0}}$ ^qm2-stark
<!-- sr c1 due=2026-11-20 st=review s=40.3 d=3 r=5 l=0 ivl=40 last=2026-10-11T08:44:00Z g=4 -->
<!-- sr c2 due=2026-10-28 st=review s=12.5 d=6.2 r=6 l=1 ivl=12 last=2026-10-16T08:44:00Z g=3 -->

why does $n=2$ hydrogen show a linear Stark effect when the ground state doesn't?
?
$2s$ and $2p_0$ are degenerate and have opposite parity, so $z$ connects them; the good states $(|200\rangle\pm|210\rangle)/\sqrt2$ are not parity eigenstates and have permanent dipole moments $\mp 3ea_0$. The ground state is nondegenerate, a parity eigenstate, no permanent dipole ^qm2-whylinear
<!-- sr due=2026-11-14 st=review s=31.5 d=4.2 r=4 l=0 ivl=31 last=2026-10-14T19:20:00Z g=3 -->

Note: with fine structure the $2s_{1/2}$–$2p_{1/2}$ degeneracy survives (Dirac) but $2p_{3/2}$ is split off by about $4.5\times10^{-5}$ eV, and the Lamb shift separates $2s_{1/2}$ and $2p_{1/2}$ by about $4.4\times10^{-6}$ eV ($\approx 1058$ MHz). So the Stark effect is "linear" only when $3eEa_0 \gg$ Lamb shift; for weaker fields it's quadratic again. Lindgren: "degeneracy is a statement about the scale you're looking at."

## fine structure of hydrogen

Order of magnitude first. The Bohr energies are $E_n = -\frac{\alpha^2 mc^2}{2n^2}$, $\alpha \approx 1/137$. Fine structure is down by another $\alpha^2$: $\sim\alpha^4 mc^2 \sim 10^{-3}$ eV. Lamb shift $\sim\alpha^5 mc^2$, hyperfine $\sim (m/m_p)\alpha^4mc^2$. The fine structure is two effects of the same order (plus the Darwin term):

$$H'_{fs} = H'_r + H'_{so} \;(+ H'_D).$$

### relativistic kinetic energy correction

$T = \sqrt{p^2c^2 + m^2c^4} - mc^2 = \frac{p^2}{2m} - \frac{p^4}{8m^3c^2} + \cdots$, so the lowest correction is

$$H'_r = -\frac{p^4}{8m^3c^2}.$$

Is degenerate PT needed? $H'_r$ is spherically symmetric and spin-independent, so it commutes with $\mathbf L^2$, $L_z$, $\mathbf S^2$, $S_z$. Within a fixed $n$ the states are distinguished by $l, m_l, m_s$, so the $|nlm_lm_s\rangle$ basis is already good. Nondegenerate formula is fine.

The trick: $p^2 = 2m(E - V)$ in the unperturbed state, and $p^2$ is Hermitian, so

$$E_r^1 = -\frac{1}{8m^3c^2}\langle p^2\psi|p^2\psi\rangle = -\frac{1}{2mc^2}\left[E_n^2 - 2E_n\langle V\rangle + \langle V^2\rangle\right].$$

With $V = -\frac{e^2}{4\pi\epsilon_0}\frac1r$ we need

$$\left\langle\frac1r\right\rangle = \frac{1}{n^2a}, \qquad \left\langle\frac{1}{r^2}\right\rangle = \frac{1}{(l+\frac12)n^3a^2}.$$

(First from virial theorem or Hellmann–Feynman in $e^2$; second from Hellmann–Feynman in $l$, treating $l$ as continuous in the radial equation — Lindgren did this on the board, it is slick.) Result:

$$E_r^1 = -\frac{(E_n)^2}{2mc^2}\left[\frac{4n}{l + \frac12} - 3\right].$$

the relativistic correction to hydrogen ::: $E_r^1 = -\dfrac{(E_n)^2}{2mc^2}\left[\dfrac{4n}{l+1/2} - 3\right]$ ^qm2-rel
<!-- sr due=2026-11-01 st=review s=19.6 d=5.9 r=5 l=1 ivl=20 last=2026-10-12T16:09:00Z g=3 -->

Note $p^4$ is technically suspect for $l = 0$ states: $p^4\psi$ for an $s$ state has a delta function at the origin, since $\nabla^2(1/r) = -4\pi\delta^3(\mathbf r)$. Lindgren said the answer is right anyway "for reasons that will become clear in Dirac theory", i.e. the Darwin term and this mess conspire. [ask in OH: is $p^4$ really non-Hermitian on $s$ states or is it just that the naive calculation fails?]

### spin-orbit coupling

In the electron's rest frame the proton circles it, producing a magnetic field $\mathbf B = \frac{1}{4\pi\epsilon_0}\frac{e}{mc^2r^3}\mathbf L$. The electron's magnetic moment $\boldsymbol\mu = -\frac{e}{m}\mathbf S$ (with $g = 2$) has energy $-\boldsymbol\mu\cdot\mathbf B$. Then Thomas precession (the rest frame is accelerating) gives a factor $\frac12$:

$$H'_{so} = \frac{e^2}{8\pi\epsilon_0}\frac{1}{m^2c^2r^3}\,\mathbf S\cdot\mathbf L.$$

the Thomas precession factor in the spin-orbit Hamiltonian is {{c1::$\frac12$}}, and it comes from {{c2::the electron's rest frame being accelerated (not inertial)}} ^qm2-thomas
<!-- sr c1 due=2026-10-26 st=review s=10.4 d=6.5 r=6 l=2 ivl=10 last=2026-10-16T21:41:00Z g=2 -->
<!-- sr c2 due=2026-11-25 st=review s=42.2 d=3.1 r=5 l=0 ivl=42 last=2026-10-14T21:41:00Z g=4 -->

Good quantum numbers now. $H'_{so}$ does not commute with $\mathbf L$ or $\mathbf S$ separately (the torque on $\mathbf S$ from $\mathbf B\propto\mathbf L$ makes them precess), but it does commute with $\mathbf L^2$, $\mathbf S^2$, $\mathbf J^2$, $J_z$, where $\mathbf J = \mathbf L + \mathbf S$. So $m_l, m_s$ are bad, and $|n\,l\,j\,m_j\rangle$ is the good basis. In it,

$$\mathbf S\cdot\mathbf L = \frac12\left(\mathbf J^2 - \mathbf L^2 - \mathbf S^2\right) \to \frac{\hbar^2}{2}\left[j(j+1) - l(l+1) - \frac34\right].$$

With $\left\langle\frac{1}{r^3}\right\rangle = \frac{1}{l(l+\frac12)(l+1)n^3a^3}$:

$$E_{so}^1 = \frac{(E_n)^2}{mc^2}\,\frac{n\left[j(j+1) - l(l+1) - \frac34\right]}{l(l+\frac12)(l+1)}.$$

the good quantum numbers for hydrogen with spin-orbit coupling
?
$n, l, j, m_j$ (and $s = \tfrac12$): $H'_{so} \propto \mathbf S\cdot\mathbf L/r^3$ commutes with $\mathbf L^2,\mathbf S^2,\mathbf J^2,J_z$ but not with $L_z$ or $S_z$, so $m_l, m_s$ are not good ^qm2-goodqn
<!-- sr due=2026-12-02 st=review s=48.9 d=2.8 r=5 l=0 ivl=49 last=2026-10-14T10:55:00Z g=4 -->

$\mathbf S\cdot\mathbf L = {{c1::\tfrac12\left(\mathbf J^2 - \mathbf L^2 - \mathbf S^2\right)}}$ ^qm2-sl
<!-- sr due=2026-12-19 st=review s=61.3 d=1.8 r=6 l=0 ivl=61 last=2026-10-19T08:02:00Z g=4 -->

### putting them together

For $j = l\pm\frac12$, the combination $\frac{j(j+1) - l(l+1) - 3/4}{l(l+1/2)(l+1)}$ simplifies so that

$$E_r^1 + E_{so}^1 = \frac{(E_n)^2}{2mc^2}\left[3 - \frac{4n}{j + \frac12}\right].$$

All $l$-dependence has dropped out. I checked $j = l + \frac12$ on paper: numerator $j(j+1) - l(l+1) - \frac34 = l$, so $E_{so}^1 = \frac{(E_n)^2}{mc^2}\frac{n}{(l+\frac12)(l+1)}$, and $-\frac{4n}{l+1/2} + \frac{2n}{(l+1/2)(l+1)} = -\frac{4n(l+1) - 2n}{(l+\frac12)(l+1)} = -\frac{4n(l+\frac12)}{(l+\frac12)(l+1)} = -\frac{4n}{l+1} = -\frac{4n}{j+\frac12}$. ✓. For $j = l - \frac12$ the numerator is $-(l+1)$; did not check, PS5 #3 asks for it.

So the full fine-structure formula, with $E_n = -13.6\text{ eV}/n^2$:

$$E_{nj} = -\frac{13.6\text{ eV}}{n^2}\left[1 + \frac{\alpha^2}{n^2}\left(\frac{n}{j + \frac12} - \frac34\right)\right].$$

$$E_{nj} = -\frac{13.6\text{ eV}}{n^2}\left[1 + \frac{\alpha^2}{n^2}\left({{c1::\frac{n}{j+\frac12}}} - {{c2::\frac34}}\right)\right]$$ ^qm2-Enj
<!-- sr c1 due=2026-10-29 st=review s=15.1 d=6 r=6 l=1 ivl=15 last=2026-10-14T13:12:00Z g=3 -->
<!-- sr c2 due=2026-11-24 st=review s=40.8 d=3.3 r=5 l=0 ivl=41 last=2026-10-14T13:12:00Z g=3 -->

Consequences:

- Depends on $n$ and $j$ only. $2s_{1/2}$ and $2p_{1/2}$ stay degenerate. (Exactly true in Dirac theory to all orders in $\alpha$; broken by the Lamb shift, QED.)
- Always lowers the energy (the bracket's correction term is positive since $\frac{n}{j+1/2} \geq 1 > \frac34$).
- $n = 2$: $j = \frac12$ correction is $-\frac{13.6\alpha^2}{16}\cdot\frac54$, $j = \frac32$ is $-\frac{13.6\alpha^2}{16}\cdot\frac14$. Splitting $\frac{13.6\alpha^2}{16}$ eV $= 4.53\times10^{-5}$ eV, i.e. about 10.9 GHz. Matches the measured $2p_{3/2}$–$2p_{1/2}$ interval.
- The exact Dirac result expanded to order $\alpha^4$ reproduces this. Lindgren: "Three wrong-looking classical arguments and an $s$-state disaster, and the answer is right. That's how you know Dirac was going to happen."

the hydrogen $2p_{3/2}$–$2p_{1/2}$ fine-structure splitting is about {{c1::$4.5\times10^{-5}$ eV, or 10.9 GHz}} ^qm2-split
<!-- sr due=2026-11-08 st=review s=24.7 d=4.9 r=4 l=0 ivl=25 last=2026-10-14T17:30:00Z g=3 -->

### Darwin term (mentioned, not derived)

$$H'_D = \frac{\pi\hbar^2}{2m^2c^2}\frac{e^2}{4\pi\epsilon_0}\,\delta^3(\mathbf r).$$

From the Dirac equation (zitterbewegung smears the electron over a Compton wavelength, so it samples $\nabla^2 V$). Only $s$ states have $\psi(0) \neq 0$, so it only acts at $l = 0$, where spin-orbit vanishes ($\mathbf L = 0$). And $\langle H'_D\rangle$ for $l = 0$ equals exactly what the $E^1_{so}$ formula would give if you plugged in $l = 0$, $j = \frac12$ naively (the $l$ in the denominator cancels against the numerator in the limit). So the combined formula $E_{nj}$ holds for $s$ states too, with the Darwin term playing the role of spin-orbit. Griffiths-style books fudge this; Lindgren was explicit that the formula's validity at $l=0$ is "Darwin's, not spin-orbit's".

for $l = 0$ states, the role spin-orbit plays in the fine-structure formula is taken by {{c1::the Darwin term}}, which acts only where $\psi(0)\neq0$ ^qm2-darwin
<!-- sr due=2026-11-04 st=review s=22.4 d=5.2 r=4 l=0 ivl=22 last=2026-10-13T20:14:00Z g=3 -->

## Zeeman effect, weak field

External field $\mathbf B_{\text{ext}}$. The electron's magnetic moment is $\boldsymbol\mu = -\frac{e}{2m}(\mathbf L + 2\mathbf S)$ (orbital $g = 1$, spin $g = 2$), so

$$H'_Z = \frac{e}{2m}(\mathbf L + 2\mathbf S)\cdot\mathbf B_{\text{ext}}.$$

Regimes, by comparing with the internal field responsible for spin-orbit (a few tesla for $n=2$... Lindgren said "order 1 T"):

- weak field: $B_{\text{ext}} \ll B_{\text{int}}$, fine structure dominates, $H'_Z$ is the perturbation on $|nljm_j\rangle$
- strong field (Paschen–Back): $H'_Z$ dominates, use $|nlm_lm_s\rangle$, fine structure is the perturbation
- intermediate: diagonalize both together (PS6 bonus, skipped)

Weak field. The good states are $|nljm_j\rangle$. We need $\langle \mathbf L + 2\mathbf S\rangle = \langle\mathbf J + \mathbf S\rangle$ in such a state. $\mathbf J$ is fine; $\mathbf S$ is not conserved, it precesses rapidly around $\mathbf J$, so its time-average is its projection on $\mathbf J$:

$$\mathbf S_{\text{avg}} = \frac{(\mathbf S\cdot\mathbf J)}{J^2}\mathbf J, \qquad \mathbf S\cdot\mathbf J = \frac12\left(J^2 + S^2 - L^2\right).$$

(The rigorous version of "time-average" is the projection theorem / Wigner–Eckart: within a fixed-$j$ multiplet, $\langle \mathbf V\rangle = \frac{\langle\mathbf V\cdot\mathbf J\rangle}{j(j+1)\hbar^2}\langle\mathbf J\rangle$ for any vector operator.) So

$$\langle\mathbf L + 2\mathbf S\rangle = \left[1 + \frac{j(j+1) - l(l+1) + \frac34}{2j(j+1)}\right]\langle\mathbf J\rangle \equiv g_J\langle\mathbf J\rangle$$

and with $\mathbf B_{\text{ext}} = B\hat z$,

$$E_Z^1 = \mu_B g_J B m_j, \qquad \mu_B = \frac{e\hbar}{2m} = 5.788\times10^{-5}\text{ eV/T}.$$

the Landé $g$-factor ::: $g_J = 1 + \dfrac{j(j+1) - l(l+1) + \tfrac34}{2j(j+1)}$ ^qm2-lande
<!-- sr due=2026-10-25 st=review s=8.9 d=7.1 r=5 l=2 ivl=9 last=2026-10-16T19:03:00Z g=2 -->

Values worth knowing (I computed these for PS5 and Lindgren put the same on the board):

| state | $l$ | $j$ | $g_J$ | splitting into |
| --- | --- | --- | --- | --- |
| $1s_{1/2}$, $2s_{1/2}$ | 0 | 1/2 | 2 | 2 levels, $\pm\mu_B B$ |
| $2p_{1/2}$ | 1 | 1/2 | 2/3 | 2 levels, $\pm\frac13\mu_B B$ |
| $2p_{3/2}$ | 1 | 3/2 | 4/3 | 4 levels, $\pm\frac23\mu_B B$, $\pm2\mu_B B$ |

(Cards can't go in the table, so the $g$ values I want to drill are below as separate cards.)

$g_J$ for $2p_{1/2}$ is {{c1::$\frac23$}} and for $2p_{3/2}$ is {{c2::$\frac43$}} ^qm2-gvals
<!-- sr c1 due=2026-11-02 st=review s=17.3 d=5.4 r=4 l=0 ivl=17 last=2026-10-16T12:46:00Z g=3 -->
<!-- sr c2 due=2026-11-02 st=review s=17.3 d=5.4 r=4 l=0 ivl=17 last=2026-10-16T12:46:00Z g=3 -->

why can you replace $\mathbf S$ by its projection on $\mathbf J$ in the weak-field Zeeman effect?
?
in the weak field the fine structure dominates, so the good states are $|nljm_j\rangle$; $\mathbf L$ and $\mathbf S$ precess rapidly about the conserved $\mathbf J$, and only the component along $\mathbf J$ survives the average (formally: projection theorem within a fixed-$j$ multiplet) ^qm2-proj
<!-- sr due=2026-11-07 st=review s=22 d=5.5 r=4 l=0 ivl=22 last=2026-10-16T15:33:00Z g=3 -->

Ground state of hydrogen in 1 T: splitting $2\mu_B B \approx 1.16\times10^{-4}$ eV, so the weak-field criterion holds against the $n = 1$ fine-structure shift? Not quite the right comparison: $1s$ has only $j = \frac12$, no other $j$ to mix with, so the weak/strong distinction is about $n=2$. For $n=2$, $\mu_B B$ at 1 T is $5.8\times10^{-5}$ eV, comparable to the $4.5\times10^{-5}$ eV fine-structure splitting. So 1 T is already "intermediate" for $n=2$. #TODO: so why did Lindgren say "weak field means $B \ll 1$ T"? Consistent, I think: weak means $\ll$, and 1 T is the crossover. ok.

Strong field (Paschen–Back), for completeness: $E^1 = \mu_B B(m_l + 2m_s)$, and the fine structure then added as $\langle nlm_lm_s|H'_{fs}|nlm_lm_s\rangle$, which works because $H'_{fs}$ has to be evaluated in the strong-field basis and its off-diagonal pieces don't matter there at first order (the states with different $m_l + 2m_s$ are no longer degenerate). Results in PS6, not here.

## summary, Lindgren's board at the end of lecture 12

1. Degeneracy: diagonalize $H'$ in the subspace, or better, find good quantum numbers.
2. $H'_r$: good in any basis. $H'_{so}$: needs $j$. $H'_Z$ weak: $j, m_j$; strong: $m_l, m_s$.
3. Fine structure depends on $n, j$ only. Darwin rescues $s$ states.
4. "When two perturbations compete, the bigger one picks the basis."
