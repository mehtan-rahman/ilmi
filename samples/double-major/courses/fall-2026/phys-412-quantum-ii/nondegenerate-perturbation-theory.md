---
title: nondegenerate perturbation theory
lectures: 2026-08-31, 09-02, 09-04, 09-09, 09-11
read: due=2026-11-04 ivl=14 reps=2 pos=0
---

## setup

Lectures 1–5 (Aug 31 – Sep 11; Sep 7 Labor Day). Typed from the green notebook, pp. 1–19. Lindgren follows the standard order but does the bookkeeping with a parameter $\lambda$ throughout and only sets $\lambda = 1$ at the very end, which I like better than the textbook because it makes the order-counting mechanical.

The problem: we know the spectrum of some $H^0$ exactly,

$$H^0 |n^0\rangle = E_n^0 |n^0\rangle, \qquad \langle m^0 | n^0 \rangle = \delta_{mn},$$

and we want the spectrum of $H = H^0 + \lambda H'$ where $H'$ is "small" (what small means is the whole question, see the convergence section at the end). In this unit every $E_n^0$ we perturb is assumed nondegenerate. The degenerate case is the next unit and is not a footnote, it is most of atomic physics.

Expand both the eigenvalue and the eigenvector in powers of $\lambda$:

$$|n\rangle = |n^0\rangle + \lambda |n^1\rangle + \lambda^2 |n^2\rangle + \cdots, \qquad E_n = E_n^0 + \lambda E_n^1 + \lambda^2 E_n^2 + \cdots$$

Plug into $H|n\rangle = E_n|n\rangle$ and collect powers of $\lambda$. Lindgren insists on writing these out explicitly once in your life, so here they are.

$$\lambda^0: \quad H^0|n^0\rangle = E_n^0|n^0\rangle$$

$$\lambda^1: \quad H^0|n^1\rangle + H'|n^0\rangle = E_n^0|n^1\rangle + E_n^1|n^0\rangle$$

$$\lambda^2: \quad H^0|n^2\rangle + H'|n^1\rangle = E_n^0|n^2\rangle + E_n^1|n^1\rangle + E_n^2|n^0\rangle$$

The zeroth order equation is the one we already solved. Everything else follows from projecting the higher ones onto $\langle n^0|$ and onto $\langle m^0|$ with $m \neq n$.

## normalization convention

There is a freedom here that the textbook hides. The full $|n\rangle$ is only defined up to normalization and phase, so we can choose to add any multiple of $|n^0\rangle$ to $|n^1\rangle$ without changing anything physical to first order. The standard choice ("intermediate normalization") is

$$\langle n^0 | n \rangle = 1 \quad\Longrightarrow\quad \langle n^0 | n^k \rangle = 0 \text{ for } k \geq 1.$$

So $|n\rangle$ is not normalized; at the end you renormalize, and the correction to the norm starts at order $\lambda^2$: $\langle n|n\rangle = 1 + \lambda^2 \langle n^1|n^1\rangle + O(\lambda^3)$. Prof. said that if anyone writes a first-order state with a $|n^0\rangle$ component on the midterm they had better say why.

in intermediate normalization the corrections to $|n\rangle$ are chosen {{c1::orthogonal to $|n^0\rangle$}}, i.e. $\langle n^0|n^k\rangle = 0$ for $k \ge 1$ ^qm1-intnorm
<!-- sr due=2026-10-29 st=review s=19.2 d=5.3 r=5 l=0 ivl=19 last=2026-10-10T14:22:00Z g=3 -->

## first-order energy

Take the $\lambda^1$ equation and act with $\langle n^0|$ on the left. Because $H^0$ is Hermitian, $\langle n^0|H^0 = E_n^0 \langle n^0|$, so the $H^0|n^1\rangle$ term cancels the $E_n^0|n^1\rangle$ term:

$$E_n^0\langle n^0|n^1\rangle + \langle n^0|H'|n^0\rangle = E_n^0\langle n^0|n^1\rangle + E_n^1\langle n^0|n^0\rangle$$

and with $\langle n^0|n^0\rangle = 1$:

$$E_n^{1} = {{c1::\langle n^0 | H' | n^0 \rangle}}$$ ^qm1-e1
<!-- sr due=2026-12-08 st=review s=52.1 d=2.4 r=6 l=0 ivl=52 last=2026-10-17T09:41:00Z g=4 -->

The first-order shift is the expectation value of the perturbation in the unperturbed state. Note we did not need $\langle n^0|n^1\rangle = 0$ for this; it cancels regardless. That is the observation that makes first-order PT "obvious" in hindsight: to first order, the state doesn't have time to change, you just average $H'$ over the old one.

## first-order state

Now act with $\langle m^0|$, $m \neq n$, on the $\lambda^1$ equation:

$$E_m^0\langle m^0|n^1\rangle + \langle m^0|H'|n^0\rangle = E_n^0\langle m^0|n^1\rangle + E_n^1 \underbrace{\langle m^0|n^0\rangle}_{0}$$

so

$$\langle m^0|n^1\rangle = \frac{\langle m^0|H'|n^0\rangle}{E_n^0 - E_m^0}.$$

This is where nondegeneracy is used: if some $E_m^0 = E_n^0$ with $m \neq n$ and $\langle m^0|H'|n^0\rangle \neq 0$, this blows up. (If the matrix element happens to vanish you get $0/0$ and the equation tells you nothing, which is the degenerate case's way of telling you to pick better basis states.) With intermediate normalization the $m = n$ component is zero, so

$$|n^1\rangle = \sum_{m \neq n} \frac{\langle m^0|H'|n^0\rangle}{E_n^0 - E_m^0}\, |m^0\rangle.$$

Write $H'_{mn} \equiv \langle m^0|H'|n^0\rangle$ from here on.

write down the first-order correction to the state $|n\rangle$ in nondegenerate PT (intermediate normalization)
?
$$|n^1\rangle = \sum_{m\neq n}\frac{H'_{mn}}{E_n^0 - E_m^0}\,|m^0\rangle$$
denominator is (state you're correcting) minus (state you're mixing in); the $m=n$ term is excluded ^qm1-state1
<!-- sr due=2026-10-27 st=review s=11.4 d=6.6 r=7 l=1 ivl=11 last=2026-10-16T21:05:00Z g=3 -->

Physical reading: the perturbation mixes in other unperturbed states, each weighted by how strongly $H'$ connects it to $n$ divided by how far away it is in energy. Nearby levels mix most. This is the whole intuition of level repulsion and you see it immediately in second order.

## second-order energy

Project the $\lambda^2$ equation onto $\langle n^0|$. Again the $H^0$ terms cancel against $E_n^0$ terms, and $\langle n^0|n^1\rangle = 0$ kills the $E_n^1$ term:

$$\langle n^0|H'|n^1\rangle = E_n^2.$$

Insert the first-order state:

$$E_n^2 = \sum_{m\neq n} \frac{\langle n^0|H'|m^0\rangle\langle m^0|H'|n^0\rangle}{E_n^0 - E_m^0} = \sum_{m\neq n}\frac{|H'_{mn}|^2}{E_n^0 - E_m^0}.$$

the second-order energy correction in nondegenerate PT ::: $E_n^2 = \sum_{m\neq n}\dfrac{|\langle m^0|H'|n^0\rangle|^2}{E_n^0 - E_m^0}$ ^qm1-e2
<!-- sr due=2026-11-21 st=review s=33.5 d=4.1 r=6 l=0 ivl=33 last=2026-10-19T07:58:00Z g=3 -->

Two immediate consequences Lindgren made a point of:

The ground state's second-order shift is always negative (or zero). For $n = 0$ every denominator $E_0^0 - E_m^0 < 0$ and every numerator is $\ge 0$. So second-order PT always pushes the ground state down. Variationally this makes sense too: the true ground state energy is the minimum of $\langle H \rangle$ over all states, and $E_0^0 + E_0^1 = \langle 0^0|H|0^0\rangle$ is one particular trial value, so the true energy can only be lower. (Forward pointer to the variational unit.)

the second-order shift of the ground state is always {{c1::negative or zero}}, because every denominator $E_0^0 - E_m^0$ is {{c2::negative}} ^qm1-gsneg
<!-- sr c1 due=2026-10-30 st=review s=21.7 d=3.9 r=6 l=0 ivl=22 last=2026-10-08T10:14:00Z g=3 -->
<!-- sr c2 due=2026-11-13 st=review s=36 d=3.5 r=5 l=0 ivl=36 last=2026-10-08T10:14:00Z g=3 -->

Level repulsion. Consider two levels $n$, $m$ coupled by $H'_{mn}$. The term $|H'_{mn}|^2/(E_n^0 - E_m^0)$ shows up in $E_n^2$, and the same term with the opposite sign in $E_m^2$. So if $n$ is above $m$ it goes up, $m$ goes down: second-order PT pushes coupled levels apart. In the two-level problem this is exact to all orders (diagonalize the $2\times 2$ matrix), and the exact answer expanded in $|H'_{mn}|/|E_n^0 - E_m^0|$ reproduces second order term by term. I did this in the margin; it's worth having:

$$E_\pm = \frac{E_1 + E_2}{2} \pm \sqrt{\left(\frac{E_1 - E_2}{2}\right)^2 + |V|^2} \approx E_{1,2} \pm \frac{|V|^2}{E_1 - E_2} \quad (E_1 > E_2)$$

where I have put the first-order diagonal pieces into $E_1, E_2$.

Further remarks from lecture 3:

- Second-order energy needs only the first-order state. In general the $(2k+1)$ rule: knowing the state to order $k$ gives the energy to order $2k+1$. So $|n^1\rangle$ actually determines $E_n^3$ as well. Lindgren just stated this; did not prove. [ask in OH: is this Wigner's $2n+1$ theorem? book calls it something else]
- The sum over $m$ runs over the whole spectrum of $H^0$, including continuum if $H^0$ has one. For hydrogen that matters (Stark example below) and is why closed forms are rare.
- If you only want an estimate, replace every denominator by the smallest gap $\Delta$ and use closure. See Stark below.

We did not do second-order states in lecture. The textbook has them; they are ugly and not on the exam ("I will not ask you for $|n^2\rangle$, I'm not a monster").

## worked example 1: the quartic anharmonic oscillator

$$H = \frac{p^2}{2m} + \frac12 m\omega^2 x^2 + \lambda x^4.$$

Lindgren did this first because it is the example where the series is famous for not converging. Work in ladder operators:

$$x = \sqrt{\frac{\hbar}{2m\omega}}\,(a + a^\dagger), \qquad a|n\rangle = \sqrt n\,|n-1\rangle, \quad a^\dagger|n\rangle = \sqrt{n+1}\,|n+1\rangle.$$

First order needs $\langle n|x^4|n\rangle$. The fast way is to note $\langle n|x^4|n\rangle = \| x^2|n\rangle \|^2$, since $x^2$ is Hermitian. And

$$(a + a^\dagger)^2|n\rangle = \sqrt{n(n-1)}\,|n-2\rangle + (2n+1)|n\rangle + \sqrt{(n+1)(n+2)}\,|n+2\rangle$$

(the middle term is $aa^\dagger + a^\dagger a = 2a^\dagger a + 1$ acting on $|n\rangle$). The norm squared is

$$n(n-1) + (2n+1)^2 + (n+1)(n+2) = n^2 - n + 4n^2 + 4n + 1 + n^2 + 3n + 2 = 6n^2 + 6n + 3.$$

So

$$\langle n|x^4|n\rangle = \left(\frac{\hbar}{2m\omega}\right)^2 (6n^2 + 6n + 3)$$

and

$$E_n^1 = 3\lambda\left(\frac{\hbar}{2m\omega}\right)^2(2n^2 + 2n + 1).$$

For the ground state, $E_0^1 = \dfrac{3\lambda\hbar^2}{4m^2\omega^2}$.

Check with dimensions: $\lambda x^4$ is an energy, so $\lambda$ has units energy/length⁴; $\hbar/(m\omega)$ is a length², squared gives length⁴. Good.

Check with a sanity argument: the shift grows like $n^2$ while the unperturbed spacing is constant $\hbar\omega$. So for any fixed $\lambda > 0$ there is an $n$ beyond which $E_n^1 > \hbar\omega$ and first-order PT is meaningless. "Small" is a statement about the state, not just about $\lambda$. The relevant dimensionless parameter is

$$g = \frac{\lambda\hbar}{m^2\omega^3}$$

and PT in $g$ is fine for $g\, n^2 \ll 1$, not for $g \ll 1$ alone.

for the quartic oscillator, $\langle n|(a+a^\dagger)^4|n\rangle = {{c1::6n^2 + 6n + 3}}$ ^qm1-x4
<!-- sr due=2026-10-28 st=review s=13.3 d=6.1 r=6 l=1 ivl=13 last=2026-10-15T16:40:00Z g=3 -->

trick for $\langle n|x^4|n\rangle$ without expanding sixteen terms
?
$x^2$ is Hermitian, so $\langle n|x^4|n\rangle = \|x^2|n\rangle\|^2$: act once with $(a+a^\dagger)^2$, get three kets ($n-2$, $n$, $n+2$), sum the squared coefficients ^qm1-x4trick
<!-- sr due=2026-11-25 st=review s=40.2 d=3.2 r=5 l=0 ivl=40 last=2026-10-16T08:03:00Z g=4 -->

Second order (homework 2, not lecture): only $m = n\pm2, n\pm4$ contribute, and for the ground state

$$E_0^2 = -\frac{21}{8}\,\frac{\lambda^2}{\hbar\omega}\left(\frac{\hbar}{m\omega}\right)^4,$$

i.e. in units of $\hbar\omega$ and with $g$ as above, $E_0 = \hbar\omega\left(\frac12 + \frac34 g - \frac{21}{8}g^2 + \cdots\right)$. The coefficients alternate in sign and grow; the next one is $\frac{333}{16}$. Bender and Wu showed they grow factorially, roughly like $(-1)^k\, 3^k\, k!$ up to powers. So the series has zero radius of convergence (see below), yet the first two terms are very accurate for small $g$. Lindgren: "asymptotic, not convergent. Use it, don't sum it."

#TODO: check the $-\frac{21}{8}$ against my HW2 solution, I think I had a factor of 2 wrong on the $n=4$ term at first.

(Checked 09-21. Act twice with $(a+a^\dagger)^2$ on $|0\rangle$: $(a+a^\dagger)^4|0\rangle = 3|0\rangle + 6\sqrt2\,|2\rangle + 2\sqrt6\,|4\rangle$. Then $E_0^2 = \lambda^2\left(\frac{\hbar}{2m\omega}\right)^4\left[\frac{72}{-2\hbar\omega} + \frac{24}{-4\hbar\omega}\right] = -\frac{42}{16}\frac{\lambda^2}{\hbar\omega}\left(\frac{\hbar}{m\omega}\right)^4$, which is $-\frac{21}{8}$. My HW had $\frac{24}{-2\hbar\omega}$ for the $n=4$ term, i.e. I used the wrong gap. Fixed.)

## worked example (recitation, Sep 10): delta bump in the infinite well

Infinite square well on $[0, a]$, $\psi_n = \sqrt{2/a}\,\sin(n\pi x/a)$, $E_n^0 = \frac{n^2\pi^2\hbar^2}{2ma^2}$. Perturb with $H' = \alpha\,\delta(x - a/2)$.

$$E_n^1 = \alpha|\psi_n(a/2)|^2 = \frac{2\alpha}{a}\sin^2\frac{n\pi}{2} = \begin{cases} 2\alpha/a & n \text{ odd}\\ 0 & n\text{ even}\end{cases}$$

The even states have a node at the center, so they don't feel the delta at all, to any order (the exact even solutions are just the unperturbed ones). The odd states shift up. Second order for the ground state: $H'_{m1} = \frac{2\alpha}{a}\sin\frac{m\pi}{2}\sin\frac{\pi}{2}$, nonzero only for odd $m$, $|H'_{m1}|^2 = 4\alpha^2/a^2$, and

$$E_1^2 = \frac{4\alpha^2}{a^2}\cdot\frac{2ma^2}{\pi^2\hbar^2}\sum_{m = 3, 5, \ldots}\frac{1}{1 - m^2}.$$

The sum converges, $\sum_{m\,\text{odd}\geq 3}\frac{1}{m^2 - 1} = \frac14$ (telescopes: $\frac{1}{m^2-1} = \frac12\left(\frac{1}{m-1} - \frac{1}{m+1}\right)$, odd $m$ gives $\frac12\cdot\frac12$). So $E_1^2 = -\frac{2m\alpha^2}{\pi^2\hbar^2}$. The TA pointed out that for higher states the analogous sum includes $m < n$ terms with positive contributions, so the sign is not fixed except for the ground state. Consistent with the general statement above.

The dimensionless "smallness" here is $\frac{E_1^1}{E_2^0 - E_1^0} = \frac{2\alpha/a}{3\pi^2\hbar^2/2ma^2} = \frac{4m\alpha a}{3\pi^2\hbar^2}$. Wide well or strong delta, PT fails.

a delta perturbation $\alpha\,\delta(x - a/2)$ at the center of an infinite well shifts the {{c1::odd-$n$}} states by $2\alpha/a$ at first order and leaves the others alone, because those have {{c2::a node at the center}} ^qm1-delta
<!-- sr c1 due=2026-11-12 st=review s=29.8 d=3.6 r=4 l=0 ivl=30 last=2026-10-13T08:20:00Z g=3 -->
<!-- sr c2 due=2026-11-12 st=review s=29.8 d=3.6 r=4 l=0 ivl=30 last=2026-10-13T08:20:00Z g=3 -->

## worked example 2: charged oscillator in a uniform field (exact vs PT)

$$H = \frac{p^2}{2m} + \frac12 m\omega^2 x^2 - qEx.$$

This one is the "PT check" example: it can be solved exactly, so you can watch PT reproduce it.

Exact solution. Complete the square:

$$\frac12 m\omega^2 x^2 - qEx = \frac12 m\omega^2\left(x - x_0\right)^2 - \frac{q^2E^2}{2m\omega^2}, \qquad x_0 = \frac{qE}{m\omega^2}.$$

So the potential is the same parabola shifted to $x_0$ and lowered by a constant. The eigenfunctions are $\psi_n(x - x_0)$ and

$$E_n = \left(n + \tfrac12\right)\hbar\omega - \frac{q^2E^2}{2m\omega^2}.$$

Every level drops by the same amount, independent of $n$.

Perturbation theory, first order:

$$E_n^1 = -qE\langle n|x|n\rangle = 0$$

since $x$ only connects $n$ to $n\pm1$ (and by parity, $\langle x\rangle = 0$ in any oscillator eigenstate).

Second order: the only nonzero matrix elements are

$$\langle n+1|x|n\rangle = \sqrt{\frac{\hbar}{2m\omega}}\sqrt{n+1}, \qquad \langle n-1|x|n\rangle = \sqrt{\frac{\hbar}{2m\omega}}\sqrt{n},$$

with energy denominators $E_n^0 - E_{n+1}^0 = -\hbar\omega$ and $E_n^0 - E_{n-1}^0 = +\hbar\omega$:

$$E_n^2 = q^2E^2\,\frac{\hbar}{2m\omega}\left[\frac{n+1}{-\hbar\omega} + \frac{n}{\hbar\omega}\right] = -\frac{q^2E^2}{2m\omega^2}.$$

Exact. The $n$-dependence cancels between "pushed down by the level above" and "pushed up by the level below", leaving exactly the classical $-\frac{q^2E^2}{2m\omega^2}$. And all higher orders must vanish, since second order already is the exact answer. (Lindgren: "if you ever get a nonzero third-order term here, you've made an error. This is a free check.")

for the charged oscillator in a field, second-order PT gives the exact shift because
?
the exact answer is $-q^2E^2/2m\omega^2$, quadratic in $E$ with no higher powers; first order vanishes by parity, and in second order the $n+1$ and $n$ contributions combine so the $n$-dependence cancels, leaving exactly that ^qm1-chargedosc
<!-- sr due=2026-10-26 st=review s=9.8 d=6.9 r=5 l=1 ivl=10 last=2026-10-16T13:30:00Z g=2 -->

First-order state, as a check of the state formula:

$$|n^1\rangle = \frac{qE}{\hbar\omega}\sqrt{\frac{\hbar}{2m\omega}}\left(\sqrt{n+1}\,|n+1\rangle - \sqrt n\,|n-1\rangle\right).$$

Compare with the exact state: shifting a wavefunction by $x_0$ is $e^{-ipx_0/\hbar}$, which to first order in $x_0$ is $1 - ix_0 p/\hbar$. With $p = i\sqrt{m\hbar\omega/2}\,(a^\dagger - a)$,

$$-\frac{ix_0}{\hbar}\,p\,|n\rangle = x_0\sqrt{\frac{m\omega}{2\hbar}}\left(\sqrt{n+1}\,|n+1\rangle - \sqrt n\,|n-1\rangle\right)$$

and $x_0\sqrt{m\omega/2\hbar} = \frac{qE}{m\omega^2}\sqrt{\frac{m\omega}{2\hbar}} = \frac{qE}{\hbar\omega}\sqrt{\frac{\hbar}{2m\omega}}$. Same thing. Good, PT state = translated state to first order.

Physical takeaway: the induced dipole is $\langle qx\rangle = qx_0 = \frac{q^2}{m\omega^2}E$, so the polarizability is $\alpha = q^2/m\omega^2$, and $E^{(2)} = -\frac12\alpha E^2$. That form, $-\frac12\alpha E^2$, is general for a system with no permanent dipole, and is exactly what we get for hydrogen next.

## worked example 3: Stark effect on the hydrogen ground state

Hydrogen atom in a uniform field $\mathbf E = E\hat z$. The electron has charge $-e$, potential $\phi = -Ez$, so its potential energy is

$$H' = (-e)\phi = eEz = eEr\cos\theta.$$

(Sign: some books write $-eEz$ because they define the field direction the other way; it doesn't matter for anything quadratic.)

First order. $|100\rangle$ is spherically symmetric, $z$ is odd under parity, so

$$E_1^1 = eE\langle 100|z|100\rangle = 0.$$

More generally: parity eigenstates have no first-order Stark shift. Nondegenerate hydrogen states have no permanent dipole moment. The linear Stark effect for $n=2$ (next unit) comes entirely from the degeneracy between $2s$ and $2p$, which have opposite parity and so can be mixed into states that do have a dipole.

the ground state of hydrogen has no first-order Stark shift because $\langle 100|z|100\rangle = 0$ by {{c1::parity}} ^qm1-stark1
<!-- sr due=2026-12-30 st=review s=67.3 d=1.9 r=5 l=0 ivl=67 last=2026-10-24T11:17:00Z g=4 -->

Second order:

$$E_1^2 = e^2E^2\sum_{nlm \neq 100}\frac{|\langle nlm|z|100\rangle|^2}{E_1 - E_n}$$

where the "sum" includes an integral over the continuum. Selection rules: $z \propto Y_1^0$ so only $l = 1$, $m = 0$ states contribute. That's still infinitely many bound states plus the continuum. The exact answer (Dalgarno–Lewis method, or solving in parabolic coordinates) is

$$E_1^2 = -\frac12\alpha E^2, \qquad \alpha = \frac92\,(4\pi\epsilon_0)\,a_0^3.$$

Lindgren did not derive the $9/2$ — he showed how to bound it, which he says is the actual skill.

Upper bound on $|E_1^2|$. Every denominator satisfies $E_n - E_1 \geq E_2 - E_1 = \frac34(13.6\text{ eV})$. So

$$|E_1^2| \leq \frac{e^2E^2}{E_2 - E_1}\sum_{nlm\neq100}|\langle nlm|z|100\rangle|^2 = \frac{e^2E^2}{E_2 - E_1}\left(\langle 100|z^2|100\rangle - |\langle 100|z|100\rangle|^2\right)$$

using closure $\sum_{\text{all}}|nlm\rangle\langle nlm| = 1$. The subtracted term is zero. By symmetry $\langle z^2\rangle = \frac13\langle r^2\rangle$, and for the ground state $\langle r^2\rangle = 3a_0^2$, so $\langle z^2\rangle = a_0^2$. With $E_2 - E_1 = \frac38\,\frac{e^2}{4\pi\epsilon_0 a_0}$:

$$|E_1^2| \leq \frac{8}{3}(4\pi\epsilon_0)a_0^3 E^2 \quad\Longrightarrow\quad \alpha \leq \frac{16}{3}(4\pi\epsilon_0)a_0^3 \approx 5.33\,(4\pi\epsilon_0)a_0^3.$$

Exact is 4.5. Not bad for three lines. (A lower bound comes from keeping only the $|210\rangle$ term, which is all positive contributions dropped but one: gives about $2.96\,(4\pi\epsilon_0)a_0^3$. I didn't check that number. #TODO)

the closure trick for bounding a second-order shift
?
replace every denominator $E_n^0 - E_m^0$ by the smallest gap $\Delta$ (same sign for the ground state), then $\sum_{m\ne n}|H'_{mn}|^2 = \langle n^0|H'^2|n^0\rangle - \langle n^0|H'|n^0\rangle^2$, so
$$|E_n^2| \le \frac{\langle H'^2\rangle - \langle H'\rangle^2}{\Delta}$$ ^qm1-closure
<!-- sr due=2026-10-29 st=review s=13.9 d=6.3 r=6 l=1 ivl=14 last=2026-10-15T20:48:00Z g=3 -->

for hydrogen's ground state, $\langle z^2\rangle = {{c1::a_0^2}}$ and the static polarizability is $\alpha = {{c2::\frac92}}(4\pi\epsilon_0)a_0^3$ ^qm1-alpha
<!-- sr c1 due=2026-11-06 st=review s=23.4 d=4.6 r=5 l=0 ivl=23 last=2026-10-14T09:12:00Z g=3 -->
<!-- sr c2 due=2026-10-24 st=review s=8.1 d=7.4 r=6 l=2 ivl=8 last=2026-10-16T09:12:00Z g=2 -->

Order of magnitude: for a lab field of $10^6$ V/m, $eEa_0 \approx 5\times10^{-5}$ eV, and the shift is $\sim (eEa_0)^2/(13.6\text{ eV}) \sim 10^{-10}$ eV. Tiny. Atomic fields are $\sim 5\times10^{11}$ V/m, which is the real expansion parameter: $E/E_{\text{atomic}}$.

## convergence, or: what "small" means

Lindgren spent most of lecture 5 on this and said it's "the most important lecture nobody listens to". Notes:

The naive criterion. PT makes sense when every mixing coefficient is small:

$$\left|\frac{H'_{mn}}{E_n^0 - E_m^0}\right| \ll 1 \quad\text{for all } m \neq n.$$

This is a condition on matrix elements relative to level spacings, not on the "size of $H'$" in any operator-norm sense. (The $x^4$ operator is unbounded; there's no sense in which it is small. Yet the low states are fine.)

nondegenerate PT is reliable for state $n$ when {{c1::$|H'_{mn}| \ll |E_n^0 - E_m^0|$}} for every $m \neq n$ ^qm1-small
<!-- sr due=2026-11-02 st=review s=24.6 d=4.4 r=5 l=0 ivl=25 last=2026-10-08T17:55:00Z g=3 -->

Dyson's argument (for the quartic oscillator, originally for QED). Suppose $E_0(\lambda)$ had a power series convergent in some disc $|\lambda| < R$. Then it would be analytic at $\lambda = 0$ and in particular well-defined for small negative $\lambda$. But for any $\lambda < 0$ the potential $\frac12 m\omega^2x^2 - |\lambda|x^4$ goes to $-\infty$ at large $|x|$: there is no ground state at all, and the would-be bound state tunnels out. The physics changes discontinuously at $\lambda = 0$, so the radius of convergence must be zero. The series is asymptotic: for fixed small $\lambda$, partial sums get better up to some optimal order $k^* \sim 1/g$ and then diverge.

why the perturbation series for $\lambda x^4$ has zero radius of convergence (Dyson's argument)
?
convergence for $|\lambda| < R$ would make $E_0(\lambda)$ analytic at $0$, hence sensible for small $\lambda < 0$; but for $\lambda < 0$ the potential is unbounded below and there is no bound state, so no convergent series can exist; the series is only asymptotic ^qm1-dyson
<!-- sr due=2026-10-30 st=review s=6.2 d=7.8 r=6 l=2 ivl=6 last=2026-10-24T08:31:00Z g=3 -->

The same thing happens for the Stark effect: in any uniform field, however weak, hydrogen has no true bound states, because at large negative $z$ (for our sign) the potential $-\frac{e^2}{4\pi\epsilon_0 r} + eEz$ goes below $E_1$. The ground state becomes a resonance with a tunneling width $\Gamma \propto \exp\!\left(-\frac{2}{3}\frac{E_{\text{at}}}{E}\right)$ (in atomic units something like $\frac{4}{E}e^{-2/3E}$). That exponential is invisible to every order of PT, since $e^{-1/x}$ has all derivatives zero at $x = 0$. So the PT series in $E$ can't be convergent; it gives the real part of the resonance energy asymptotically and misses the width entirely. [ask in OH: is the width formula $\frac{4}{E}e^{-2/(3E)}$ exactly? Got it off the board in a hurry]

Lindgren's summary, which I copied word for word: "Perturbation theory is an expansion of the answer, not of the physics. It works when the physics doesn't change qualitatively as you turn $\lambda$ on. When it does — a new decay channel opens, a bound state disappears — the series still exists, but it only knows about the side of $\lambda = 0$ it started on."

Practical rules he gave:

1. Compute first order. If it vanishes by symmetry, go to second order (and look for a reason it vanished; it usually tells you which states mix).
2. Check the mixing coefficients. Any one of order 1 means you're near a degeneracy and should be doing degenerate PT on that pair.
3. Successive orders should get smaller. When they stop doing that, stop.
4. If an exact solution exists (charged oscillator, two-level system), use it to check.

## things to remember for the exam (Lindgren said these would be on it)

- derive $E^1$, $|n^1\rangle$, $E^2$ from the $\lambda$ expansion: "derivation, not quotation"
- parity / selection rules to kill matrix elements before computing them
- ladder operators for oscillator matrix elements
- closure bound on second order

second-order nondegenerate PT: from the $\lambda^2$ equation, how do you get $E_n^2$?
?
project $H^0|n^2\rangle + H'|n^1\rangle = E_n^0|n^2\rangle + E_n^1|n^1\rangle + E_n^2|n^0\rangle$ onto $\langle n^0|$: the $|n^2\rangle$ terms cancel (Hermitian $H^0$), $\langle n^0|n^1\rangle = 0$ kills the $E_n^1$ term, leaving
$$E_n^2 = \langle n^0|H'|n^1\rangle = \sum_{m\neq n}\frac{|H'_{mn}|^2}{E_n^0-E_m^0}$$ ^qm1-e2deriv
<!-- sr due=2026-11-09 st=review s=27.5 d=5 r=4 l=0 ivl=27 last=2026-10-13T15:26:00Z g=3 -->

## extras (not on exam)

Brillouin–Wigner vs Rayleigh–Schrödinger: what we did is RS (the energy denominators use $E_n^0$). BW puts the exact $E_n$ in the denominators, $E_n = E_n^0 + \sum_m \frac{|H'_{mn}|^2}{E_n - E_m^0} + \ldots$, which is an implicit equation but doesn't need degeneracy-avoiding. Lindgren mentioned it for one minute. Not on exam.

Hellmann–Feynman: $\frac{dE_n}{d\lambda} = \langle n(\lambda)|H'|n(\lambda)\rangle$ exactly, for normalized eigenstates. At $\lambda = 0$ this is first-order PT. Useful for getting $\langle 1/r\rangle$, $\langle 1/r^2\rangle$ in hydrogen by differentiating $E_n$ with respect to $e^2$ or $l$ — which is exactly what we need for fine structure next unit.

Hellmann–Feynman theorem ::: $\dfrac{\partial E_n}{\partial \lambda} = \left\langle n \middle| \dfrac{\partial H}{\partial\lambda} \middle| n\right\rangle$ for normalized eigenstates ^qm1-hf
<!-- sr due=2026-11-17 st=review s=29.1 d=4.3 r=4 l=0 ivl=29 last=2026-10-19T19:44:00Z g=3 -->
